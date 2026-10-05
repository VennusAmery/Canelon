import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import { pool } from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPROBANTES_DIR = path.join(__dirname, "../public/comprobantes");
fs.mkdirSync(COMPROBANTES_DIR, { recursive: true });

const router = Router();

function minFechaEntregaStr() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// El carrito puede mandar el id de la línea compuesto ("producto|variante|extras")
// además de productId / variantId. Aquí se obtiene siempre el producto y la variante reales.
function parseLinea(i) {
  const partes = String(i.id ?? "").split("|");
  const productId = String(i.productId ?? partes[0]);
  const variante = i.variantId ?? i.varianteId ?? i.variante?.id ?? (partes[1] || null);
  return { productId, variantId: variante ? String(variante) : null };
}

router.post("/", async (req, res) => {
  const { cliente, telefono, items, tarjeta, direccionEntrega, fechaEntrega } = req.body;

  // ---------- Validaciones básicas ----------
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "El pedido no tiene productos." });
  }
  if (!items.every((i) => i && (i.id || i.productId) && Number.isInteger(i.qty) && i.qty > 0)) {
    return res.status(400).json({ error: "Cantidad inválida en el pedido." });
  }
  if (!cliente || !telefono) {
    return res.status(400).json({ error: "Nombre y teléfono son requeridos." });
  }
  if (!direccionEntrega) {
    return res.status(400).json({ error: "La dirección de entrega es requerida." });
  }
  if (!fechaEntrega || fechaEntrega < minFechaEntregaStr()) {
    return res.status(400).json({ error: "La fecha de entrega debe ser al menos 3 días después de hoy." });
  }
  if (!tarjeta?.numero || !tarjeta?.nombre || !tarjeta?.vencimiento || !tarjeta?.cvc) {
    return res.status(400).json({ error: "Datos de tarjeta incompletos." });
  }

  const numeroLimpio = tarjeta.numero.replace(/\s+/g, "");
  if (numeroLimpio.length < 12) {
    return res.status(400).json({ error: "Número de tarjeta inválido." });
  }
  const last4 = numeroLimpio.slice(-4);

  // Agrupar por producto + variante. Los ids se normalizan a string para que
  // 5 y "5" cuenten como el mismo producto.
  const pedidoLineas = new Map(); // "productId|variantId" -> { id, variantId, qty }
  const cantidadPorProducto = new Map(); // productId -> qty total
  const nombresCarrito = new Map(); // productId -> nombre (solo para mensajes de error)
  for (const i of items) {
    const { productId: idStr, variantId } = parseLinea(i);
    const key = `${idStr}|${variantId ?? ""}`;
    const prev = pedidoLineas.get(key);
    pedidoLineas.set(key, { id: idStr, variantId, qty: (prev?.qty || 0) + i.qty });
    cantidadPorProducto.set(idStr, (cantidadPorProducto.get(idStr) || 0) + i.qty);
    nombresCarrito.set(idStr, i.nombre);
  }
  const productIds = [...cantidadPorProducto.keys()];

  const orderId = crypto.randomUUID();
  const codigoTransaccion = crypto.randomBytes(4).toString("hex").toUpperCase();

  const conn = await pool.getConnection();
  let committed = false;
  let datosPedido = null;

  try {
    await conn.beginTransaction();

    // Producto, tipo y stock desde la BD (FOR UPDATE bloquea las filas)
    const [productRows] = await conn.query(
      `SELECT id, nombre, precio, tipo_pedido, stock
       FROM products
       WHERE id IN (?)
       FOR UPDATE`,
      [productIds]
    );
    const porId = new Map(productRows.map((p) => [String(p.id), p]));

    if (productRows.length !== productIds.length) {
      const encontrados = new Set(productRows.map((p) => String(p.id)));
      const faltantes = productIds.filter((id) => !encontrados.has(id));
      console.warn("Pedido con productos inexistentes:", faltantes);
      await conn.rollback();
      const detalle = faltantes
        .map((id) => `${nombresCarrito.get(id) || "?"} (id: ${id})`)
        .join(", ");
      return res.status(400).json({
        error: `No se encontró en la base de datos: ${detalle}. Vacía el carrito y vuelve a agregarlo.`,
      });
    }

    // Variantes de esos productos
    const [variantRows] = await conn.query(
      `SELECT id, product_id, nombre, precio FROM product_variants WHERE product_id IN (?)`,
      [productIds]
    );
    const variantesPorProducto = new Map();
    for (const v of variantRows) {
      const k = String(v.product_id);
      if (!variantesPorProducto.has(k)) variantesPorProducto.set(k, []);
      variantesPorProducto.get(k).push(v);
    }

    // Validar stock ANTES de insertar nada (por producto)
    for (const [id, qty] of cantidadPorProducto) {
      const p = porId.get(id);
      if (p.tipo_pedido === "stock" && p.stock < qty) {
        await conn.rollback();
        return res.status(409).json({
          error: `No hay suficiente stock de ${p.nombre}. Disponible: ${p.stock}.`,
        });
      }
    }

    // Líneas del pedido con nombre y precio confiables (de la BD)
    const lineas = [];
    for (const l of pedidoLineas.values()) {
      const p = porId.get(l.id);
      const variantes = variantesPorProducto.get(l.id) || [];
      let nombre = p.nombre;
      let precio;

      if (variantes.length > 0) {
        const v = variantes.find((x) => String(x.id) === String(l.variantId));
        if (!v) {
          await conn.rollback();
          return res.status(400).json({ error: `Elige una opción válida para ${p.nombre}.` });
        }
        nombre = `${p.nombre} (${v.nombre})`;
        precio = Number(v.precio);
      } else {
        precio = Number(p.precio);
      }

      if (!Number.isFinite(precio) || precio <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: `El producto ${p.nombre} no tiene precio disponible.` });
      }
      lineas.push({ id: p.id, nombre, precio, qty: l.qty });
    }

    const total = lineas.reduce((sum, l) => sum + l.precio * l.qty, 0);
    const anticipo = Math.round(total * 0.5);
    const saldo = total - anticipo;

    const esBajoPedido = productRows.some((p) => p.tipo_pedido === "bajo_pedido");
    const tipoPedido = esBajoPedido ? "bajo_pedido" : "stock";

    const comprobanteFilename = `${orderId}.pdf`;
    const comprobantePath = `/comprobantes/${comprobanteFilename}`;

    await conn.query(
      `INSERT INTO orders
        (id, total, estado, cliente, telefono_cliente, estado_pago, comprobante_pago, monto_anticipo, tipo_pedido, direccion_entrega, fecha_entrega)
       VALUES (?, ?, 'recibido', ?, ?, 'aprobado', ?, ?, ?, ?, ?)`,
      [orderId, total, cliente, telefono, comprobantePath, anticipo, tipoPedido, direccionEntrega, fechaEntrega]
    );

    for (const l of lineas) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, nombre, precio, qty) VALUES (?, ?, ?, ?, ?)`,
        [orderId, l.id, l.nombre, l.precio, l.qty]
      );

      if (porId.get(String(l.id)).tipo_pedido === "stock") {
        await conn.query(`UPDATE products SET stock = stock - ? WHERE id = ?`, [l.qty, l.id]);
        await conn.query(
          `INSERT INTO stock_movements (product_id, tipo, cantidad, order_id) VALUES (?, 'venta', ?, ?)`,
          [l.id, -l.qty, orderId]
        );
      }
    }

    await conn.commit();
    committed = true;

    datosPedido = { total, anticipo, saldo, lineas, comprobanteFilename, comprobantePath };
  } catch (err) {
    if (!committed) await conn.rollback();
    console.error(err);
    return res.status(500).json({ error: "No se pudo procesar el pago." });
  } finally {
    conn.release();
  }

  // ---------- Comprobante PDF (el pedido ya está guardado) ----------
  const { total, anticipo, saldo, lineas, comprobanteFilename, comprobantePath } = datosPedido;

  try {
    await generarComprobantePDF({
      filePath: path.join(COMPROBANTES_DIR, comprobanteFilename),
      orderId,
      cliente,
      telefono,
      direccionEntrega,
      fechaEntrega,
      items: lineas,
      total,
      anticipo,
      saldo,
      codigoTransaccion,
      last4,
    });
  } catch (err) {
    console.error("Error generando comprobante PDF:", err);
  }

  res.status(201).json({
    id: orderId,
    total,
    anticipo,
    saldo,
    fechaEntrega,
    comprobante: comprobantePath,
    codigoTransaccion,
  });
});

// ---------- Paleta de marca ----------
const COLOR_CAFE = "#3a2a1e";
const COLOR_CAFE_SUAVE = "#7a6a5c";
const COLOR_CANELA = "#b5651d";
const COLOR_MIEL = "#e0913c";
const COLOR_MASA = "#fdf6e9";
const COLOR_LINEA = "#d9c9b7";

function generarComprobantePDF({
  filePath, orderId, cliente, telefono, direccionEntrega, fechaEntrega,
  items, total, anticipo, saldo, codigoTransaccion, last4,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 0 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;
    const M = 36; // margen interno
    let y = 0;

    // Fondo crema en toda la página
    doc.rect(0, 0, W, doc.page.height).fill(COLOR_MASA);

    const logoPath = path.join(__dirname, "../assets/logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, M, 20, { width: 50 });
    }

    // Encabezado
    y = 40;
    doc.fillColor(COLOR_CAFE).font("Helvetica-Bold").fontSize(28)
      .text("Canelón", M, y, { width: W - M * 2, align: "center" });
    y += 34;
    doc.fillColor(COLOR_CANELA).font("Helvetica-Oblique").fontSize(11)
      .text("Comprobante de pago", M, y, { width: W - M * 2, align: "center" });

    y += 30;
    dottedLine(doc, M, y, W - M);
    y += 14;

    // Encabezado de columnas
    doc.fillColor(COLOR_CAFE_SUAVE).font("Helvetica-Bold").fontSize(9);
    doc.text("PRODUCTO", M, y);
    doc.text("CANT.", W - M - 140, y, { width: 60, align: "center" });
    doc.text("PRECIO", W - M - 70, y, { width: 70, align: "right" });
    y += 16;
    dottedLine(doc, M, y, W - M);
    y += 14;

    // Filas de productos
    items.forEach((item, i) => {
      doc.fillColor(COLOR_CAFE).font("Helvetica-Bold").fontSize(12);
      doc.text(`${String(i + 1).padStart(2, "0")}  ${item.nombre}`, M, y, { width: W - M * 2 - 130 });

      doc.font("Helvetica").fontSize(10).fillColor(COLOR_CAFE_SUAVE);
      doc.text(String(item.qty), W - M - 140, y + 2, { width: 60, align: "center" });

      doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR_CAFE);
      doc.text(`Q${item.precio * item.qty}`, W - M - 70, y + 2, { width: 70, align: "right" });

      y += 26;
      dottedLine(doc, M, y, W - M, COLOR_LINEA);
      y += 14;
    });

    y += 4;

    // Bloque de totales
    doc.font("Helvetica").fontSize(10).fillColor(COLOR_CAFE_SUAVE);
    doc.text("Total del pedido:", M, y);
    doc.font("Helvetica-Bold").fillColor(COLOR_CAFE).text(`Q${total}`, W - M - 100, y, { width: 100, align: "right" });
    y += 18;

    // Franja del anticipo
    doc.rect(M - 6, y - 4, W - (M - 6) * 2, 26).fill("#f7e6d0");
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR_CANELA);
    doc.text("Anticipo pagado (50%):", M, y + 2);
    doc.text(`Q${anticipo}`, W - M - 100, y + 2, { width: 100, align: "right" });
    y += 32;

    doc.font("Helvetica").fontSize(10).fillColor(COLOR_CAFE_SUAVE);
    doc.text("Saldo restante:", M, y);
    doc.font("Helvetica-Bold").fillColor(COLOR_CAFE).text(`Q${saldo}`, W - M - 100, y, { width: 100, align: "right" });

    y += 26;
    dottedLine(doc, M, y, W - M);
    y += 16;

    // Datos del pedido
    doc.font("Helvetica").fontSize(9.5).fillColor(COLOR_CAFE);
    const fechaFormateada = new Date(fechaEntrega).toLocaleDateString("es-GT", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    [
      ["Pedido", orderId],
      ["Cliente", cliente],
      ["Teléfono", telefono],
      ["Dirección de entrega", direccionEntrega],
      ["Entrega estimada", fechaFormateada],
      ["Tarjeta", `**** **** **** ${last4}`],
      ["Código de transacción", codigoTransaccion],
    ].forEach(([label, value]) => {
      doc.font("Helvetica-Bold").text(`${label}: `, M, y, { continued: true });
      doc.font("Helvetica").fillColor(COLOR_CAFE_SUAVE).text(value);
      doc.fillColor(COLOR_CAFE);
      y += 14;
    });

    y += 10;
    dottedLine(doc, M, y, W - M);
    y += 20;

    // Código de barras decorativo
    let x = M + 20;
    const barcodeY = y;
    const seed = orderId.replace(/-/g, "");
    for (let i = 0; i < 50; i++) {
      const w = (seed.charCodeAt(i % seed.length) % 3) + 1;
      const h = 34;
      doc.rect(x, barcodeY, w, h).fill(COLOR_CAFE);
      x += w + 2;
    }
    y += 44;
    doc.font("Helvetica").fontSize(8).fillColor(COLOR_CAFE_SUAVE)
      .text(`CANELON-${orderId.slice(0, 8).toUpperCase()}`, M, y, { width: W - M * 2, align: "center" });

    y += 20;
    doc.font("Helvetica").fontSize(8).fillColor(COLOR_CAFE_SUAVE).text(
      "Comprobante simulado, generado con fines de demostración.",
      M, y, { width: W - M * 2, align: "center" }
    );

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function dottedLine(doc, x1, y, x2, color = "#c9b89e") {
  doc.save();
  doc.dash(1, { space: 2 }).moveTo(x1, y).lineTo(x2, y).strokeColor(color).stroke();
  doc.undash();
  doc.restore();
}

export default router;
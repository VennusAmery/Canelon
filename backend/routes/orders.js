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

function numeroFactura(orderId) {
  return `CAN-${orderId.slice(0, 8).toUpperCase()}`;
}

function slug(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "cliente";
}

router.post("/", async (req, res) => {
  const {
    cliente,
    telefono,
    items,
    tarjeta,
    direccionEntrega,
    fechaEntrega,
    metodoPago = "tarjeta",
  } = req.body;

  // ---------- Validaciones básicas ----------
  if (!["tarjeta", "contra_entrega"].includes(metodoPago)) {
    return res.status(400).json({ error: "Método de pago inválido." });
  }
  const esTarjeta = metodoPago === "tarjeta";

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "El pedido no tiene productos." });
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

  let last4 = null;
  if (esTarjeta) {
    if (!tarjeta?.numero || !tarjeta?.nombre || !tarjeta?.vencimiento || !tarjeta?.cvc) {
      return res.status(400).json({ error: "Datos de tarjeta incompletos." });
    }
    const numeroLimpio = tarjeta.numero.replace(/\s+/g, "");
    if (numeroLimpio.length < 12) {
      return res.status(400).json({ error: "Número de tarjeta inválido." });
    }
    last4 = numeroLimpio.slice(-4);
  }

  const estadoPago = esTarjeta ? "aprobado" : "pendiente";

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

    const [productRows] = await conn.query(
      `SELECT id, nombre, descripcion, precio, tipo_pedido, stock
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


    const [variantRows] = await conn.query(
      `SELECT id, product_id, nombre, detalle, precio FROM product_variants WHERE product_id IN (?)`,
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

const lineas = [];
for (const l of pedidoLineas.values()) {
  const p = porId.get(l.id);
  const variantes = variantesPorProducto.get(l.id) || [];
  let nombre = p.nombre;
  let precio;
  let detalle = p.descripcion || "";

  if (variantes.length > 0) {
    const v = variantes.find((x) => String(x.id) === String(l.variantId));
    if (!v) {
      await conn.rollback();
      return res.status(400).json({ error: `Elige una opción válida para ${p.nombre}.` });
    }
    nombre = `${p.nombre} (${v.nombre})`;
    precio = Number(v.precio);
    detalle = v.detalle || p.descripcion || "";
  } else {
    precio = Number(p.precio);
  }

  if (!Number.isFinite(precio) || precio <= 0) {
    await conn.rollback();
    return res.status(400).json({ error: `El producto ${p.nombre} no tiene precio disponible.` });
  }
  lineas.push({ id: p.id, nombre, detalle, precio, qty: l.qty });
}

    // Totales con precios de la BD. Contra entrega: sin anticipo, todo queda como saldo.
    const total = lineas.reduce((sum, l) => sum + l.precio * l.qty, 0);
    const anticipo = esTarjeta ? Math.round(total * 0.5) : 0;
    const saldo = total - anticipo;

    const esBajoPedido = productRows.some((p) => p.tipo_pedido === "bajo_pedido");
    const tipoPedido = esBajoPedido ? "bajo_pedido" : "stock";

const comprobanteFilename = `Factura-${numeroFactura(orderId)}-${slug(cliente)}.pdf`;
const comprobantePath = `/comprobantes/${comprobanteFilename}`;

  await conn.query(
    `INSERT INTO orders
      (id, total, estado, cliente, telefono_cliente, estado_pago, metodo_pago, comprobante_pago, monto_anticipo, tipo_pedido, direccion_entrega, fecha_entrega)
    VALUES (?, ?, 'recibido', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, total, cliente, telefono, estadoPago, metodoPago, comprobantePath, anticipo, tipoPedido, direccionEntrega, fechaEntrega]
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
    return res.status(500).json({ error: "No se pudo procesar el pedido." });
  } finally {
    conn.release();
  }

  // ---------- Comprobante PDF (el pedido ya está guardado) ----------
  const { total, anticipo, saldo, lineas, comprobanteFilename, comprobantePath } = datosPedido;

  try {
    await generarComprobantePDF({
      filePath: path.join(COMPROBANTES_DIR, comprobanteFilename),
      orderId, cliente, telefono, direccionEntrega, fechaEntrega,
      items: lineas, total, anticipo, saldo, codigoTransaccion, last4, metodoPago,
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
    metodoPago,
  });
});

// ---------- Paleta de marca (misma de index.css) ----------
const C = {
  fondo: "#b9793f",    // canela
  hoja: "#fbf3e4",     // masa
  pildora: "#f3dfa8",  // manteca
  linea: "#e3cfa0",    // manteca más oscura
  acento: "#b9793f",   // canela
  texto: "#3a2a1e",    // café
  suave: "#5c4632",    // café suave
};

// Reduce el tamaño de fuente hasta que el texto quepa en maxW
function ajustarFuente(doc, font, text, maxW, size) {
  doc.font(font);
  while (size > 8) {
    doc.fontSize(size);
    if (doc.widthOfString(text) <= maxW) break;
    size -= 1;
  }
  return size;
}

function generarComprobantePDF({
  filePath, orderId, cliente, telefono, direccionEntrega, fechaEntrega,
  items, total, anticipo, saldo, codigoTransaccion, last4, metodoPago,
}) {
  return new Promise((resolve, reject) => {
    const numero = numeroFactura(orderId);

    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `Factura ${numero} - ${cliente}`,
        Author: "Canelón",
        Subject: "Comprobante de pedido",
      },
    });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Fuente condensada opcional (Anton). Si no existe, usa Helvetica-Bold.
    const fontPath = path.join(__dirname, "../assets/fonts/Anton-Regular.ttf");
    let FT = "Helvetica-Bold";
    if (fs.existsSync(fontPath)) {
      doc.registerFont("Titulo", fontPath);
      FT = "Titulo";
    }

    // ---------- Medidas ----------
    const W = doc.page.width;
    const H = doc.page.height;
    const CM = 28;
    const CX = CM;
    const CW = W - CM * 2;
    const CB = H - CM;
    const P = 30;
    const LX = CX + P;
    const LW = 150;
    const DIVX = CX + 215;
    const RX = DIVX + 18;
    const RR = CX + CW - P;
    const RW = RR - RX;
    const TOP = 200;

    const pintarFondo = () => {
      doc.rect(0, 0, W, H).fill(C.fondo);
      doc.rect(CX, CM, CW, CB - CM).fill(C.hoja);
    };
    const divisor = (yIni) => {
      doc.moveTo(DIVX, yIni).lineTo(DIVX, CB - P).lineWidth(1).strokeColor(C.linea).stroke();
    };

    pintarFondo();

    // ---------- Logo ----------
    const logoPath = path.join(__dirname, "../assets/logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, LX, 40, { fit: [LW - 10, 100] });
    } else {
      const s = ajustarFuente(doc, FT, "CANELÓN", LW, 40);
      doc.font(FT).fontSize(s).fillColor(C.texto).text("CANELÓN", LX, 70, { lineBreak: false });
    }

    // ---------- Título + píldora ----------
    const titulo = "FACTURA";
    const tSize = ajustarFuente(doc, FT, titulo, RW, 76);
    const baseline = 118;
    const hoy = new Date().toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric" });

    doc.roundedRect(RX, 112, RW, 56, 14).fill(C.pildora);

    doc.font(FT).fontSize(tSize);
    const asc = (doc._font.ascender / 1000) * tSize;
    doc.fillColor(C.texto).text(titulo, RX, baseline - asc, { lineBreak: false });

    doc.font("Helvetica-Bold").fontSize(9).fillColor(C.texto);
    doc.text(`No. ${numero}`, RX + 14, 126, { lineBreak: false });
    doc.text(hoy, RX + 14, 126, { width: RW - 28, align: "right", lineBreak: false });
    doc.text(`Cliente: ${cliente}`, RX + 14, 146, { width: RW - 28, lineBreak: false, ellipsis: true });

    // ---------- Columna izquierda ----------
    const fechaFormateada = new Date(fechaEntrega).toLocaleDateString("es-GT", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    // Cada línea es [etiqueta, valor]
    const seccion = (tituloSec, lineas, y) => {
      doc.font(FT).fontSize(12).fillColor(C.acento).text(tituloSec, LX, y, { width: LW });
      y += 20;
      for (const [label, value] of lineas) {
        const texto = `${label}: ${value}`;
        doc.font("Helvetica-Bold").fontSize(8);
        const h = doc.heightOfString(texto, { width: LW });

        doc.fillColor(C.texto).text(`${label}: `, LX, y, { width: LW, continued: true });
        doc.font("Helvetica").fillColor(C.suave).text(String(value));

        y += h + 6;
      }
      return y + 22;
    };

    let ly = TOP;
    ly = seccion("Datos de Canelón:", [
      ["Instagram", "@canelon_gt"],
      ["Correo", "canelongt@gmail.com"],
      ["Horario", "Lunes a sábado, 8:00 AM – 4:00 PM"],
      ["Ubicación", "Ciudad de Guatemala"],
    ], ly);

    ly = seccion("Datos del cliente:", [
      ["Nombre", cliente],
      ["Teléfono", telefono],
      ["Dirección", direccionEntrega],
      ["Entrega estimada", fechaFormateada],
    ], ly);

    seccion("Información de pago:",
      metodoPago === "tarjeta"
        ? [
            ["Método de pago", "Tarjeta"],
            ["Tarjeta", `**** **** **** ${last4}`],
            ["Transacción", codigoTransaccion],
            ["Anticipo pagado", `Q${anticipo}`],
            ["Saldo pendiente", `Q${saldo}`],
          ]
        : [
            ["Método de pago", "Contra entrega"],
            ["A pagar al recibir", `Q${saldo}`],
          ],
      ly
    );

    divisor(TOP);

    // ---------- Columna derecha: detalle ----------
    const colCant = RR - 110;
    const nameW = colCant - RX - 10;
    let ry = TOP;

    doc.font(FT).fontSize(10).fillColor(C.acento);
    doc.text("DESCRIPCIÓN", RX, ry, { lineBreak: false });
    doc.text("CANT.", colCant, ry, { width: 40, align: "center", lineBreak: false });
    doc.text("SUBTOTAL", RR - 70, ry, { width: 70, align: "right", lineBreak: false });
    ry += 20;
    doc.moveTo(RX, ry).lineTo(RR, ry).lineWidth(1).strokeColor(C.linea).stroke();
    ry += 16;

    const terminosY = CB - P - 52;

    for (const item of items) {
      const detalle = item.detalle ? String(item.detalle) : "";

      doc.font("Helvetica-Bold").fontSize(9);
      const h = doc.heightOfString(item.nombre, { width: nameW });
      let hd = 0;
      if (detalle) {
        doc.font("Helvetica").fontSize(7.5);
        hd = doc.heightOfString(detalle, { width: nameW }) + 2;
      }

      // Salto de página si no cabe
      if (ry + h + hd + 20 > terminosY - 110) {
        doc.addPage();
        pintarFondo();
        divisor(CM + P);
        ry = CM + P;
      }

      doc.font("Helvetica-Bold").fontSize(9).fillColor(C.texto);
      doc.text(item.nombre, RX, ry, { width: nameW });
      doc.text(String(item.qty), colCant, ry, { width: 40, align: "center", lineBreak: false });
      doc.text(`Q${item.precio * item.qty}`, RR - 70, ry, { width: 70, align: "right", lineBreak: false });

      if (detalle) {
        doc.font("Helvetica").fontSize(7.5).fillColor(C.suave);
        doc.text(detalle, RX, ry + h + 2, { width: nameW });
      }

      ry += Math.max(h, 12) + hd + 16;
    }

    // ---------- Totales ----------
    if (ry > terminosY - 110) {
      doc.addPage();
      pintarFondo();
      divisor(CM + P);
      ry = CM + P;
    }

    ry += 14;
    const fila = (label, valor) => {
      doc.font(FT).fontSize(10).fillColor(C.acento)
        .text(label, RR - 190, ry, { width: 120, align: "right", lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(C.texto)
        .text(valor, RR - 60, ry + 1, { width: 60, align: "right", lineBreak: false });
      ry += 20;
    };
    const lineaTotales = () => {
      doc.moveTo(RX, ry - 4).lineTo(RR, ry - 4).lineWidth(1).strokeColor(C.linea).stroke();
      ry += 8;
    };

    if (metodoPago === "tarjeta") {
      fila("Total:", `Q${total}`);
      fila("Anticipo (50%):", `Q${anticipo}`);
      lineaTotales();
      fila("Saldo:", `Q${saldo}`);
    } else {
      fila("Total:", `Q${total}`);
      lineaTotales();
      fila("A pagar al recibir:", `Q${saldo}`);
    }

    // ---------- Términos y condiciones ----------
    doc.font(FT).fontSize(11).fillColor(C.acento)
      .text("Términos y Condiciones:", RX, terminosY, { width: RW, align: "right", lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(C.suave)
      .text(
        "Los pedidos se solicitan con al menos 3 días de anticipación. " +
        "Conserva este comprobante para cualquier aclaración sobre tu pedido.",
        RX, terminosY + 20, { width: RW, align: "right" }
      );

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

export default router;
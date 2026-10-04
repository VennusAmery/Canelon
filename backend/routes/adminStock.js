import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Express 4 no atrapa errores de funciones async: este wrapper los pasa a next()
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const UNIDADES = ["kg", "g", "L", "ml", "unidad", "lata", "paquete"];

// Las tablas salen de este mapa fijo (nunca del usuario)
const TIPOS = {
  productos: {
    tabla: "products",
    movs: "stock_movements",
    fk: "product_id",
    decimales: false,
    movimientos: ["entrada", "ajuste"],
    listar: `SELECT id, nombre, categoria, tipo_pedido, stock, stock_minimo
             FROM products WHERE activo = TRUE ORDER BY nombre`,
  },
  ingredientes: {
    tabla: "ingredients",
    movs: "ingredient_movements",
    fk: "ingredient_id",
    decimales: true,
    movimientos: ["entrada", "salida", "ajuste"],
    listar: `SELECT id, nombre, unidad, stock, stock_minimo
             FROM ingredients ORDER BY nombre`,
  },
};

const redondear = (n) => Math.round(n * 100) / 100;

// ---------- Alertas: todo lo que está por debajo de su mínimo ----------
router.get("/alertas", requireAuth, h(async (req, res) => {
  const [productos] = await pool.query(
    `SELECT id, nombre, stock, stock_minimo
     FROM products
     WHERE activo = TRUE AND tipo_pedido = 'stock' AND stock < stock_minimo
     ORDER BY stock`
  );
  const [ingredientes] = await pool.query(
    `SELECT id, nombre, unidad, stock, stock_minimo
     FROM ingredients
     WHERE stock < stock_minimo
     ORDER BY stock`
  );
  res.json({ productos, ingredientes, total: productos.length + ingredientes.length });
}));

// ---------- Crear ingrediente ----------
router.post("/ingredientes", requireAuth, h(async (req, res) => {
  const nombre = String(req.body.nombre || "").trim();
  const unidad = String(req.body.unidad || "").trim();
  const stock = Number(req.body.stock ?? 0);
  const minimo = Number(req.body.stock_minimo ?? 20);

  if (
    !nombre || !UNIDADES.includes(unidad) ||
    !Number.isFinite(stock) || stock < 0 ||
    !Number.isFinite(minimo) || minimo < 0
  ) {
    return res.status(400).json({ error: "Datos del ingrediente inválidos." });
  }

  try {
    const [r] = await pool.query(
      `INSERT INTO ingredients (nombre, unidad, stock, stock_minimo) VALUES (?, ?, ?, ?)`,
      [nombre, unidad, redondear(stock), redondear(minimo)]
    );
    if (stock > 0) {
      await pool.query(
        `INSERT INTO ingredient_movements (ingredient_id, tipo, cantidad, nota) VALUES (?, 'entrada', ?, 'Stock inicial')`,
        [r.insertId, redondear(stock)]
      );
    }
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ya existe un ingrediente con ese nombre." });
    }
    throw err;
  }
}));

// ---------- Listar (productos | ingredientes) ----------
router.get("/:tipo", requireAuth, h(async (req, res) => {
  const c = TIPOS[req.params.tipo];
  if (!c) return res.status(404).json({ error: "Tipo de inventario inválido." });
  const [rows] = await pool.query(c.listar);
  res.json(rows);
}));

// ---------- Movimiento de stock ----------
// entrada: suma · salida: resta (solo ingredientes) · ajuste: fija el total
router.post("/:tipo/:id/movimiento", requireAuth, h(async (req, res) => {
  const c = TIPOS[req.params.tipo];
  if (!c) return res.status(404).json({ error: "Tipo de inventario inválido." });

  const { tipo, cantidad, nota } = req.body;
  const n = Number(cantidad);
  const valido =
    c.movimientos.includes(tipo) &&
    Number.isFinite(n) && n >= 0 &&
    (c.decimales || Number.isInteger(n));
  if (!valido) return res.status(400).json({ error: "Movimiento inválido." });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[actual]] = await conn.query(
      `SELECT stock FROM ${c.tabla} WHERE id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!actual) {
      await conn.rollback();
      return res.status(404).json({ error: "No encontrado." });
    }

    const previo = Number(actual.stock);
    let nuevo;
    if (tipo === "entrada") nuevo = previo + n;
    else if (tipo === "salida") nuevo = previo - n;
    else nuevo = n;
    nuevo = redondear(nuevo);

    if (nuevo < 0) {
      await conn.rollback();
      return res.status(400).json({ error: "No hay suficiente stock para esa salida." });
    }

    await conn.query(`UPDATE ${c.tabla} SET stock = ? WHERE id = ?`, [nuevo, req.params.id]);
    await conn.query(
      `INSERT INTO ${c.movs} (${c.fk}, tipo, cantidad, nota) VALUES (?, ?, ?, ?)`,
      [req.params.id, tipo, redondear(nuevo - previo), nota || null]
    );

    await conn.commit();
    res.json({ ok: true, stock: nuevo });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// ---------- Cambiar el mínimo (umbral de alerta) ----------
router.patch("/:tipo/:id/minimo", requireAuth, h(async (req, res) => {
  const c = TIPOS[req.params.tipo];
  if (!c) return res.status(404).json({ error: "Tipo de inventario inválido." });

  const n = Number(req.body.stock_minimo);
  if (!Number.isFinite(n) || n < 0 || (!c.decimales && !Number.isInteger(n))) {
    return res.status(400).json({ error: "Valor inválido." });
  }
  await pool.query(`UPDATE ${c.tabla} SET stock_minimo = ? WHERE id = ?`, [redondear(n), req.params.id]);
  res.json({ ok: true });
}));

export default router;

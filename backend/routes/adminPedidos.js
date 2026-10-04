import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { estado_pago, estado, tipo_pedido } = req.query;
  const conditions = [];
  const params = [];

  if (estado_pago) { conditions.push("estado_pago = ?"); params.push(estado_pago); }
  if (estado) { conditions.push("estado = ?"); params.push(estado); }
  if (tipo_pedido) { conditions.push("tipo_pedido = ?"); params.push(tipo_pedido); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT * FROM orders ${where} ORDER BY creado_en DESC`,
    params
  );
  res.json(rows);
});

router.get("/:id", requireAuth, async (req, res) => {
  const [[order]] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [req.params.id]);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });

  const [items] = await pool.query(`SELECT * FROM order_items WHERE order_id = ?`, [req.params.id]);
  res.json({ ...order, items });
});

router.patch("/:id/pago", requireAuth, async (req, res) => {
  const { estado_pago } = req.body;
  if (!["aprobado", "pendiente", "rechazado"].includes(estado_pago)) {
    return res.status(400).json({ error: "estado_pago inválido." });
  }
  await pool.query(`UPDATE orders SET estado_pago = ? WHERE id = ?`, [estado_pago, req.params.id]);
  res.json({ ok: true });
});

router.patch("/:id/estado", requireAuth, async (req, res) => {
  const { estado } = req.body;
  const validos = ["recibido", "en_preparacion", "listo", "entregado", "cancelado"];
  if (!validos.includes(estado)) return res.status(400).json({ error: "estado inválido." });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query(`SELECT estado FROM orders WHERE id = ? FOR UPDATE`, [req.params.id]);
    if (!order) { await conn.rollback(); return res.status(404).json({ error: "Pedido no encontrado." }); }

    // solo devolver si pasa a cancelado por primera vez
    if (estado === "cancelado" && order.estado !== "cancelado") {
      const [items] = await conn.query(
        `SELECT oi.product_id, oi.qty FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ? AND p.tipo_pedido = 'stock'`, [req.params.id]);
      for (const it of items) {
        await conn.query(`UPDATE products SET stock = stock + ? WHERE id = ?`, [it.qty, it.product_id]);
        await conn.query(
          `INSERT INTO stock_movements (product_id, tipo, cantidad, order_id) VALUES (?, 'devolucion', ?, ?)`,
          [it.product_id, it.qty, req.params.id]);
      }
    }

    await conn.query(`UPDATE orders SET estado = ? WHERE id = ?`, [estado, req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el estado." });
  } finally {
    conn.release();
  }
});

export default router;
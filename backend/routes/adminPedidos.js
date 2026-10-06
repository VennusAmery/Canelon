import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();


router.get("/resumen", requireAuth, async (req, res) => {
  const [[r]] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(estado IN ('recibido','en_preparacion')) AS por_realizar,
      SUM(estado = 'listo') AS realizados_sin_entregar,
      SUM(estado = 'entregado') AS entregados,
      SUM(estado IN ('recibido','en_preparacion','listo')) AS faltan_entregar,
      SUM(pago_completo = 1) AS pagos_completos,
      SUM(pago_completo = 0) AS saldo_pendiente,
      SUM(CASE WHEN pago_completo = 0 THEN total - monto_anticipo ELSE 0 END) AS saldo_por_cobrar
    FROM orders
    WHERE estado <> 'cancelado'
  `);

  const out = {};
  for (const k of Object.keys(r)) out[k] = Number(r[k] ?? 0);
  res.json(out);
});

router.get("/", requireAuth, async (req, res) => {
  const { estado_pago, estado, tipo_pedido, pago_completo } = req.query;
  const conditions = [];
  const params = [];

  if (estado_pago) { conditions.push("estado_pago = ?"); params.push(estado_pago); }
  if (estado) { conditions.push("estado IN (?)"); params.push(estado.split(",")); }
  if (tipo_pedido) { conditions.push("tipo_pedido = ?"); params.push(tipo_pedido); }
  if (pago_completo === "1" || pago_completo === "0") {
    conditions.push("pago_completo = ?");
    params.push(Number(pago_completo));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [orders] = await pool.query(
    `SELECT * FROM orders ${where} ORDER BY fecha_entrega ASC, creado_en DESC`,
    params
  );

  // Productos de cada pedido (una sola consulta extra)
  if (orders.length > 0) {
    const [items] = await pool.query(
      `SELECT order_id, nombre, qty FROM order_items WHERE order_id IN (?)`,
      [orders.map((o) => o.id)]
    );
    for (const o of orders) {
      o.items = items.filter((i) => i.order_id === o.id);
    }
  }

  res.json(orders);
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

// NUEVO: registrar que el cliente ya pagó el saldo restante
router.patch("/:id/pago-completo", requireAuth, async (req, res) => {
  const { pago_completo } = req.body;
  await pool.query(`UPDATE orders SET pago_completo = ? WHERE id = ?`, [
    pago_completo ? 1 : 0,
    req.params.id,
  ]);
  res.json({ ok: true });
});

router.patch("/:id/estado", requireAuth, async (req, res) => {
  const { estado } = req.body;
  const validos = ["recibido", "en_preparacion", "listo", "entregado", "cancelado"];
  if (!validos.includes(estado)) {
    return res.status(400).json({ error: "estado inválido." });
  }
  await pool.query(`UPDATE orders SET estado = ? WHERE id = ?`, [estado, req.params.id]);
  res.json({ ok: true });
});

export default router;
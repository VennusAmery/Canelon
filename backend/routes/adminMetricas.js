import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/ventas", requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT estado_pago, SUM(total) AS monto, COUNT(*) AS pedidos
    FROM orders
    WHERE estado_pago IN ('aprobado', 'pendiente')
    GROUP BY estado_pago
  `);
  res.json(rows);
});

router.get("/tipo-pedido", requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT tipo_pedido, COUNT(*) AS cantidad FROM orders GROUP BY tipo_pedido
  `);
  res.json(rows);
});

router.get("/top-productos", requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT nombre, SUM(qty) AS unidades_vendidas
    FROM order_items GROUP BY nombre ORDER BY unidades_vendidas DESC LIMIT 10
  `);
  res.json(rows);
});

router.get("/demanda-horas", requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT HOUR(creado_en) AS hora, COUNT(*) AS pedidos
    FROM orders GROUP BY hora ORDER BY hora
  `);
  res.json(rows);
});

router.get("/demanda-dias", requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT DAYNAME(creado_en) AS dia, COUNT(*) AS pedidos
    FROM orders GROUP BY dia
    ORDER BY FIELD(dia, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')
  `);
  res.json(rows);
});

export default router;
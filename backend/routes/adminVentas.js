import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// KPIs generales
router.get("/resumen", requireAuth, async (req, res) => {
  const [[resumen]] = await pool.query(`
    SELECT
      COUNT(*) AS total_ordenes,
      SUM(cantidad) AS total_unidades,
      SUM(cantidad * precio_unitario) AS ventas_productos,
      SUM(costo_envio) AS total_envio,
      SUM(total) AS ingresos_totales,
      ROUND(AVG(total), 2) AS ticket_promedio
    FROM ventas_historicas
  `);
  res.json(resumen);
});

// Ventas agrupadas por categoría
router.get("/por-categoria", requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT categoria, COUNT(*) AS ordenes, SUM(total) AS ingresos
    FROM ventas_historicas
    GROUP BY categoria
    ORDER BY ingresos DESC
  `);
  res.json(rows);
});

// Ventas agrupadas por metodo de pago
router.get("/por-metodo-pago", requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT metodo_pago, COUNT(*) AS ordenes, SUM(total) AS ingresos
    FROM ventas_historicas
    GROUP BY metodo_pago
    ORDER BY ingresos DESC
  `);
  res.json(rows);
});

// Ventas agrupadas por estado del pedido
router.get("/por-estado", requireAuth, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT estado_pedido, COUNT(*) AS ordenes
    FROM ventas_historicas
    GROUP BY estado_pedido
  `);
  res.json(rows);
});

// Lista paginada de ventas individuales
router.get("/", requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT * FROM ventas_historicas ORDER BY codigo_venta LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json(rows);
});

export default router;
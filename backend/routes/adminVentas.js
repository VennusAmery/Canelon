import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// El dashboard suma dos fuentes:
//  - ventas_historicas: los 500 registros simulados (seed de ventas)
//  - orders / order_items: los pedidos reales hechos desde la tienda
// Los pedidos cancelados o con pago rechazado no cuentan.
const VALIDO = "o.estado <> 'cancelado' AND o.estado_pago <> 'rechazado'";

// Unifica nombres de categoría entre el menú ("Pies") y el histórico ("Pie")
const CATEGORIA = { Pies: "Pie" };
const normCategoria = (c) => CATEGORIA[c] || c || "Otros";

// Estados de orders -> estados que usa el histórico
const ESTADO = {
  recibido: "Pendiente",
  en_preparacion: "En Preparación",
  listo: "En Preparación",
  entregado: "Entregado",
};

// Suma filas de ambas fuentes que comparten la misma clave
function fusionar(filas, clave, campos) {
  const acc = new Map();
  for (const f of filas) {
    const k = f[clave];
    if (!acc.has(k)) {
      acc.set(k, { [clave]: k, ...Object.fromEntries(campos.map((c) => [c, 0])) });
    }
    const fila = acc.get(k);
    for (const c of campos) fila[c] += Number(f[c] || 0);
  }
  return [...acc.values()];
}

// KPIs generales
router.get("/resumen", requireAuth, async (req, res) => {
  const [[h]] = await pool.query(`
    SELECT
      COUNT(*) AS ordenes,
      COALESCE(SUM(cantidad), 0) AS unidades,
      COALESCE(SUM(cantidad * precio_unitario), 0) AS ventas_productos,
      COALESCE(SUM(costo_envio), 0) AS envio,
      COALESCE(SUM(total), 0) AS ingresos
    FROM ventas_historicas
  `);

  const [[o]] = await pool.query(`
    SELECT COUNT(*) AS ordenes, COALESCE(SUM(o.total), 0) AS ingresos
    FROM orders o
    WHERE ${VALIDO}
  `);

  const [[u]] = await pool.query(`
    SELECT COALESCE(SUM(oi.qty), 0) AS unidades
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE ${VALIDO}
  `);

  const total_ordenes = Number(h.ordenes) + Number(o.ordenes);
  const ingresos_totales = Number(h.ingresos) + Number(o.ingresos);

  res.json({
    total_ordenes,
    total_unidades: Number(h.unidades) + Number(u.unidades),
    ventas_productos: Number(h.ventas_productos) + Number(o.ingresos),
    total_envio: Number(h.envio),
    ingresos_totales,
    ticket_promedio: total_ordenes
      ? Math.round((ingresos_totales / total_ordenes) * 100) / 100
      : 0,
  });
});

// Ventas agrupadas por categoría
router.get("/por-categoria", requireAuth, async (req, res) => {
  const [hist] = await pool.query(`
    SELECT categoria, COUNT(*) AS ordenes, SUM(total) AS ingresos
    FROM ventas_historicas
    GROUP BY categoria
  `);

  const [reales] = await pool.query(`
    SELECT p.categoria, COUNT(DISTINCT o.id) AS ordenes, SUM(oi.precio * oi.qty) AS ingresos
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE ${VALIDO}
    GROUP BY p.categoria
  `);

  const filas = [...hist, ...reales].map((f) => ({
    ...f,
    categoria: normCategoria(f.categoria),
  }));

  res.json(
    fusionar(filas, "categoria", ["ordenes", "ingresos"]).sort(
      (a, b) => b.ingresos - a.ingresos
    )
  );
});

// Ventas agrupadas por método de pago
router.get("/por-metodo-pago", requireAuth, async (req, res) => {
  const [hist] = await pool.query(`
    SELECT metodo_pago, COUNT(*) AS ordenes, SUM(total) AS ingresos
    FROM ventas_historicas
    GROUP BY metodo_pago
  `);

  // El checkout de la tienda siempre es con tarjeta
  const [[tarjeta]] = await pool.query(`
    SELECT COUNT(*) AS ordenes, COALESCE(SUM(o.total), 0) AS ingresos
    FROM orders o
    WHERE ${VALIDO}
  `);

  const filas = [...hist];
  if (Number(tarjeta.ordenes) > 0) {
    filas.push({ metodo_pago: "Tarjeta de Crédito", ...tarjeta });
  }

  res.json(
    fusionar(filas, "metodo_pago", ["ordenes", "ingresos"]).sort(
      (a, b) => b.ingresos - a.ingresos
    )
  );
});

// Ventas agrupadas por estado del pedido
router.get("/por-estado", requireAuth, async (req, res) => {
  const [hist] = await pool.query(`
    SELECT estado_pedido, COUNT(*) AS ordenes
    FROM ventas_historicas
    GROUP BY estado_pedido
  `);

  const [reales] = await pool.query(`
    SELECT o.estado, COUNT(*) AS ordenes
    FROM orders o
    WHERE ${VALIDO}
    GROUP BY o.estado
  `);

  const filas = [
    ...hist,
    ...reales.map((r) => ({
      estado_pedido: ESTADO[r.estado] || r.estado,
      ordenes: r.ordenes,
    })),
  ];

  res.json(fusionar(filas, "estado_pedido", ["ordenes"]));
});

// Lista paginada de ventas individuales (solo histórico)
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
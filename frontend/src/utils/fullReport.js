//frontend/src/utils/fullreport.js
import { API_ORIGIN } from "../api/client.js";
import { buildBreakEvenReport } from "./breakEvenReport.js";

const get = (path) => {
  const token = localStorage.getItem("admin_token");
  return fetch(`${API_ORIGIN}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json())
    .catch(() => null);
};

const MONEY = new Set([
  "total", "precio", "precio_unitario", "precio_extra", "costo_envio",
  "monto", "monto_anticipo", "ingresos",
]);
const pretty = (k) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const fmtVal = (v, k) => {
  if (typeof v !== "string") return v;
  if (k.startsWith("fecha_")) return v.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("es-GT");
  return v;
};

function auto(title, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  return {
    title,
    columns: keys.map((k) => ({ header: pretty(k), key: k, money: MONEY.has(k) })),
    rows: rows.map((r) => Object.fromEntries(keys.map((k) => [k, fmtVal(r[k], k)]))),
  };
}

export async function buildFullReport() {
const [db, stockProd, stockIng, resumen, porCat, porPago, porEstado, eq] = await Promise.all([
  get("/api/admin/export"),
  get("/api/admin/stock/productos"),
  get("/api/admin/stock/ingredientes"),
  get("/api/admin/ventas/resumen"),
  get("/api/admin/ventas/por-categoria"),
  get("/api/admin/ventas/por-metodo-pago"),
  get("/api/admin/ventas/por-estado"),
  buildBreakEvenReport().catch((e) => { console.error(e); return null; }),
]);
  if (!db || db.error) throw new Error("No se pudo leer la base de datos.");

  // Top productos vendidos (pedidos de la web)
  const top = Object.entries(
    (db.order_items || []).reduce((a, i) => {
      a[i.nombre] = (a[i.nombre] || 0) + Number(i.qty);
      return a;
    }, {})
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const cf = (db.costos_fijos || []).reduce((s, c) => s + Number(c.monto), 0);

  return {
    filename: "canelon_base_de_datos_completa",
    title: "Base de datos completa",
    subtitle: "Exportación integral de la información del negocio",
    pdfMaxRows: 150,
   kpis: [
  { label: "Órdenes históricas", value: resumen?.total_ordenes ?? "—" },
  { label: "Ingresos históricos", value: `Q${resumen?.ingresos_totales ?? 0}` },
  { label: "Pedidos de la web", value: (db.orders || []).length },
  { label: "Productos en catálogo", value: (db.products || []).length },
  { label: "Costos fijos / mes", value: `Q${cf.toFixed(2)}` },
  // análisis de punto de equilibrio
  ...(eq?.kpis || []).filter((k) =>
    ["Margen de contribución", "PE en ventas / mes", "Estado del mes"].includes(k.label)
  ),
],
charts: [
  { type: "bar", title: "Ingresos por categoría", prefix: "Q",
    data: (porCat || []).map((c) => ({ label: c.categoria, value: Number(c.ingresos) })) },
  { type: "pie", title: "Métodos de pago",
    data: (porPago || []).map((c) => ({ label: c.metodo_pago, value: Number(c.ordenes) })) },
  { type: "pie", title: "Estado de los pedidos",
    data: (porEstado || []).map((c) => ({ label: c.estado_pedido, value: Number(c.ordenes) })) },
  { type: "bar", title: "Productos más vendidos (web)", data: top },
  // gráficas de punto de equilibrio
  ...(eq?.charts || []),
],
sections: [
  auto("Pedidos web", db.orders),
  auto("Detalle de pedidos", db.order_items),
  auto("Ventas históricas", db.ventas_historicas),
  auto("Productos", db.products),
  auto("Variantes", db.product_variants),
  auto("Opciones", db.product_options),
  auto("Stock de productos", Array.isArray(stockProd) ? stockProd : []),
  auto("Stock de ingredientes", Array.isArray(stockIng) ? stockIng : []),
  auto("Puntos de clientes", db.puntos_clientes),
  // Costos fijos + Resultado del mes + Historial (reemplaza a auto("Costos fijos", ...))
  ...(eq?.sections || [auto("Costos fijos", db.costos_fijos)]),
].filter(Boolean),
  };
}
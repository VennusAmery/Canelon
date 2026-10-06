import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const DIA_MS = 24 * 60 * 60 * 1000;

function clasificar(o) {
  const entrega = o.fecha_entrega ? new Date(o.fecha_entrega) : null;
  const diasParaEntrega = entrega ? (entrega - Date.now()) / DIA_MS : null;
  const pendienteDeEntrega = !["entregado", "cancelado", "listo"].includes(o.estado);

  if (o.estado_pago === "rechazado")
    return { tipo: "error", fuente: "Pago", titulo: "Pago rechazado", detalle: `El anticipo de ${o.cliente} fue rechazado.` };
  if (o.estado === "cancelado")
    return { tipo: "error", fuente: "Pedido", titulo: "Pedido cancelado", detalle: `El pedido de ${o.cliente} fue cancelado.` };

  if (o.estado_pago === "pendiente")
    return { tipo: "warning", fuente: "Pago", titulo: "Pago pendiente de validar", detalle: `Revisa el comprobante de ${o.cliente}.` };
  if (pendienteDeEntrega && diasParaEntrega !== null && diasParaEntrega <= 3)
    return { tipo: "warning", fuente: "Entrega", titulo: "Entrega próxima", detalle: `El pedido de ${o.cliente} se entrega el ${entrega.toLocaleDateString("es-GT")}.` };

  if (o.estado === "entregado")
    return { tipo: "success", fuente: "Entrega", titulo: "Pedido entregado", detalle: `Pedido de ${o.cliente} entregado.` };

  const titulos = { recibido: "Nuevo pedido recibido", en_preparacion: "Pedido en preparación", listo: "Pedido listo para entregar" };
  return { tipo: "information", fuente: "Pedido", titulo: titulos[o.estado] || "Pedido", detalle: `Cliente: ${o.cliente} · Q${o.total}` };
}

router.get("/", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, cliente, total, estado, estado_pago, fecha_entrega, creado_en
     FROM orders ORDER BY creado_en DESC LIMIT 200`
  );

  const notificaciones = rows.map((o) => ({
    id: o.id,
    estado: o.estado,
    creado_en: o.creado_en,
    ...clasificar(o),
  }));

  res.json(notificaciones);
});

export default router;
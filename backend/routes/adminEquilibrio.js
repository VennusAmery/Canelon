import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const [costos] = await pool.query("SELECT id, concepto, monto FROM costos_fijos ORDER BY id");
  const [[cfg]] = await pool.query("SELECT valor FROM config_negocio WHERE clave = 'cvu_porcentaje'");
  const [[hist]] = await pool.query(
    "SELECT SUM(cantidad * precio_unitario) AS ventas, SUM(cantidad) AS unidades FROM ventas_historicas"
  );
  const [[mes]] = await pool.query(`
    SELECT COALESCE(SUM(total), 0) AS ventas FROM orders
    WHERE estado_pago = 'aprobado'
      AND YEAR(creado_en) = YEAR(NOW()) AND MONTH(creado_en) = MONTH(NOW())
  `);

  const cf = costos.reduce((s, c) => s + Number(c.monto), 0);
  const cvuPct = Number(cfg?.valor ?? 40);
  const pvu = hist.unidades ? Number(hist.ventas) / Number(hist.unidades) : 0;
  const cvu = (pvu * cvuPct) / 100;
  const margenUnit = pvu - cvu;                 // PVU - CVU
  const margenRatio = pvu ? margenUnit / pvu : 0; // (PVU - CVU) / PVU

  const peUnidades = margenUnit > 0 ? cf / margenUnit : null;
  const peVentas = margenRatio > 0 ? cf / margenRatio : null;
  const ventasMes = Number(mes.ventas);

  res.json({
    costos,
    cf,
    cvu_porcentaje: cvuPct,
    pvu: +pvu.toFixed(2),
    cvu: +cvu.toFixed(2),
    margen_contribucion: +(margenRatio * 100).toFixed(1),
    pe_unidades: peUnidades && Math.ceil(peUnidades),
    pe_ventas: peVentas && +peVentas.toFixed(2),
    ventas_mes: ventasMes,
    faltante: peVentas ? Math.max(0, +(peVentas - ventasMes).toFixed(2)) : null,
    alcanzado: peVentas ? ventasMes >= peVentas : false,
  });
});

router.post("/costos", requireAuth, async (req, res) => {
  const { concepto, monto } = req.body;
  if (!concepto || !(Number(monto) > 0)) {
    return res.status(400).json({ error: "Concepto y monto válido son requeridos." });
  }
  await pool.query("INSERT INTO costos_fijos (concepto, monto) VALUES (?, ?)", [concepto, monto]);
  res.json({ ok: true });
});

router.delete("/costos/:id", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM costos_fijos WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

router.put("/config", requireAuth, async (req, res) => {
  const pct = Number(req.body.cvu_porcentaje);
  if (!(pct >= 0 && pct < 100)) return res.status(400).json({ error: "Porcentaje inválido." });
  await pool.query(
    "INSERT INTO config_negocio (clave, valor) VALUES ('cvu_porcentaje', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
    [String(pct)]
  );
  res.json({ ok: true });
});

export default router;
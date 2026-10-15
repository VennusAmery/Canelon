import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ---------- Constantes únicas (antes estaban repartidas y no coincidían) ----------
const CVU_DEFAULT = 35;          // % costo variable por defecto
const TOLERANCIA_DEFAULT = 200;  // Q de tolerancia para "Justo en el nivel"
const TZ_DB = "+00:00";          // zona horaria en que MySQL guarda creado_en
const TZ_LOCAL = "-06:00";       // Guatemala (UTC-6, sin horario de verano)

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  });

const round2 = (n) => +Number(n).toFixed(2);

// "Hoy" en hora de Guatemala, sin depender de la zona del servidor
function hoyGT() {
  const d = new Date(Date.now() - 6 * 3600 * 1000);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}
const esFuturo = (anio, mes) => {
  const h = hoyGT();
  return anio > h.anio || (anio === h.anio && mes > h.mes);
};
const esPasado = (anio, mes) => {
  const h = hoyGT();
  return anio < h.anio || (anio === h.anio && mes < h.mes);
};

async function getConfig(clave, def) {
  const [[r]] = await pool.query("SELECT valor FROM config_negocio WHERE clave = ?", [clave]);
  return Number(r?.valor ?? def);
}
const getTolerancia = () => getConfig("tolerancia", TOLERANCIA_DEFAULT);
const getCvuPct = () => getConfig("cvu_porcentaje", CVU_DEFAULT);

async function snapshotActual() {
  const [costos] = await pool.query("SELECT monto FROM costos_fijos");
  return {
    cf: costos.reduce((s, c) => s + Number(c.monto), 0),
    cvuPct: await getCvuPct(),
  };
}

// ---------- ÚNICA definición de "ventas del mes" ----------
// Base devengada: total de pedidos no cancelados cuyo pago fue aprobado (anticipo recibido)
// o que ya se entregaron. Mes calculado en hora de Guatemala.
async function ventasDesdeOrders(anio, mes) {
  const f = "CONVERT_TZ(creado_en, ?, ?)";
  const [[r]] = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS ventas
     FROM orders
     WHERE estado <> 'cancelado'
       AND estado_pago <> 'rechazado'
       AND YEAR(${f}) = ? AND MONTH(${f}) = ?`,
    [TZ_DB, TZ_LOCAL, anio, TZ_DB, TZ_LOCAL, mes]
  );
  return Number(r.ventas);
}

// Mismas fórmulas del Excel (columnas D a H)
function calcular({ ventas, cf, cvuPct }, tol) {
  const cvt = ventas * cvuPct / 100;
  const ct = cf + cvt;
  if (!(cvuPct < 100)) {
    return { cvt: round2(cvt), ct: round2(ct), pe: null, diferencia: null, estado: "Sin datos" };
  }
  const pe = cf / (1 - cvuPct / 100);
  const dif = ventas - pe;
  let estado = "Sobre el nivel";
  if (dif < -tol) estado = "Bajo el nivel";
  else if (Math.abs(dif) <= tol) estado = "Justo en el nivel";
  return { cvt: round2(cvt), ct: round2(ct), pe: round2(pe), diferencia: round2(dif), estado };
}

// ---------- Historial ----------
router.get("/historial", requireAuth, wrap(async (req, res) => {
  const h = hoyGT();
  const anio = Number(req.query.anio) || h.anio;
  const tol = await getTolerancia();

  const [rows] = await pool.query(
    "SELECT * FROM equilibrio_historial WHERE anio = ? ORDER BY mes", [anio]
  );

  // El mes en curso es automático: una fila sin cerrar de ese mes no se muestra
  const meses = rows
    .filter((r) => r.cerrado || !(anio === h.anio && r.mes === h.mes))
    .map((r) => {
      const base = { ventas: Number(r.ventas), cf: Number(r.cf), cvuPct: Number(r.cvu_porcentaje) };
      return {
        anio: r.anio, mes: r.mes, etiqueta: MESES[r.mes - 1].slice(0, 3),
        nombre: `${MESES[r.mes - 1]} ${r.anio}`,
        ventas: base.ventas, cf: base.cf, cvu_porcentaje: base.cvuPct,
        observaciones: r.observaciones, cerrado: !!r.cerrado, editable: true,
        ...calcular(base, tol),
      };
    });

  let actual = null;
  const yaCerrado = meses.some((m) => m.mes === h.mes && m.cerrado);
  if (anio === h.anio && !yaCerrado) {
    const snap = await snapshotActual();
    const ventas = await ventasDesdeOrders(anio, h.mes);
    const calc = calcular({ ventas, cf: snap.cf, cvuPct: snap.cvuPct }, tol);
    const diasMes = new Date(anio, h.mes, 0).getDate();
    const diasRestantes = diasMes - h.dia;
    actual = {
      anio, mes: h.mes, etiqueta: MESES[h.mes - 1].slice(0, 3),
      nombre: `${MESES[h.mes - 1]} ${anio} (al ${h.dia}/${h.mes})`,
      ventas, cf: snap.cf, cvu_porcentaje: snap.cvuPct, ...calc,
      observaciones: null, cerrado: false, editable: false,
      ritmo_actual: round2(ventas / h.dia),
      ritmo_requerido: calc.pe != null && diasRestantes > 0
        ? round2(Math.max(0, calc.pe - ventas) / diasRestantes) : null,
      dias_restantes: diasRestantes,
    };
  }
  res.json({ meses, actual });
}));

// Editar/crear manualmente un mes PASADO (o ya cerrado). El mes en curso es automático.
router.put("/historial/:anio/:mes", requireAuth, wrap(async (req, res) => {
  const anio = Number(req.params.anio);
  const mes = Number(req.params.mes);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({ error: "Año o mes inválido." });
  }
  const { ventas, observaciones, cf, cvu_porcentaje } = req.body;
  if (!(Number(ventas) >= 0)) return res.status(400).json({ error: "Ventas inválidas." });
  if (cf != null && !(Number(cf) >= 0)) return res.status(400).json({ error: "Costos fijos inválidos." });
  if (cvu_porcentaje != null && !(Number(cvu_porcentaje) >= 0 && Number(cvu_porcentaje) < 100)) {
    return res.status(400).json({ error: "El porcentaje debe estar entre 0 y 99." });
  }

  const [[ex]] = await pool.query(
    "SELECT * FROM equilibrio_historial WHERE anio = ? AND mes = ?", [anio, mes]
  );
  if (!esPasado(anio, mes) && !ex?.cerrado) {
    return res.status(400).json({
      error: "El mes en curso se calcula automáticamente. Ciérralo para poder editarlo.",
    });
  }

  const snap = await snapshotActual();
  await pool.query(
    `INSERT INTO equilibrio_historial (anio, mes, ventas, cf, cvu_porcentaje, observaciones, cerrado)
     VALUES (?, ?, ?, ?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE ventas = VALUES(ventas), cf = VALUES(cf),
       cvu_porcentaje = VALUES(cvu_porcentaje), observaciones = VALUES(observaciones), cerrado = TRUE`,
    [
      anio, mes, Number(ventas),
      cf != null ? Number(cf) : (ex ? Number(ex.cf) : snap.cf),
      cvu_porcentaje != null ? Number(cvu_porcentaje) : (ex ? Number(ex.cvu_porcentaje) : snap.cvuPct),
      observaciones ?? ex?.observaciones ?? null,
    ]
  );
  res.json({ ok: true });
}));

// Cerrar un mes: congela ventas reales de orders + CF y % de ese momento
router.post("/historial/cerrar", requireAuth, wrap(async (req, res) => {
  const anio = Number(req.body.anio);
  const mes = Number(req.body.mes);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({ error: "Año o mes inválido." });
  }
  if (esFuturo(anio, mes)) {
    return res.status(400).json({ error: "No puedes cerrar un mes futuro." });
  }
  const [[ex]] = await pool.query(
    "SELECT cerrado FROM equilibrio_historial WHERE anio = ? AND mes = ?", [anio, mes]
  );
  if (ex?.cerrado) {
    return res.status(409).json({ error: "Ese mes ya está cerrado. Puedes editarlo manualmente." });
  }

  const snap = await snapshotActual();
  const ventas = await ventasDesdeOrders(anio, mes);
  await pool.query(
    `INSERT INTO equilibrio_historial (anio, mes, ventas, cf, cvu_porcentaje, observaciones, cerrado)
     VALUES (?, ?, ?, ?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE ventas = VALUES(ventas), cf = VALUES(cf),
       cvu_porcentaje = VALUES(cvu_porcentaje), observaciones = VALUES(observaciones), cerrado = TRUE`,
    [anio, mes, ventas, snap.cf, snap.cvuPct, req.body.observaciones || null]
  );
  res.json({ ok: true, ventas });
}));

// ---------- Tarjeta principal ----------
router.get("/", requireAuth, wrap(async (req, res) => {
  const h = hoyGT();
  const [costos] = await pool.query("SELECT id, concepto, monto FROM costos_fijos ORDER BY id");
  const [[hist]] = await pool.query(
    "SELECT SUM(cantidad * precio_unitario) AS ventas, SUM(cantidad) AS unidades FROM ventas_historicas"
  );

  const cf = costos.reduce((s, c) => s + Number(c.monto), 0);
  const cvuPct = await getCvuPct();
  const pvu = hist.unidades ? Number(hist.ventas) / Number(hist.unidades) : 0;
  const cvu = (pvu * cvuPct) / 100;
  const margenUnit = pvu - cvu;
  const margenRatio = pvu ? margenUnit / pvu : 0;

  const peUnidades = margenUnit > 0 ? cf / margenUnit : null;
  const peVentas = margenRatio > 0 ? cf / margenRatio : null;
  const ventasMes = await ventasDesdeOrders(h.anio, h.mes); // misma función que el historial

  res.json({
    costos, cf, cvu_porcentaje: cvuPct,
    pvu: round2(pvu), cvu: round2(cvu),
    margen_contribucion: +(margenRatio * 100).toFixed(1),
    pe_unidades: peUnidades != null ? Math.ceil(peUnidades) : null,
    pe_ventas: peVentas != null ? round2(peVentas) : null,
    ventas_mes: ventasMes,
    faltante: peVentas != null ? Math.max(0, round2(peVentas - ventasMes)) : null,
    alcanzado: peVentas != null ? ventasMes >= peVentas : false,
  });
}));

router.post("/costos", requireAuth, wrap(async (req, res) => {
  const { concepto, monto } = req.body;
  if (!concepto || !(Number(monto) > 0)) {
    return res.status(400).json({ error: "Concepto y monto válido son requeridos." });
  }
  await pool.query("INSERT INTO costos_fijos (concepto, monto) VALUES (?, ?)", [concepto, Number(monto)]);
  res.json({ ok: true });
}));

router.delete("/costos/:id", requireAuth, wrap(async (req, res) => {
  await pool.query("DELETE FROM costos_fijos WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
}));

router.put("/config", requireAuth, wrap(async (req, res) => {
  const pct = Number(req.body.cvu_porcentaje);
  if (!(pct >= 0 && pct < 100)) return res.status(400).json({ error: "Porcentaje inválido." });
  await pool.query(
    "INSERT INTO config_negocio (clave, valor) VALUES ('cvu_porcentaje', ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
    [String(pct)]
  );
  res.json({ ok: true });
}));

export default router;
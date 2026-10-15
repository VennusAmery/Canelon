import { eqApi, fmtQ } from "../api/equilibrio.js";

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export async function buildBreakEvenReport(anio = new Date().getFullYear()) {
  const [d, h] = await Promise.all([
    eqApi(""),
    eqApi(`/historial?anio=${anio}`),
  ]);

  const filas = h?.actual ? [...(h.meses || []), h.actual] : h?.meses || [];

  const estado =
    d.pe_ventas == null
      ? "Sin datos"
      : d.alcanzado
        ? "Superado"
        : `Faltan ${fmtQ(d.faltante)}`;

  return {
    filename: `canelon_punto_de_equilibrio_${anio}`,
    title: "Punto de equilibrio",
    subtitle: `Costos fijos, resultado mensual e historial ${anio}`,
    pdfMaxRows: 150,
    kpis: [
      { label: "Costos fijos / mes", value: fmtQ(d.cf) },
      { label: "Margen de contribución", value: `${d.margen_contribucion}%` },
      { label: "PE en ventas / mes", value: fmtQ(d.pe_ventas) },
      { label: "PE en unidades", value: d.pe_unidades ?? "—" },
      { label: "Ventas del mes", value: fmtQ(d.ventas_mes) },
      { label: "Estado del mes", value: estado },
    ],
    charts: [
      {
        type: "bar",
        title: "Ventas del mes vs. punto de equilibrio",
        prefix: "Q",
        data: [
          { label: "Ventas del mes", value: Number(d.ventas_mes) || 0 },
          { label: "Punto de equilibrio", value: Number(d.pe_ventas) || 0 },
        ],
      },
      {
        type: "bar",
        title: `Ventas por mes ${anio}`,
        prefix: "Q",
        data: filas.map((f) => ({ label: f.etiqueta, value: Number(f.ventas) || 0 })),
      },
    ],
    sections: [
      {
        title: "Costos fijos",
        columns: [
          { header: "Concepto", key: "concepto", money: false },
          { header: "Monto", key: "monto", money: true },
        ],
        rows: [
          ...d.costos.map((c) => ({ concepto: c.concepto, monto: Number(c.monto) })),
          { concepto: "Total costos fijos", monto: Number(d.cf) },
        ],
      },
      {
        title: "Resultado del mes",
        columns: [
          { header: "Indicador", key: "k", money: false },
          { header: "Valor", key: "v", money: false },
        ],
        rows: [
          { k: "PVU promedio", v: fmtQ(d.pvu) },
          { k: "CVU", v: fmtQ(d.cvu) },
          { k: "Costo variable (% del precio)", v: `${d.cvu_porcentaje}%` },
          { k: "Margen de contribución", v: `${d.margen_contribucion}%` },
          { k: "PE en ventas", v: fmtQ(d.pe_ventas) },
          { k: "PE en unidades", v: d.pe_unidades ?? "—" },
          { k: "Ventas del mes", v: fmtQ(d.ventas_mes) },
          { k: "Ritmo actual por día", v: h?.actual ? fmtQ(h.actual.ritmo_actual) : "—" },
          { k: "Necesitas por día", v: h?.actual?.ritmo_requerido != null ? fmtQ(h.actual.ritmo_requerido) : "—" },
          { k: "Días restantes", v: h?.actual?.dias_restantes ?? "—" },
          { k: "Estado", v: estado },
        ],
      },
      {
        title: `Historial ${anio}`,
        columns: [
          { header: "Mes", key: "mes", money: false },
          { header: "Ventas", key: "ventas", money: true },
          { header: "CF", key: "cf", money: true },
          { header: "CVT", key: "cvt", money: true },
          { header: "CT", key: "ct", money: true },
          { header: "PE", key: "pe", money: true },
          { header: "Diferencia", key: "diferencia", money: true },
          { header: "Estado", key: "estado", money: false },
          { header: "Observación", key: "observaciones", money: false },
        ],
        rows: filas.map((f) => ({
          mes: f.nombre,
          ventas: num(f.ventas),
          cf: num(f.cf),
          cvt: num(f.cvt),
          ct: num(f.ct),
          pe: num(f.pe),
          diferencia: num(f.diferencia),
          estado: f.estado,
          observaciones: f.observaciones || "",
        })),
      },
    ],
  };
}
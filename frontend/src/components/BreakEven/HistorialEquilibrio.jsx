import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { eqApi, fmtQ } from "../../api/equilibrio.js";

const COLOR = {
  "Bajo el nivel": "#b5651d",
  "Justo en el nivel": "#e0913c",
  "Sobre el nivel": "#2f7a3f",
  "Sin datos": "#7a6a5c",
};
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const FORM_VACIO = { mes: "", ventas: "", cf: "", cvu_porcentaje: "", observaciones: "" };

export default function HistorialEquilibrio() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null = modal cerrado
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    eqApi(`/historial?anio=${anio}`)
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(e.message));

  useEffect(() => { setData(null); load(); }, [anio]);

  // Cerrar el modal con Escape
  useEffect(() => {
    if (!form) return;
    const onKey = (e) => { if (e.key === "Escape" && !saving) setForm(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form, saving]);

  // Meses ya terminados del año seleccionado (solo esos se pueden agregar a mano)
  const mesesPasados =
    anio < hoy.getFullYear() ? 12 : anio === hoy.getFullYear() ? hoy.getMonth() : 0;

  const abrirNuevo = () => {
    setFormError("");
    setForm({ ...FORM_VACIO });
  };
  const abrirEditar = (f) => {
    setFormError("");
    setForm({
      mes: f.mes, ventas: f.ventas, cf: f.cf, cvu_porcentaje: f.cvu_porcentaje,
      observaciones: f.observaciones || "", edicion: true,
    });
  };
  const cerrarModal = () => { if (!saving) setForm(null); };
  const set = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await eqApi(`/historial/${anio}/${form.mes}`, "PUT", {
        ventas: Number(form.ventas),
        cf: form.cf === "" ? undefined : Number(form.cf),
        cvu_porcentaje: form.cvu_porcentaje === "" ? undefined : Number(form.cvu_porcentaje),
        observaciones: form.observaciones,
      });
      setForm(null);
      await load();
    } catch (err) {
      setFormError(err.message); // el error se muestra dentro del modal
    } finally {
      setSaving(false);
    }
  };

  const cerrar = async (mes) => {
    const obs = window.prompt("Observación del mes (opcional):");
    if (obs === null) return; // canceló
    try {
      await eqApi("/historial/cerrar", "POST", { anio, mes, observaciones: obs });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return error ? <p className="be-error">{error}</p> : null;

  const filas = data.actual ? [...data.meses, data.actual] : data.meses;
  const chart = filas.map((f) => ({ mes: f.etiqueta, Ventas: f.ventas, "Punto de equilibrio": f.pe }));

  return (
    <div className="dash-card dash-card-wide">
      <div className="be-hist-head">
        <h3>Historial mensual {anio}</h3>
        <div className="be-nav">
          <button onClick={() => setAnio(anio - 1)} aria-label="Año anterior">‹</button>
          <button onClick={() => setAnio(anio + 1)} disabled={anio >= hoy.getFullYear()} aria-label="Año siguiente">›</button>
          <button onClick={abrirNuevo} disabled={mesesPasados === 0}>+ Agregar mes manual</button>
        </div>
      </div>

      {error && <p className="be-error">{error}</p>}

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chart}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5d8c3" />
          <XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v) => fmtQ(v)} /><Legend />
          <Bar dataKey="Ventas" fill="#e0913c" radius={[8, 8, 0, 0]} />
          <Line dataKey="Punto de equilibrio" stroke="#3a2a1e" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>

      {data.actual && (
        <p>
          Mes en curso (automático): llevas <strong>{fmtQ(data.actual.ventas)}</strong> ({fmtQ(data.actual.ritmo_actual)}/día).{" "}
          {data.actual.ritmo_requerido == null
            ? "Sin datos para proyectar el resto del mes."
            : <>Para llegar al PE necesitas <strong>{fmtQ(data.actual.ritmo_requerido)}/día</strong> durante los {data.actual.dias_restantes} días restantes.</>}
        </p>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="be-table">
          <thead>
            <tr><th>Mes</th><th>Ventas</th><th>CF</th><th>CVT</th><th>CT</th><th>PE</th><th>Diferencia</th><th>Estado</th><th>Observación</th><th></th></tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={10}>Todavía no hay meses registrados en {anio}.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.mes}>
                <td>{f.nombre}</td>
                <td>{fmtQ(f.ventas)}</td><td>{fmtQ(f.cf)}</td><td>{fmtQ(f.cvt)}</td><td>{fmtQ(f.ct)}</td><td>{fmtQ(f.pe)}</td>
                <td>{fmtQ(f.diferencia)}</td>
                <td style={{ color: COLOR[f.estado], fontWeight: 700 }}>{f.estado}</td>
                <td>{f.observaciones}</td>
                <td>
                  {!f.cerrado && <button onClick={() => cerrar(f.mes)}>Cerrar mes</button>}{" "}
                  {f.editable && <button onClick={() => abrirEditar(f)}>Editar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="be-modal-overlay" onClick={cerrarModal}>
          <div className="be-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="be-modal-close" onClick={cerrarModal} aria-label="Cerrar" type="button">
              <X size={18} />
            </button>

            <h2>{form.edicion ? `Editar ${MESES[form.mes - 1]} ${anio}` : "Agregar mes manual"}</h2>
            <p className="be-modal-sub">
              {form.edicion
                ? "Corrige los datos de este mes cerrado."
                : "Para meses pasados que no pasaron por la web. Si dejas CF o % vacíos se usan los valores actuales."}
            </p>

            <form onSubmit={guardar}>
              <label>
                Mes
                <select value={form.mes} onChange={set("mes")} required disabled={form.edicion}>
                  <option value="">Selecciona un mes…</option>
                  {MESES.slice(0, form.edicion ? 12 : mesesPasados).map((m, i) => (
                    <option key={m} value={i + 1}>{m} {anio}</option>
                  ))}
                </select>
              </label>

              <label>
                Ventas del mes (Q)
                <input type="number" min="0" step="0.01" value={form.ventas} onChange={set("ventas")} required autoFocus />
              </label>

              <div className="be-modal-row">
                <label>
                  Costos fijos (Q)
                  <input type="number" min="0" step="0.01" placeholder="Opcional" value={form.cf} onChange={set("cf")} />
                </label>
                <label>
                  % costo variable
                  <input type="number" min="0" max="99" step="0.1" placeholder="Opcional" value={form.cvu_porcentaje} onChange={set("cvu_porcentaje")} />
                </label>
              </div>

              <label>
                Observación
                <textarea rows={2} value={form.observaciones} onChange={set("observaciones")} />
              </label>

              {formError && <p className="be-modal-error">{formError}</p>}

              <button type="submit" className="be-modal-submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
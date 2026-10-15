import React, { useEffect, useState } from "react";
import { Trash2, Target } from "lucide-react";
import { eqApi, fmtQ } from "../../api/equilibrio.js";
import "./BreakEven.css";
import Loader from "../Loader/Loader.jsx";

export default function BreakEvenCard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [pct, setPct] = useState("");

  const load = () =>
    eqApi("")
      .then((x) => { setD(x); setPct(x.cvu_porcentaje); setError(""); })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    try { await fn(); await load(); } catch (e) { setError(e.message); }
  };

  const addCosto = (e) => {
    e.preventDefault();
    run(async () => {
      await eqApi("/costos", "POST", { concepto, monto });
      setConcepto(""); setMonto("");
    });
  };

if (!d) return error ? <p className="be-error">{error}</p> : <Loader compact />;

  const progreso = d.pe_ventas ? Math.min(100, (d.ventas_mes / d.pe_ventas) * 100) : 0;

  return (
    <div className="dash-card dash-card-wide be-card">
      <h3><Target size={16} /> Punto de equilibrio mensual</h3>
      {error && <p className="be-error">{error}</p>}

      <div className="be-grid">
        <div>
          <h4>Costos fijos mensuales</h4>
          <ul className="be-list">
            {d.costos.map((c) => (
              <li key={c.id}>
                <span>{c.concepto}</span>
                <strong>{fmtQ(c.monto)}</strong>
                <button onClick={() => run(() => eqApi(`/costos/${c.id}`, "DELETE"))} aria-label="Eliminar">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            <li className="be-total"><span>Total CF</span><strong>{fmtQ(d.cf)}</strong></li>
          </ul>

          <form className="be-form" onSubmit={addCosto}>
            <input placeholder="Ej. Alquiler, luz, sueldos" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
            <input type="number" min="1" step="0.01" placeholder="Monto Q" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            <button type="submit">Agregar</button>
          </form>

          <label className="be-cvu">
            Costo variable (% del precio)
            <input type="number" min="0" max="99" value={pct} onChange={(e) => setPct(e.target.value)} />
            <button onClick={() => run(() => eqApi("/config", "PUT", { cvu_porcentaje: pct }))}>Guardar</button>
          </label>
        </div>

        <div>
          <h4>Resultado</h4>
          <p>PVU promedio: <strong>{fmtQ(d.pvu)}</strong> · CVU: <strong>{fmtQ(d.cvu)}</strong></p>
          <p>Margen de contribución: <strong>{d.margen_contribucion}%</strong></p>
          <p className="be-big">Necesitas vender <strong>{fmtQ(d.pe_ventas)}</strong> al mes</p>
          <p>o aprox. <strong>{d.pe_unidades ?? "—"}</strong> unidades para no perder.</p>

          <div className="be-bar"><div style={{ width: `${progreso}%` }} /></div>
          <p>
            Ventas del mes: <strong>{fmtQ(d.ventas_mes)}</strong>{" "}
            {d.pe_ventas == null
              ? "· sin datos suficientes"
              : d.alcanzado
                ? "✅ ¡Ya superaste el punto de equilibrio!"
                : `· faltan ${fmtQ(d.faltante)}`}
          </p>
        </div>
      </div>
    </div>
  );
}
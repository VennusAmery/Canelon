import React, { useEffect, useState } from "react";
import { Trash2, Target } from "lucide-react";
import { API_ORIGIN } from "../../api/client.js";

function api(path, method = "GET", body) {
  const token = localStorage.getItem("admin_token");
  return fetch(`${API_ORIGIN}/api/admin/equilibrio${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());
}

export default function BreakEvenCard() {
  const [d, setD] = useState(null);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [pct, setPct] = useState("");

  const load = () => api("").then((x) => { setD(x); setPct(x.cvu_porcentaje); });
  useEffect(() => { load(); }, []);

  const addCosto = async (e) => {
    e.preventDefault();
    await api("/costos", "POST", { concepto, monto });
    setConcepto(""); setMonto(""); load();
  };

  if (!d) return null;
  const progreso = d.pe_ventas ? Math.min(100, (d.ventas_mes / d.pe_ventas) * 100) : 0;

  return (
    <div className="dash-card dash-card-wide be-card">
      <h3><Target size={16} /> Punto de equilibrio mensual</h3>

      <div className="be-grid">
        <div>
          <h4>Costos fijos mensuales</h4>
          <ul className="be-list">
            {d.costos.map((c) => (
              <li key={c.id}>
                <span>{c.concepto}</span>
                <strong>Q{Number(c.monto).toFixed(2)}</strong>
                <button onClick={() => api(`/costos/${c.id}`, "DELETE").then(load)} aria-label="Eliminar">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            <li className="be-total"><span>Total CF</span><strong>Q{d.cf.toFixed(2)}</strong></li>
          </ul>

          <form className="be-form" onSubmit={addCosto}>
            <input placeholder="Ej. Alquiler, luz, sueldos" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
            <input type="number" min="1" step="0.01" placeholder="Monto Q" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            <button type="submit">Agregar</button>
          </form>

          <label className="be-cvu">
            Costo variable (% del precio)
            <input type="number" min="0" max="99" value={pct} onChange={(e) => setPct(e.target.value)} />
            <button onClick={() => api("/config", "PUT", { cvu_porcentaje: pct }).then(load)}>Guardar</button>
          </label>
        </div>

        <div>
          <h4>Resultado</h4>
          <p>PVU promedio: <strong>Q{d.pvu}</strong> · CVU: <strong>Q{d.cvu}</strong></p>
          <p>Margen de contribución: <strong>{d.margen_contribucion}%</strong></p>
          <p className="be-big">Necesitas vender <strong>Q{d.pe_ventas ?? "—"}</strong> al mes</p>
          <p>o aprox. <strong>{d.pe_unidades ?? "—"}</strong> unidades para no perder.</p>

          <div className="be-bar"><div style={{ width: `${progreso}%` }} /></div>
          <p>
            Ventas del mes: <strong>Q{d.ventas_mes}</strong>{" "}
            {d.alcanzado ? "✅ ¡Ya superaste el punto de equilibrio!" : `· faltan Q${d.faltante ?? "—"}`}
          </p>
        </div>
      </div>
    </div>
  );
}
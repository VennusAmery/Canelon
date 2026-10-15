import React, { useState } from "react";
import BreakEvenCard from "../components/BreakEven/BreakEvenCard.jsx";
import HistorialEquilibrio from "../components/BreakEven/HistorialEquilibrio.jsx";
import "../components/BreakEven/BreakEven.css";
import "./PuntoEquilibrio.css";
import ExportButtons from "../components/ExportButtons/ExportButtons.jsx";
import { buildBreakEvenReport } from "../utils/breakEvenReport.js";

const TABS = [
  { id: "equilibrio", label: "Punto de equilibrio" },
  { id: "historial", label: "Historial" },
];

export default function PuntoEquilibrio() {
  const [tab, setTab] = useState("equilibrio");

  return (
    <div className="dash-page eq-page">
      <div className="eq-top">
        <header className="eq-header">
          <p className="dash-kicker">Panel administrativo</p>
          <h1>Canelón · Viabilidad Financiera</h1>
        </header>
        <img src="/images/pick.png" alt="" className="eq-bear" />
      </div>

      <section className="eq-card">
  <ExportButtons getReport={buildBreakEvenReport} />

        <div className="eq-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`eq-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="eq-panel">
          {tab === "equilibrio" ? <BreakEvenCard /> : <HistorialEquilibrio />}
        </div>
      </section>
    </div>
  );
}
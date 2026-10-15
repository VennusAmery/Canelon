import React from "react";
import BreakEvenCard from "../components/BreakEven/BreakEvenCard.jsx";

export default function PuntoEquilibrio() {
  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <p className="dash-kicker">Panel administrativo</p>
          <h1>Punto de equilibrio</h1>
        </div>
      </header>
      <div className="dash-charts">
        <BreakEvenCard />
      </div>
    </div>
  );
}
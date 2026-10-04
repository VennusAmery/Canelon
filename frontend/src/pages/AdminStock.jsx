import React from "react";
import StockPanel from "../components/StockPanel/StockPanel.jsx";
import "./AdminDashboard.css";

export default function AdminStock() {
  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <p className="dash-kicker">Panel administrativo</p>
          <h1>Canelón · Inventario</h1>
        </div>

        <img
          src="/images/pick.png"
          alt="Chef Canelón"
          className="inventory-mascot"
        />

      </header>

      <StockPanel />
    </div>
  );
}

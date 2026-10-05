import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { API_ORIGIN } from "../../api/client.js";
import "./StockPanel.css";

const MAX_ITEMS = 8;

function Lista({ titulo, items }) {
  if (items.length === 0) return null;
  const visibles = items.slice(0, MAX_ITEMS);
  return (
    <div>
      <h4>{titulo} ({items.length})</h4>
      <ul>
        {visibles.map((i) => (
          <li key={i.id}>
            <span>
              {i.nombre}{" "}
              <small>(mín. {Number(i.stock_minimo)})</small>
            </span>
            <b>
              {Number(i.stock) <= 0
                ? "Agotado"
                : `${Number(i.stock)}${i.unidad ? " " + i.unidad : ""}`}
            </b>
          </li>
        ))}
      </ul>
      {items.length > MAX_ITEMS && (
        <p className="stock-alerts-more">y {items.length - MAX_ITEMS} más…</p>
      )}
    </div>
  );
}

export default function AlertasStock() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    fetch(`${API_ORIGIN}/api/admin/stock/alertas`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setData(d && d.productos ? d : null))
      .catch(() => setData(null));
  }, []);

  // Si el endpoint falla (por ejemplo, tablas aún sin crear) no estorba al dashboard
  if (!data) return null;

  if (data.total === 0) {
    return (
      <div className="stock-alerts ok">
        <CheckCircle size={18} />
        Inventario en orden: ningún producto ni ingrediente está por debajo de su mínimo.
      </div>
    );
  }

  return (
    <div className="stock-alerts warn" role="alert">
      <div className="stock-alerts-head">
        <AlertTriangle size={22} />
        <div>
          <strong>
            Stock bajo: {data.total} {data.total === 1 ? "elemento" : "elementos"} por reponer
          </strong>
          <span>Estos productos e ingredientes están por debajo de su mínimo.</span>
        </div>
        <Link to="/admin/stock" className="stock-alerts-link">
          Ir al inventario
        </Link>
      </div>

      <div className="stock-alerts-cols">
        <Lista titulo="Productos" items={data.productos} />
        <Lista titulo="Ingredientes" items={data.ingredientes} />
      </div>
    </div>
  );
}

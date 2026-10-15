import React, { useEffect, useState } from "react";
import { API_ORIGIN } from "../api/client.js";
import CalendarioPedidos from "../components/Pedidos/CalendarioPedidos.jsx";
import "./AdminDashboard.css";
import "./AdminPedidos.css"; // para los badges de estado y pago
import Loader from "../components/Loader/Loader.jsx";

export default function AdminCalendario() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    fetch(`${API_ORIGIN}/api/admin/pedidos`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar los pedidos.");
        setPedidos(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <p className="dash-kicker">Panel administrativo</p>
          <h1>Canelón · Calendario de entregas</h1>
        </div>
      </header>

      {error && <p className="ap-error">{error}</p>}


{loading ? <Loader compact /> : <CalendarioPedidos pedidos={pedidos} />}

    </div>
  );
}
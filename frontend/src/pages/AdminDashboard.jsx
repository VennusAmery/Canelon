import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag, Package, DollarSign, Receipt, BarChart3, Layers,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { API_ORIGIN } from "../api/client.js";
import StockLowList from "../components/StockPanel/StockLowList.jsx";
import "./AdminDashboard.css";
import "./AdminStockAlerts.css";

const COLORS = ["#b5651d", "#e0913c", "#3a2a1e", "#7a6a5c", "#d9c9b7", "#8c5a3a"];

// AJUSTA estas rutas a las de tu backend de inventario
const STOCK_ENDPOINTS = {
  productos: "/api/admin/stock/productos",
  ingredientes: "/api/admin/stock/ingredientes",
};

function authFetch(path) {
  const token = localStorage.getItem("admin_token");
  return fetch(`${API_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => res.json());
}

// Unifica los nombres de campos y deja solo lo que está bajo el mínimo
function stockBajo(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((x) => ({
      id: x.id,
      nombre: x.nombre,
      cantidad: Number(x.stock ?? x.cantidad ?? 0),
      minimo: Number(x.stock_minimo ?? x.minimo ?? 0),
      unidad: x.unidad || "",
    }))
    .filter((x) => x.cantidad < x.minimo)
    .sort((a, b) => a.cantidad - b.cantidad);
}

export default function AdminDashboard() {
  const [resumen, setResumen] = useState(null);
  const [porCategoria, setPorCategoria] = useState([]);
  const [porMetodoPago, setPorMetodoPago] = useState([]);
  const [porEstado, setPorEstado] = useState([]);
  const [productosBajos, setProductosBajos] = useState([]);
  const [ingredientesBajos, setIngredientesBajos] = useState([]);
  const [tab, setTab] = useState("estadisticas"); // estadisticas | ingredientes | productos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      authFetch("/api/admin/ventas/resumen"),
      authFetch("/api/admin/ventas/por-categoria"),
      authFetch("/api/admin/ventas/por-metodo-pago"),
      authFetch("/api/admin/ventas/por-estado"),
    ])
      .then(([r, cat, pago, estado]) => {
        setResumen(r);
        setPorCategoria(cat);
        setPorMetodoPago(pago);
        setPorEstado(estado);
      })
      .catch((err) => {
        console.error("Error cargando dashboard:", err);
        setError(true);
      })
      .finally(() => setLoading(false));

    // El stock se carga aparte: si falla, el dashboard sigue funcionando
    authFetch(STOCK_ENDPOINTS.productos)
      .then((d) => setProductosBajos(stockBajo(d)))
      .catch(() => setProductosBajos([]));
    authFetch(STOCK_ENDPOINTS.ingredientes)
      .then((d) => setIngredientesBajos(stockBajo(d)))
      .catch(() => setIngredientesBajos([]));
  }, []);

  if (loading) {
    return <div className="dash-loading">Cargando panel...</div>;
  }

  if (error || !resumen) {
    return (
      <div className="dash-loading">
        No se pudo conectar con el servidor. Verifica que el backend esté corriendo e intenta de nuevo.
      </div>
    );
  }

  const totalBajos = productosBajos.length + ingredientesBajos.length;
  const irInventario = () => navigate("/admin/stock");

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <p className="dash-kicker">Panel administrativo</p>
          <h1>Canelón · Resumen de ventas</h1>
        </div>
      </header>

      {/* Botones / notificaciones de stock */}
      <div className="sa-bar">
        <button
          className={`sa-tab sa-tab-stats ${tab === "estadisticas" ? "active" : ""}`}
          onClick={() => setTab("estadisticas")}
        >
          <BarChart3 size={16} /> Estadísticas
        </button>

        <button
          className={`sa-tab sa-tab-ingredientes ${tab === "ingredientes" ? "active" : ""}`}
          onClick={() => setTab("ingredientes")}
        >
          <Layers size={16} /> Ingredientes
          {ingredientesBajos.length > 0 && (
            <span className="sa-badge">{ingredientesBajos.length}</span>
          )}
        </button>

        <button
          className={`sa-tab sa-tab-productos ${tab === "productos" ? "active" : ""}`}
          onClick={() => setTab("productos")}
        >
          <Package size={16} /> Productos
          {productosBajos.length > 0 && (
            <span className="sa-badge">{productosBajos.length}</span>
          )}
        </button>

        <span className={`sa-summary ${totalBajos === 0 ? "ok" : ""}`}>
          {totalBajos === 0
            ? "Stock en orden"
            : `Stock bajo: ${totalBajos} elementos por reponer`}
        </span>
      </div>

      {tab === "ingredientes" && (
        <StockLowList tipo="ingredientes" items={ingredientesBajos} onGoStock={irInventario} />
      )}

      {tab === "productos" && (
        <StockLowList tipo="productos" items={productosBajos} onGoStock={irInventario} />
      )}

      {tab === "estadisticas" && (
        <>
          <div className="dash-kpis">
            <div className="dash-kpi">
              <div className="dash-kpi-icon"><Receipt size={20} /></div>
              <div>
                <p className="dash-kpi-label">Órdenes totales</p>
                <p className="dash-kpi-value">{resumen.total_ordenes}</p>
              </div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-icon"><Package size={20} /></div>
              <div>
                <p className="dash-kpi-label">Unidades vendidas</p>
                <p className="dash-kpi-value">{resumen.total_unidades}</p>
              </div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-icon"><DollarSign size={20} /></div>
              <div>
                <p className="dash-kpi-label">Ingresos totales</p>
                <p className="dash-kpi-value">Q{resumen.ingresos_totales}</p>
              </div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-icon"><ShoppingBag size={20} /></div>
              <div>
                <p className="dash-kpi-label">Ticket promedio</p>
                <p className="dash-kpi-value">Q{resumen.ticket_promedio}</p>
              </div>
            </div>
          </div>

          <div className="dash-charts">
            <div className="dash-card dash-card-wide">
              <h3>Ingresos por categoría</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porCategoria}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5d8c3" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `Q${v}`} />
                  <Bar dataKey="ingresos" fill="#e0913c" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="dash-card">
              <h3>Métodos de pago</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={porMetodoPago}
                    dataKey="ordenes"
                    nameKey="metodo_pago"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ metodo_pago, percent }) => `${metodo_pago} ${(percent * 100).toFixed(0)}%`}
                  >
                    {porMetodoPago.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="dash-card">
              <h3>Estado de los pedidos</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={porEstado}
                    dataKey="ordenes"
                    nameKey="estado_pedido"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ estado_pedido, percent }) => `${estado_pedido} ${(percent * 100).toFixed(0)}%`}
                  >
                    {porEstado.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="dash-card dash-card-wide">
              <h3>Órdenes por categoría</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={porCategoria} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5d8c3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="categoria" type="category" tick={{ fontSize: 12 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="ordenes" fill="#3a2a1e" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
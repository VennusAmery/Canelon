import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Truck, CheckCircle2, BadgeCheck, Wallet } from "lucide-react";
import { API_ORIGIN } from "../api/client.js";
import "./AdminDashboard.css";
import "./AdminPedidos.css";

const ACTIVOS = "estado=recibido,en_preparacion,listo,entregado";
const TABS = [
  { id: "por_realizar", label: "Por realizar", query: "estado=recibido,en_preparacion" },
  { id: "listos", label: "Listos para entregar", query: "estado=listo" },
  { id: "entregados", label: "Entregados", query: "estado=entregado" },
  { id: "pago_completo", label: "Pago completo", query: `pago_completo=1&${ACTIVOS}` },
  { id: "falta_pago", label: "Falta pago", query: `pago_completo=0&${ACTIVOS}` },
  { id: "todos", label: "Todos", query: "" },
];

const METODOS = {
  tarjeta: "Tarjeta",
  contra_entrega: "Contra entrega",
};

const FILTROS_METODO = [
  { id: "", label: "Todos los métodos" },
  { id: "contra_entrega", label: "Contra entrega" },
  { id: "tarjeta", label: "Tarjeta" },
];

const ESTADO_LABEL = {
  recibido: "Recibido",
  en_preparacion: "En preparación",
  listo: "Realizado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

function api(path, options = {}) {
  const token = localStorage.getItem("admin_token");
  return fetch(`${API_ORIGIN}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error en la petición.");
    return data;
  });
}

export default function AdminPedidos() {
  const [tab, setTab] = useState("por_realizar");
  const [metodo, setMetodo] = useState("");
  const [resumen, setResumen] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    setError("");
    try {
      const q = TABS.find((t) => t.id === tab).query;
      const query = [q, metodo && `metodo_pago=${metodo}`].filter(Boolean).join("&");
      const [r, lista] = await Promise.all([
        api("/api/admin/pedidos/resumen"),
        api(`/api/admin/pedidos${query ? `?${query}` : ""}`),
      ]);
      setResumen(r);
      setPedidos(lista);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, metodo]);

  useEffect(() => {
    setLoading(true);
    cargar();
  }, [cargar]);

  const cambiarEstado = async (id, estado) => {
    try {
      await api(`/api/admin/pedidos/${id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePagoCompleto = async (id, valor) => {
    try {
      await api(`/api/admin/pedidos/${id}/pago-completo`, {
        method: "PATCH",
        body: JSON.stringify({ pago_completo: valor }),
      });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const fecha = (f) => (f ? String(f).slice(0, 10) : "—");

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <p className="dash-kicker">Panel administrativo</p>
          <h1>Canelón · Pedidos</h1>
        </div>
      </header>

      {resumen && (
        <div className="dash-kpis">
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><Wallet size={20} /></div>
            <div>
              <p className="dash-kpi-label">Falta pago completo</p>
              <p className="dash-kpi-value">{resumen.saldo_pendiente}</p>
              <p className="ap-kpi-sub">Q{resumen.saldo_por_cobrar} por cobrar</p>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><CheckCircle2 size={20} /></div>
            <div>
              <p className="dash-kpi-label">Realizados (sin entregar)</p>
              <p className="dash-kpi-value">{resumen.realizados_sin_entregar}</p>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><Truck size={20} /></div>
            <div>
              <p className="dash-kpi-label">Faltan por entregar</p>
              <p className="dash-kpi-value">{resumen.faltan_entregar}</p>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><ClipboardList size={20} /></div>
            <div>
              <p className="dash-kpi-label">Entregados</p>
              <p className="dash-kpi-value">{resumen.entregados}</p>
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-icon"><BadgeCheck size={20} /></div>
            <div>
              <p className="dash-kpi-label">Pagos completos</p>
              <p className="dash-kpi-value">
                {resumen.pagos_completos} / {resumen.total}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="ap-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`ap-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ap-tabs ap-tabs-metodo">
        {FILTROS_METODO.map((f) => (
          <button
            key={f.id || "todos"}
            className={`ap-tab ${metodo === f.id ? "active" : ""}`}
            onClick={() => setMetodo(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="ap-error">{error}</p>}

      {loading ? (
        <p className="ap-empty">Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <p className="ap-empty">No hay pedidos en esta vista.</p>
      ) : (
        <div className="ap-list">
          {pedidos.map((p) => {
            const saldo = Number(p.total) - Number(p.monto_anticipo || 0);
            const porRealizar = p.estado === "recibido" || p.estado === "en_preparacion";
            return (
              <div className="ap-card" key={p.id}>
                <div className="ap-card-head">
                  <div>
                    <h3>{p.cliente}</h3>
                    <p className="ap-sub">{p.telefono_cliente} · {p.direccion_entrega}</p>
                  </div>
                  <div className="ap-badges">
                    <span className={`ap-badge estado-${p.estado}`}>
                      {ESTADO_LABEL[p.estado] || p.estado}
                    </span>
                    <span className={`ap-badge ${p.pago_completo ? "pago-ok" : "pago-parcial"}`}>
                      {p.pago_completo ? "Pago completo" : "Saldo pendiente"}
                    </span>
                    <span className="ap-badge ap-badge-metodo">
                      {METODOS[p.metodo_pago] ?? p.metodo_pago}
                    </span>
                  </div>
                </div>

                <ul className="ap-items">
                  {(p.items || []).map((i, idx) => (
                    <li key={idx}>{i.qty} × {i.nombre}</li>
                  ))}
                </ul>

                <div className="ap-meta">
                  <span>Entrega: <strong>{fecha(p.fecha_entrega)}</strong></span>
                  <span>Total: <strong>Q{p.total}</strong></span>
                  <span>Anticipo: <strong>Q{p.monto_anticipo}</strong></span>
                  <span>Saldo: <strong>{p.pago_completo ? "Q0" : `Q${saldo}`}</strong></span>
                </div>

                <div className="ap-actions">
                  {p.estado === "recibido" && (
                    <button onClick={() => cambiarEstado(p.id, "en_preparacion")}>
                      Empezar preparación
                    </button>
                  )}
                  {porRealizar && (
                    <button className="primary" onClick={() => cambiarEstado(p.id, "listo")}>
                      Marcar como realizado
                    </button>
                  )}
                  {p.estado === "listo" && (
                    <>
                      <button onClick={() => cambiarEstado(p.id, "en_preparacion")}>
                        Regresar a preparación
                      </button>
                      <button className="primary" onClick={() => cambiarEstado(p.id, "entregado")}>
                        Marcar como entregado
                      </button>
                    </>
                  )}
                  {p.estado !== "cancelado" && (
                    <button onClick={() => togglePagoCompleto(p.id, !p.pago_completo)}>
                      {p.pago_completo ? "Quitar pago completo" : "Registrar saldo pagado"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
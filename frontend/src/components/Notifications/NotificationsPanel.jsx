import React, { useEffect, useMemo, useState } from "react";
import { XCircle } from "lucide-react";
import { API_ORIGIN } from "../../api/client.js";
import "./NotificationsPanel.css";

const TIPOS = [
  { id: "error", label: "Error" },
  { id: "warning", label: "Warning" },
  { id: "information", label: "Information" },
  { id: "success", label: "Success" },
];

const ESTADOS = ["recibido", "en_preparacion", "listo", "entregado", "cancelado"];

function tiempoRelativo(fecha) {
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} horas`;
  return `hace ${Math.floor(h / 24)} días`;
}

export default function NotificationsPanel() {
  const [items, setItems] = useState([]);
  const [tipo, setTipo] = useState("error");
  const [orden, setOrden] = useState("recientes");
  const [fuente, setFuente] = useState("");
  const [estado, setEstado] = useState("");
  const [descartadas, setDescartadas] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    fetch(`${API_ORIGIN}/api/admin/notificaciones`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const visibles = useMemo(
    () => items.filter((n) => !descartadas.includes(n.id)),
    [items, descartadas]
  );

  const conteo = (t) => visibles.filter((n) => n.tipo === t).length;

  const lista = useMemo(() => {
    let r = visibles.filter((n) => n.tipo === tipo);
    if (fuente) r = r.filter((n) => n.fuente === fuente);
    if (estado) r = r.filter((n) => n.estado === estado);
    r = [...r].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
    return orden === "recientes" ? r.reverse() : r;
  }, [visibles, tipo, fuente, estado, orden]);

  const tituloTipo = TIPOS.find((t) => t.id === tipo)?.label;

  return (
    <section className="np-card">
      <div className="np-top">
        <div>
          <h2>Gestionar notificaciones</h2>
          <p className="np-sub">Aquí puedes ver la lista de notificaciones.</p>
        </div>

        <div className="np-chips">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              className={`np-chip np-${t.id} ${tipo === t.id ? "active" : ""}`}
              onClick={() => setTipo(t.id)}
            >
              {t.label}
              {conteo(t.id) > 0 && <span className="np-badge">{conteo(t.id)}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="np-filters">
        <select value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="recientes">Recientes</option>
          <option value="antiguas">Antiguas</option>
        </select>
        <select value={fuente} onChange={(e) => setFuente(e.target.value)}>
          <option value="">Fuente</option>
          <option value="Pago">Pago</option>
          <option value="Pedido">Pedido</option>
          <option value="Entrega">Entrega</option>
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Estado</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <h3 className="np-section-title">Notificaciones de {tituloTipo}</h3>

      <div className="np-list">
        {lista.length === 0 && <p className="np-empty">No hay notificaciones en esta categoría.</p>}
        {lista.map((n) => (
          <div key={n.id} className={`np-row np-row-${n.tipo}`}>
            <div className="np-avatar" />
            <div className="np-text">
              <strong>{n.titulo}</strong>
              <span>{n.detalle}</span>
            </div>
            <div className="np-meta">
              <button
                aria-label="Descartar"
                onClick={() => setDescartadas((d) => [...d, n.id])}
              >
                <XCircle size={18} />
              </button>
              <span>{tiempoRelativo(n.creado_en)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
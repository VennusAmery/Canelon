import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";
import { API_ORIGIN } from "../../api/client.js";
import "./CalendarioPedidos.css";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ESTADO_LABEL = {
  recibido: "Recibido",
  en_preparacion: "En preparación",
  listo: "Realizado",
  entregado: "Entregado",
};
const METODOS = { tarjeta: "Tarjeta", contra_entrega: "Contra entrega" };

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// "Martes, 6 de octubre" (solo la primera letra en mayúscula)
const fechaLarga = (k) => {
  const s = new Date(`${k}T12:00:00`).toLocaleDateString("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function CalendarioPedidos({ pedidos }) {
  const hoy = new Date();
  const hoyKey = keyOf(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const [cursor, setCursor] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() });
  const [sel, setSel] = useState(null); // día abierto en el modal (null = cerrado)
  const [abierto, setAbierto] = useState(null); // pedido desplegado dentro del modal

  const cerrarModal = () => {
    setSel(null);
    setAbierto(null);
  };

  // Cerrar con Escape y bloquear el scroll de la página mientras el modal está abierto
  useEffect(() => {
    if (!sel) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSel(null);
        setAbierto(null);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sel]);

  // pedidos agrupados por fecha de entrega (sin cancelados)
  const porDia = useMemo(() => {
    const map = {};
    for (const p of pedidos) {
      if (p.estado === "cancelado" || !p.fecha_entrega) continue;
      const k = String(p.fecha_entrega).slice(0, 10);
      (map[k] = map[k] || []).push(p);
    }
    return map;
  }, [pedidos]);

  const { y, m } = cursor;
  const diasMes = new Date(y, m + 1, 0).getDate();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // la semana empieza en lunes
  const prefijo = `${y}-${pad(m + 1)}`;

  const delMes = Object.entries(porDia)
    .filter(([k]) => k.startsWith(prefijo))
    .flatMap(([, v]) => v);
  const totalMes = delMes.reduce((s, p) => s + Number(p.total || 0), 0);

  const cambiarMes = (delta) => {
    const d = new Date(y, m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const titulo = new Date(y, m, 1).toLocaleDateString("es-GT", {
    month: "long",
    year: "numeric",
  });

  const detalle = sel ? porDia[sel] || [] : [];
  const totalDia = detalle.reduce((s, p) => s + Number(p.total || 0), 0);

  const celdas = [];
  for (let i = 0; i < offset; i++) {
    celdas.push(<div key={`e${i}`} className="cal-day empty" />);
  }
  for (let d = 1; d <= diasMes; d++) {
    const k = keyOf(y, m, d);
    const lista = porDia[k] || [];
    const atrasado = k < hoyKey && lista.some((p) => p.estado !== "entregado");
    const clases = [
      "cal-day",
      lista.length ? "has" : "",
      k === hoyKey ? "today" : "",
      k === sel ? "sel" : "",
      atrasado ? "late" : "",
    ].join(" ");

    celdas.push(
      <button
        key={k}
        type="button"
        className={clases}
        onClick={() => {
          if (lista.length) {
            setSel(k);
            setAbierto(null);
          }
        }}
      >
        <span className="cal-num">{d}</span>
        {lista.length > 0 && (
          <span className="cal-count">
            {lista.length}
            <span className="cal-count-label">
              {" "}
              {lista.length === 1 ? "pedido" : "pedidos"}
            </span>
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <div>
          <h3 className="cal-title">{titulo}</h3>
          <p className="cal-sub">
            {delMes.length} {delMes.length === 1 ? "pedido" : "pedidos"} · Q
            {totalMes.toLocaleString("es-GT")} en entregas
          </p>
        </div>
        <div className="cal-nav">
          <button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setCursor({ y: hoy.getFullYear(), m: hoy.getMonth() })}
          >
            Hoy
          </button>
          <button type="button" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="cal-grid">
        {DIAS.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {celdas}
      </div>

      {/* ---------- Modal del día ---------- */}
      {sel && (
        <div className="cal-modal-overlay" onClick={cerrarModal}>
          <div
            className="cal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cal-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="cal-modal-close"
              onClick={cerrarModal}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            <h3 id="cal-modal-title" className="cal-modal-title">
              {fechaLarga(sel)}
            </h3>
            <p className="cal-modal-sub">
              {detalle.length} {detalle.length === 1 ? "pedido" : "pedidos"} · Q
              {totalDia.toLocaleString("es-GT")}
            </p>

            <ul className="cal-list">
              {detalle.map((p) => {
                const open = abierto === p.id;
                const anticipo = Number(p.monto_anticipo || 0);
                const saldo = p.pago_completo ? 0 : Number(p.total) - anticipo;
                const items = p.items || [];

                return (

                    <li key={p.id} className={`cal-order st-${p.estado} ${open ? "open" : ""}`}>
                    <button
                        type="button"
                        className="cal-order-head"
                        aria-expanded={open}
                        onClick={() => setAbierto(open ? null : p.id)}
                    >
                        <span className="cal-avatar">{p.cliente?.charAt(0).toUpperCase()}</span>

                        <div className="cal-order-main">
                        <strong>{p.cliente}</strong>
                        <span className="cal-items">
                            {items.map((i) => `${i.qty} × ${i.nombre}`).join(", ")}
                        </span>
                        </div>

                        <div className="cal-right">
                        <strong className="cal-total">Q{p.total}</strong>
                        <span className={`ap-badge estado-${p.estado}`}>
                            {ESTADO_LABEL[p.estado] || p.estado}
                        </span>
                        </div>

                        <ChevronDown size={18} className="cal-chev" />
                    </button>


                    {open && (
                      <div className="cal-order-body">
                        <section>
                          <h5>Productos</h5>
                          <table className="cal-table">
                            <tbody>
                              {items.map((i, idx) => (
                                <tr key={idx}>
                                  <td>
                                    {i.qty} × {i.nombre}
                                  </td>
                                  {i.precio != null && (
                                    <td className="r">Q{Number(i.precio) * Number(i.qty)}</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </section>

                        <section>
                          <h5>Cliente y entrega</h5>
                          <p>
                            <span>Teléfono</span>
                            <a href={`tel:${p.telefono_cliente}`}>{p.telefono_cliente}</a>
                          </p>
                          <p>
                            <span>Dirección</span>
                            {p.direccion_entrega}
                          </p>
                          <p>
                            <span>Entrega</span>
                            {String(p.fecha_entrega).slice(0, 10)}
                          </p>
                          {p.creado_en && (
                            <p>
                              <span>Pedido hecho</span>
                              {new Date(p.creado_en).toLocaleString("es-GT")}
                            </p>
                          )}
                        </section>

                        <section>
                          <h5>Pago</h5>
                          <p>
                            <span>Método</span>
                            {METODOS[p.metodo_pago] ?? p.metodo_pago}
                          </p>
                          <p>
                            <span>Total</span>Q{p.total}
                          </p>
                          <p>
                            <span>Anticipo</span>Q{anticipo}
                          </p>
                          <p>
                            <span>Saldo</span>
                            <strong>Q{saldo}</strong>
                          </p>
                          <span
                            className={`ap-badge ${p.pago_completo ? "pago-ok" : "pago-parcial"}`}
                          >
                            {p.pago_completo ? "Pago completo" : "Saldo pendiente"}
                          </span>
                        </section>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
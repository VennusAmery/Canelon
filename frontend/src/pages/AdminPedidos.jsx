
import React, { useEffect, useState, useCallback } from "react";
import { API_ORIGIN } from "../api/client.js";
import "./AdminDashboard.css";
import "./AdminPedidos.css";
import ExportButtons from "../components/ExportButtons/ExportButtons.jsx";

import {
  ClipboardList,
  Truck,
  CheckCircle2,
  BadgeCheck,
  Wallet,
  Bell,
  X,
} from "lucide-react";

const ACTIVOS = "estado=recibido,en_preparacion,listo,entregado";

const TABS = [
  {
    id: "por_realizar",
    label: "Por realizar",
    query: "estado=recibido,en_preparacion",
  },
  {
    id: "listos",
    label: "Listos para entregar",
    query: "estado=listo",
  },
  {
    id: "entregados",
    label: "Entregados",
    query: "estado=entregado",
  },
  {
    id: "pago_completo",
    label: "Pago completo",
    query: `pago_completo=1&${ACTIVOS}`,
  },
  {
    id: "falta_pago",
    label: "Falta pago",
    query: `pago_completo=0&${ACTIVOS}`,
  },
  {
    id: "todos",
    label: "Todos",
    query: "",
  },
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

// Agrupa elementos y cuenta cuántos existen de cada tipo.
function contar(lista, obtenerNombre) {
  const cantidades = {};

  lista.forEach((elemento) => {
    const nombre = obtenerNombre(elemento);
    cantidades[nombre] = (cantidades[nombre] || 0) + 1;
  });

  return Object.entries(cantidades).map(([name, value]) => ({
    name,
    value,
  }));
}

// Realiza peticiones a la API con el token del administrador.
async function api(path, options = {}) {
  const token = localStorage.getItem("admin_token");

  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Error en la petición.");
  }

  return data;
}

// Calcula los días que faltan para la fecha de entrega.
function diasParaEntrega(fechaEntrega) {
  if (!fechaEntrega) return null;

  const fechaTexto = String(fechaEntrega).slice(0, 10);
  const partes = fechaTexto.split("-").map(Number);

  if (
    partes.length !== 3 ||
    partes.some((parte) => !Number.isInteger(parte)) ||
    partes[0] < 1000 ||
    partes[1] < 1 ||
    partes[1] > 12 ||
    partes[2] < 1 ||
    partes[2] > 31
  ) {
    return null;
  }

  const entrega = new Date(
    Date.UTC(partes[0], partes[1] - 1, partes[2])
  );

  // Evita aceptar fechas inexistentes, como el 31 de febrero.
  if (
    entrega.getUTCFullYear() !== partes[0] ||
    entrega.getUTCMonth() !== partes[1] - 1 ||
    entrega.getUTCDate() !== partes[2]
  ) {
    return null;
  }

  const hoy = new Date();
  const hoyUTC = Date.UTC(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate()
  );

  return Math.round(
    (entrega.getTime() - hoyUTC) / 86400000
  );
}

// Determina si un pedido requiere atención.
function obtenerAlertaEntrega(pedido) {
  if (["entregado", "cancelado"].includes(pedido.estado)) {
    return null;
  }

  const dias = diasParaEntrega(pedido.fecha_entrega);

  if (dias === null) return null;

  if (dias < 0) {
    return {
      tipo: "atrasado",
      mensaje: `Entrega atrasada ${Math.abs(dias)} día(s)`,
    };
  }

  if (pedido.estado === "listo") {
    return {
      tipo: "listo",
      mensaje: "Listo para entregar",
    };
  }

  if (dias === 0) {
    return {
      tipo: "urgente",
      mensaje: "Se entrega hoy",
    };
  }

  if (dias <= 2) {
    return {
      tipo: "proximo",
      mensaje: `Entrega en ${dias} día(s)`,
    };
  }

  return null;
}

// Formatea las fechas que se muestran en pantalla.
function fecha(f) {
  return f ? String(f).slice(0, 10) : "—";
}

export default function AdminPedidos() {
  const [tab, setTab] = useState("por_realizar");
  const [metodo, setMetodo] = useState("");
  const [resumen, setResumen] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificacionesAbiertas, setNotificacionesAbiertas] =
    useState(false);

  // Carga el resumen y los pedidos según los filtros seleccionados.
  const cargar = useCallback(async () => {
    setError("");

    try {
      const tabSeleccionada = TABS.find((t) => t.id === tab);
      const q = tabSeleccionada ? tabSeleccionada.query : "";

      const query = [
        q,
        metodo
          ? `metodo_pago=${encodeURIComponent(metodo)}`
          : "",
      ]
        .filter(Boolean)
        .join("&");

      const [r, lista] = await Promise.all([
        api("/api/admin/pedidos/resumen"),
        api(`/api/admin/pedidos${query ? `?${query}` : ""}`),
      ]);

      setResumen(r);
      setPedidos(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los pedidos.");
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [tab, metodo]);

  useEffect(() => {
    setLoading(true);
    cargar();
  }, [cargar]);

  // CAMBIO PRINCIPAL:
  // Se generan las alertas a partir de los pedidos cargados.
  const alertasEntrega = pedidos
    .map((pedido) => ({
      pedido,
      alerta: obtenerAlertaEntrega(pedido),
    }))
    .filter((item) => item.alerta !== null);

  // Cambia el estado de un pedido.
  const cambiarEstado = async (id, estado) => {
    try {
      await api(`/api/admin/pedidos/${id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });

      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado.");
    }
  };

  // Marca o desmarca el pago completo.
  const togglePagoCompleto = async (id, valor) => {
    try {
      await api(`/api/admin/pedidos/${id}/pago-completo`, {
        method: "PATCH",
        body: JSON.stringify({ pago_completo: valor }),
      });

      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el pago.");
    }
  };

  const tabActual =
    TABS.find((t) => t.id === tab)?.label || "Pedidos";

  // Datos que utiliza ExportButtons para generar los reportes.
  const reportePedidos = {
    filename: "canelon_pedidos",
    title: "Pedidos",
    subtitle: `Vista: ${tabActual}${
      metodo ? ` · ${METODOS[metodo]}` : ""
    } · ${pedidos.length} pedidos`,

    kpis: resumen
      ? [
          {
            label: "Falta pago completo",
            value: resumen.saldo_pendiente,
          },
          {
            label: "Saldo por cobrar",
            value: `Q${resumen.saldo_por_cobrar}`,
          },
          {
            label: "Realizados sin entregar",
            value: resumen.realizados_sin_entregar,
          },
          {
            label: "Faltan por entregar",
            value: resumen.faltan_entregar,
          },
          {
            label: "Entregados",
            value: resumen.entregados,
          },
        ]
      : [],

    charts: [
      {
        type: "pie",
        title: "Pedidos por estado",
        data: contar(
          pedidos,
          (p) => ESTADO_LABEL[p.estado] || p.estado
        ),
      },
      {
        type: "pie",
        title: "Método de pago",
        data: contar(
          pedidos,
          (p) => METODOS[p.metodo_pago] ?? p.metodo_pago
        ),
      },
    ],

    sections: [
      {
        title: "Pedidos",
        columns: [
          { header: "Cliente", key: "cliente" },
          { header: "Teléfono", key: "telefono_cliente" },
          { header: "Dirección", key: "direccion_entrega" },
          { header: "Entrega", key: "entrega" },
          { header: "Estado", key: "estado_txt" },
          { header: "Pago", key: "pago_txt" },
          { header: "Método", key: "metodo_txt" },
          { header: "Productos", key: "productos" },
          { header: "Total", key: "total", money: true },
          {
            header: "Anticipo",
            key: "monto_anticipo",
            money: true,
          },
          { header: "Saldo", key: "saldo", money: true },
        ],

        rows: pedidos.map((p) => ({
          ...p,
          entrega: fecha(p.fecha_entrega),
          estado_txt: ESTADO_LABEL[p.estado] || p.estado,
          pago_txt: p.pago_completo
            ? "Pago completo"
            : "Saldo pendiente",
          metodo_txt:
            METODOS[p.metodo_pago] ?? p.metodo_pago,
          productos: (p.items || [])
            .map((i) => `${i.qty} × ${i.nombre}`)
            .join("; "),
          saldo: p.pago_completo
            ? 0
            : Number(p.total || 0) -
              Number(p.monto_anticipo || 0),
        })),
      },

      {
        title: "Detalle de productos",
        columns: [
          { header: "Cliente", key: "cliente" },
          { header: "Entrega", key: "entrega" },
          { header: "Producto", key: "nombre" },
          { header: "Cantidad", key: "qty" },
        ],

        rows: pedidos.flatMap((p) =>
          (p.items || []).map((i) => ({
            cliente: p.cliente,
            entrega: fecha(p.fecha_entrega),
            nombre: i.nombre,
            qty: i.qty,
          }))
        ),
      },
    ],
  };

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <p className="dash-kicker">Panel administrativo</p>
          <h1>Canelón · Pedidos</h1>
        </div>

        <div className="ap-header-acciones">
          {/* Notificaciones de entregas */}
          <div className="ap-notificaciones">
            <button
              type="button"
              className="ap-campana"
              onClick={() =>
                setNotificacionesAbiertas((abierta) => !abierta)
              }
              aria-label="Ver notificaciones de entregas"
              aria-expanded={notificacionesAbiertas}
            >
              <Bell size={21} />

              {alertasEntrega.length > 0 && (
                <span className="ap-campana-punto" />
              )}
            </button>

            {notificacionesAbiertas && (
              <div className="ap-notificaciones-menu">
                <div className="ap-notificaciones-head">
                  <strong>Notificaciones</strong>

                  <button
                    type="button"
                    onClick={() =>
                      setNotificacionesAbiertas(false)
                    }
                    aria-label="Cerrar notificaciones"
                  >
                    <X size={17} />
                  </button>
                </div>

                {alertasEntrega.length === 0 ? (
                  <p className="ap-notificaciones-vacio">
                    No hay entregas que requieran atención.
                  </p>
                ) : (
                  alertasEntrega.map(({ pedido, alerta }) => (
                    <button
                      type="button"
                      className="ap-notificacion"
                      key={pedido.id}
                      onClick={() => {
                        setNotificacionesAbiertas(false);

                        document
                          .getElementById(`pedido-${pedido.id}`)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                      }}
                    >
                      <span
                        className={`ap-notificacion-punto ${alerta.tipo}`}
                      />

                      <span className="ap-notificacion-contenido">
                        <strong>{pedido.cliente}</strong>
                        <span>{alerta.mensaje}</span>
                        <small>
                          Entrega: {fecha(pedido.fecha_entrega)}
                        </small>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Exportación de reportes */}
          <ExportButtons {...reportePedidos} />
        </div>
      </header>

      {/* Resumen de pedidos */}
      {resumen && (
        <div className="dash-kpis">
          <div className="dash-kpi">
            <div className="dash-kpi-icon">
              <Wallet size={20} />
            </div>

            <div>
              <p className="dash-kpi-label">
                Falta pago completo
              </p>
              <p className="dash-kpi-value">
                {resumen.saldo_pendiente}
              </p>
              <p className="ap-kpi-sub">
                Q{resumen.saldo_por_cobrar} por cobrar
              </p>
            </div>
          </div>

          <div className="dash-kpi">
            <div className="dash-kpi-icon">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <p className="dash-kpi-label">
                Realizados (sin entregar)
              </p>
              <p className="dash-kpi-value">
                {resumen.realizados_sin_entregar}
              </p>
            </div>
          </div>

          <div className="dash-kpi">
            <div className="dash-kpi-icon">
              <Truck size={20} />
            </div>

            <div>
              <p className="dash-kpi-label">
                Faltan por entregar
              </p>
              <p className="dash-kpi-value">
                {resumen.faltan_entregar}
              </p>
            </div>
          </div>

          <div className="dash-kpi">
            <div className="dash-kpi-icon">
              <ClipboardList size={20} />
            </div>

            <div>
              <p className="dash-kpi-label">Entregados</p>
              <p className="dash-kpi-value">
                {resumen.entregados}
              </p>
            </div>
          </div>

          <div className="dash-kpi">
            <div className="dash-kpi-icon">
              <BadgeCheck size={20} />
            </div>

            <div>
              <p className="dash-kpi-label">
                Pagos completos
              </p>
              <p className="dash-kpi-value">
                {resumen.pagos_completos} / {resumen.total}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros por estado */}
      <div className="ap-tabs">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`ap-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros por método de pago */}
      <div className="ap-tabs ap-tabs-metodo">
        {FILTROS_METODO.map((f) => (
          <button
            type="button"
            key={f.id || "todos"}
            className={`ap-tab ${
              metodo === f.id ? "active" : ""
            }`}
            onClick={() => setMetodo(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Mensajes de error */}
      {error && <p className="ap-error">{error}</p>}

      {/* Listado de pedidos */}
      {loading ? (
        <p className="ap-empty">Cargando pedidos...</p>
      ) : pedidos.length === 0 ? (
        <p className="ap-empty">
          No hay pedidos en esta vista.
        </p>
      ) : (
        <div className="ap-list">
          {pedidos.map((p) => {
            const saldo =
              Number(p.total || 0) -
              Number(p.monto_anticipo || 0);

            const porRealizar =
              p.estado === "recibido" ||
              p.estado === "en_preparacion";

            const alerta = obtenerAlertaEntrega(p);

            return (
              <div
                className="ap-card"
                id={`pedido-${p.id}`}
                key={p.id}
              >
                <div className="ap-card-head">
                  <div>
                    <h3 className="ap-cliente-titulo">
                      {p.cliente}

                      {alerta && (
                        <span
                          className={`ap-pedido-punto ${alerta.tipo}`}
                          title={alerta.mensaje}
                        />
                      )}
                    </h3>

                    <p className="ap-sub">
                      {p.telefono_cliente} · {p.direccion_entrega}
                    </p>
                  </div>

                  <div className="ap-badges">
                    <span
                      className={`ap-badge estado-${p.estado}`}
                    >
                      {ESTADO_LABEL[p.estado] || p.estado}
                    </span>

                    <span
                      className={`ap-badge ${
                        p.pago_completo
                          ? "pago-ok"
                          : "pago-parcial"
                      }`}
                    >
                      {p.pago_completo
                        ? "Pago completo"
                        : "Saldo pendiente"}
                    </span>

                    <span className="ap-badge ap-badge-metodo">
                      {METODOS[p.metodo_pago] ?? p.metodo_pago}
                    </span>
                  </div>
                </div>

                {/* Productos del pedido */}
                <ul className="ap-items">
                  {(p.items || []).map((i, idx) => (
                    <li key={i.id ?? `${i.nombre}-${idx}`}>
                      {i.qty} × {i.nombre}
                    </li>
                  ))}
                </ul>

                {/* Información de entrega y pago */}
                <div className="ap-meta">
                  <span>
                    Entrega:{" "}
                    <strong>{fecha(p.fecha_entrega)}</strong>
                  </span>

                  <span>
                    Total: <strong>Q{p.total}</strong>
                  </span>

                  <span>
                    Anticipo:{" "}
                    <strong>Q{p.monto_anticipo}</strong>
                  </span>

                  <span>
                    Saldo:{" "}
                    <strong>
                      {p.pago_completo ? "Q0" : `Q${saldo}`}
                    </strong>
                  </span>
                </div>

                {/* Acciones del pedido */}
                <div className="ap-actions">
                  {p.estado === "recibido" && (
                    <button
                      type="button"
                      onClick={() =>
                        cambiarEstado(p.id, "en_preparacion")
                      }
                    >
                      Empezar preparación
                    </button>
                  )}

                  {porRealizar && (
                    <button
                      type="button"
                      className="primary"
                      onClick={() =>
                        cambiarEstado(p.id, "listo")
                      }
                    >
                      Marcar como realizado
                    </button>
                  )}

                  {p.estado === "listo" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          cambiarEstado(p.id, "en_preparacion")
                        }
                      >
                        Regresar a preparación
                      </button>

                      <button
                        type="button"
                        className="primary"
                        onClick={() =>
                          cambiarEstado(p.id, "entregado")
                        }
                      >
                        Marcar como entregado
                      </button>
                    </>
                  )}

                  {p.estado !== "cancelado" && (
                    <button
                      type="button"
                      onClick={() =>
                        togglePagoCompleto(
                          p.id,
                          !p.pago_completo
                        )
                      }
                    >
                      {p.pago_completo
                        ? "Quitar pago completo"
                        : "Registrar saldo pagado"}
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

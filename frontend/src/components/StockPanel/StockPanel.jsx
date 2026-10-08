import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { API_ORIGIN } from "../../api/client.js";
import "./StockPanel.css";

const UNIDADES = ["kg", "g", "L", "ml", "unidad", "lata", "paquete"];

function api(path, options = {}) {
  const token = localStorage.getItem("admin_token");
  return fetch(`${API_ORIGIN}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).then((r) => r.json());
}

// Avisa al layout para que actualice el contador de alertas del sidebar
const notificar = () => window.dispatchEvent(new Event("stock-updated"));

// Ignora mayúsculas y tildes: "limon" encuentra "Loaf de Limón"
const normalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const LABELS = {
  "bajo-pedido": "Bajo pedido",
  agotado: "Agotado",
  bajo: "Stock bajo",
  ok: "OK",
};

export default function StockPanel() {
  const [tab, setTab] = useState("productos");
  const [rows, setRows] = useState([]);
  const [inputs, setInputs] = useState({});
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | reponer | agotado
  const [nuevo, setNuevo] = useState({
    nombre: "",
    unidad: "kg",
    stock: "",
    stock_minimo: "20",
  });

  const esProductos = tab === "productos";

  const load = (t = tab) =>
    api(`/api/admin/stock/${t}`)
      .then((d) => {
        if (Array.isArray(d)) {
          setRows(d);
          setError("");
        } else {
          setError(d.error || "No se pudo cargar el inventario.");
        }
      })
      .catch(() => setError("No se pudo cargar el inventario."));

    useEffect(() => {
      setRows([]);
      setInputs({});
      setBusqueda("");
      setFiltro("todos");
      load(tab);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);


  const estado = (r) => {
    if (esProductos && r.tipo_pedido !== "stock") return "bajo-pedido";
    if (Number(r.stock) <= 0) return "agotado";
    if (Number(r.stock) < Number(r.stock_minimo)) return "bajo";
    return "ok";
  };


// Los contadores usan todos los registros, no solo los filtrados
const alertas = rows.filter((r) => ["agotado", "bajo"].includes(estado(r))).length;
const agotados = rows.filter((r) => estado(r) === "agotado").length;

const q = normalizar(busqueda.trim());
const visibles = rows.filter((r) => {
  const e = estado(r);
  if (filtro === "reponer" && !["agotado", "bajo"].includes(e)) return false;
  if (filtro === "agotado" && e !== "agotado") return false;
  if (q && !normalizar(r.nombre).includes(q)) return false;
  return true;
});

  // Filtro por estado
  const filtrados = filtro === "todos" ? visibles : visibles.filter((r) => estado(r) === filtro);

  const mover = async (id, tipo) => {
    const valor = inputs[id];
    const cantidad = Number(valor);
    if (valor === undefined || valor === "" || !Number.isFinite(cantidad) || cantidad < 0) return;

    const data = await api(`/api/admin/stock/${tab}/${id}/movimiento`, {
      method: "POST",
      body: JSON.stringify({ tipo, cantidad }),
    });
    if (data.error) return setError(data.error);

    setError("");
    setInputs((p) => ({ ...p, [id]: "" }));
    load();
    notificar();
  };

  const guardarMinimo = async (r, valor) => {
    if (valor === "" || Number(valor) === Number(r.stock_minimo)) return;
    const data = await api(`/api/admin/stock/${tab}/${r.id}/minimo`, {
      method: "PATCH",
      body: JSON.stringify({ stock_minimo: Number(valor) }),
    });
    if (data.error) setError(data.error);
    load();
    notificar();
  };

  const crearIngrediente = async (e) => {
    e.preventDefault();
    const data = await api("/api/admin/stock/ingredientes", {
      method: "POST",
      body: JSON.stringify({
        nombre: nuevo.nombre,
        unidad: nuevo.unidad,
        stock: Number(nuevo.stock || 0),
        stock_minimo: Number(nuevo.stock_minimo || 20),
      }),
    });
    if (data.error) return setError(data.error);

    setError("");
    setNuevo({ nombre: "", unidad: "kg", stock: "", stock_minimo: "20" });
    load();
    notificar();
  };

  return (
    <div className="dash-card dash-card-wide stock-panel">
      <div className="stock-tabs">
        <button
          className={esProductos ? "active" : ""}
          onClick={() => setTab("productos")}
        >
          Productos
        </button>
        <button
          className={!esProductos ? "active" : ""}
          onClick={() => setTab("ingredientes")}
        >
          Ingredientes
        </button>
        {alertas > 0 && (
          <span className="stock-alert">{alertas} por reponer</span>
        )}
      </div>

      {error && <p className="stock-error">{error}</p>}

      {!esProductos && (
        <form className="stock-new" onSubmit={crearIngrediente}>
          <input
            type="text"
            placeholder="Nuevo ingrediente"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            required
          />
          <select
            value={nuevo.unidad}
            onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <input
            type="number" min="0" step="any"
            placeholder="Stock inicial"
            value={nuevo.stock}
            onChange={(e) => setNuevo({ ...nuevo, stock: e.target.value })}
          />
          <input
            type="number" min="0" step="any"
            placeholder="Stock mínimo"
            value={nuevo.stock_minimo}
            onChange={(e) => setNuevo({ ...nuevo, stock_minimo: e.target.value })}
          />
          <button type="submit">+ Agregar</button>
        </form>
      )}

<div className="stk-toolbar">
  <div className="stk-search">
    <Search size={16} />
    <input
      type="text"
      value={busqueda}
      onChange={(e) => setBusqueda(e.target.value)}
      placeholder={esProductos ? "Buscar producto..." : "Buscar ingrediente..."}
    />
    {busqueda && (
      <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
        <X size={14} />
      </button>
    )}
  </div>

      <div className="stk-filters">
        <button
          type="button"
          className={filtro === "todos" ? "active" : ""}
          onClick={() => setFiltro("todos")}
        >
          Todos
        </button>
        <button
          type="button"
          className={`warn ${filtro === "reponer" ? "active" : ""}`}
          onClick={() => setFiltro("reponer")}
        >
          Por reponer ({alertas})
        </button>
        <button
          type="button"
          className={`danger ${filtro === "agotado" ? "active" : ""}`}
          onClick={() => setFiltro("agotado")}
        >
          Agotados ({agotados})
        </button>
      </div>
    </div>

      <div className="stock-scroll">
        <table className="stock-table">
          <thead>
            <tr>
              <th>{esProductos ? "Producto" : "Ingrediente"}</th>
              <th>{esProductos ? "Tipo" : "Unidad"}</th>
              <th>Stock</th>
              <th>Mínimo</th>
              <th>Estado</th>
              <th>Cantidad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => {
              const editable = !esProductos || r.tipo_pedido === "stock";
              return (
                <tr key={r.id}>
                  <td>{r.nombre}</td>
                  <td>
                    {esProductos
                      ? r.tipo_pedido === "stock" ? "Stock" : "Bajo pedido"
                      : r.unidad}
                  </td>
                  <td>{editable ? Number(r.stock) : "—"}</td>
                  <td>
                    {editable && (
                      <input
                        className="stock-min"
                        type="number" min="0" step={esProductos ? 1 : "any"}
                        key={`${r.id}-${r.stock_minimo}`}
                        defaultValue={Number(r.stock_minimo)}
                        onBlur={(e) => guardarMinimo(r, e.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    <span className={`stock-badge ${estado(r)}`}>
                      {LABELS[estado(r)]}
                    </span>
                  </td>
                  <td>
                    {editable && (
                      <input
                        type="number" min="0" step={esProductos ? 1 : "any"}
                        placeholder="Ej. 10"
                        value={inputs[r.id] ?? ""}
                        onChange={(e) =>
                          setInputs((p) => ({ ...p, [r.id]: e.target.value }))
                        }
                      />
                    )}
                  </td>
                  <td className="stock-actions">
                    {editable && (
                      <>
                        <button
                          title="Suma esta cantidad al stock actual"
                          onClick={() => mover(r.id, "entrada")}
                        >
                          + Agregar
                        </button>
                        {!esProductos && (
                          <button
                            title="Resta esta cantidad del stock actual"
                            onClick={() => mover(r.id, "salida")}
                          >
                            − Quitar
                          </button>
                        )}
                        <button
                          title="Reemplaza el stock actual por este número"
                          onClick={() => mover(r.id, "ajuste")}
                        >
                          Corregir stock
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
              {visibles.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="stock-empty">
                    {q
                      ? `No se encontró nada para "${busqueda}".`
                      : filtro === "reponer"
                        ? "Todo en orden: no hay nada por reponer."
                        : filtro === "agotado"
                          ? "No hay nada agotado."
                          : esProductos
                            ? "No hay productos."
                            : "Todavía no hay ingredientes. Corre el seed o agrega uno arriba."}
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
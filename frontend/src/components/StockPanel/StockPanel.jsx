import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { API_ORIGIN } from "../../api/client.js";
import "./StockPanel.css";
import ExportButtons from "../ExportButtons/ExportButtons.jsx";
import Loader from "../Loader/Loader.jsx";

const UNIDADES = ["kg", "g", "L", "ml", "unidad", "lata", "paquete"];

const LABELS = {
  "bajo-pedido": "Bajo pedido",
  agotado: "Agotado",
  bajo: "Stock bajo",
  ok: "OK",
};

function api(path, options = {}) {
  const token = localStorage.getItem("admin_token");

  return fetch(`${API_ORIGIN}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  }).then(async (response) => {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Ocurrió un error en la solicitud.");
    }

    return data;
  });
}

// Avisa al layout para actualizar las alertas del inventario.
const notificar = () =>
  window.dispatchEvent(new Event("stock-updated"));

// Ignora mayúsculas y tildes al buscar.
const normalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function StockPanel() {
  const [tab, setTab] = useState("productos");
  const [rows, setRows] = useState([]);
  const [inputs, setInputs] = useState({});
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");

  const [nuevo, setNuevo] = useState({
    nombre: "",
    unidad: "kg",
    stock: "",
    stock_minimo: "20",
  });

  const esProductos = tab === "productos";

  // Cargar productos o ingredientes.
  const load = async (tipo = tab) => {
    setLoading(true);

    try {
      const data = await api(`/api/admin/stock/${tipo}`);

      if (Array.isArray(data)) {
        setRows(data);
        setError("");
      } else {
        setRows([]);
        setError(data.error || "No se pudo cargar el inventario.");
      }
    } catch (err) {
      setRows([]);
      setError(err.message || "No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRows([]);
    setInputs({});
    setBusqueda("");
    setFiltro("todos");
    setError("");

    load(tab);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Determinar el estado de cada registro.
  const estado = (r) => {
    if (esProductos && r.tipo_pedido !== "stock") {
      return "bajo-pedido";
    }

    if (Number(r.stock) <= 0) {
      return "agotado";
    }

    if (Number(r.stock) < Number(r.stock_minimo)) {
      return "bajo";
    }

    return "ok";
  };

  // Contadores calculados sobre todos los registros.
  const alertas = rows.filter((r) =>
    ["agotado", "bajo"].includes(estado(r))
  ).length;

  const agotados = rows.filter(
    (r) => estado(r) === "agotado"
  ).length;

  // Preparar los datos para los reportes.
  const filaStock = (r) => {
    const editable = !esProductos || r.tipo_pedido === "stock";
    const e = estado(r);

    return {
      nombre: r.nombre,
      tipo: esProductos
        ? r.tipo_pedido === "stock"
          ? "Stock"
          : "Bajo pedido"
        : r.unidad,
      stock: editable ? Number(r.stock) : "—",
      minimo: editable ? Number(r.stock_minimo) : "—",
      estado: LABELS[e],
      faltante:
        editable && ["agotado", "bajo"].includes(e)
          ? Math.max(
              0,
              Number(r.stock_minimo) - Number(r.stock)
            )
          : 0,
    };
  };

  const columnasStock = [
    {
      header: esProductos ? "Producto" : "Ingrediente",
      key: "nombre",
    },
    {
      header: esProductos ? "Tipo" : "Unidad",
      key: "tipo",
    },
    { header: "Stock", key: "stock" },
    { header: "Mínimo", key: "minimo" },
    { header: "Estado", key: "estado" },
    { header: "Faltante", key: "faltante" },
  ];

  const conteoEstados = Object.entries(
    rows.reduce((acumulado, r) => {
      const etiqueta = LABELS[estado(r)];

      acumulado[etiqueta] =
        (acumulado[etiqueta] || 0) + 1;

      return acumulado;
    }, {})
  ).map(([label, value]) => ({ label, value }));

  const reporteStock = {
    filename: esProductos
      ? "canelon_stock_productos"
      : "canelon_stock_ingredientes",

    title: esProductos
      ? "Inventario de productos"
      : "Inventario de ingredientes",

    subtitle: `${rows.length} registros`,

    kpis: [
      { label: "Registros", value: rows.length },
      { label: "Por reponer", value: alertas },
      { label: "Agotados", value: agotados },
    ],

    charts: [
      {
        type: "pie",
        title: "Estado del inventario",
        data: conteoEstados,
      },
    ],

    sections: [
      {
        title: "Inventario completo",
        columns: columnasStock,
        rows: rows.map(filaStock),
      },
      {
        title: "Por reponer",
        columns: columnasStock,
        rows: rows
          .filter((r) =>
            ["agotado", "bajo"].includes(estado(r))
          )
          .map(filaStock),
      },
    ],
  };

  // Aplicar búsqueda y filtro de estado.
  const q = normalizar(busqueda.trim());

  const visibles = rows.filter((r) => {
    const e = estado(r);

    if (
      filtro === "reponer" &&
      !["agotado", "bajo"].includes(e)
    ) {
      return false;
    }

    if (filtro === "agotado" && e !== "agotado") {
      return false;
    }

    if (q && !normalizar(r.nombre).includes(q)) {
      return false;
    }

    return true;
  });

  // Registrar entradas, salidas y ajustes de stock.
  const mover = async (id, tipo) => {
    const valor = inputs[id];
    const cantidad = Number(valor);

    if (
      valor === undefined ||
      valor.trim?.() === "" ||
      !Number.isFinite(cantidad) ||
      cantidad < 0
    ) {
      setError("Ingresa una cantidad válida.");
      return;
    }

    try {
      const data = await api(
        `/api/admin/stock/${tab}/${id}/movimiento`,
        {
          method: "POST",
          body: JSON.stringify({ tipo, cantidad }),
        }
      );

      if (data.error) {
        setError(data.error);
        return;
      }

      setError("");
      setInputs((prev) => ({ ...prev, [id]: "" }));

      await load();
      notificar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el stock.");
    }
  };

  // Actualizar el stock mínimo.
  const guardarMinimo = async (r, valor) => {
    if (valor.trim() === "") {
      return;
    }

    const minimo = Number(valor);

    if (!Number.isFinite(minimo) || minimo < 0) {
      setError("El stock mínimo debe ser un número válido.");
      return;
    }

    if (minimo === Number(r.stock_minimo)) {
      return;
    }

    try {
      await api(`/api/admin/stock/${tab}/${r.id}/minimo`, {
        method: "PATCH",
        body: JSON.stringify({ stock_minimo: minimo }),
      });

      setError("");
      await load();
      notificar();
    } catch (err) {
      setError(err.message || "No se pudo guardar el stock mínimo.");
    }
  };

  // Crear un ingrediente.
  const crearIngrediente = async (e) => {
    e.preventDefault();

    if (!nuevo.nombre.trim()) {
      setError("Ingresa el nombre del ingrediente.");
      return;
    }

    try {
      await api("/api/admin/stock/ingredientes", {
        method: "POST",
        body: JSON.stringify({
          nombre: nuevo.nombre.trim(),
          unidad: nuevo.unidad,
          stock: Number(nuevo.stock || 0),
          stock_minimo: Number(nuevo.stock_minimo || 20),
        }),
      });

      setError("");

      setNuevo({
        nombre: "",
        unidad: "kg",
        stock: "",
        stock_minimo: "20",
      });

      await load();
      notificar();
    } catch (err) {
      setError(err.message || "No se pudo crear el ingrediente.");
    }
  };

  return (
    <div className="dash-card dash-card-wide stock-panel">
      {/* Pestañas y exportación */}
      <div className="stock-tabs">
        <button
          type="button"
          className={esProductos ? "active" : ""}
          onClick={() => setTab("productos")}
        >
          Productos
        </button>

        <button
          type="button"
          className={!esProductos ? "active" : ""}
          onClick={() => setTab("ingredientes")}
        >
          Ingredientes
        </button>

        {alertas > 0 && (
          <span className="stock-alert">
            {alertas} por reponer
          </span>
        )}

        <div style={{ marginLeft: "auto" }}>
          <ExportButtons getReport={() => reporteStock} />
        </div>
      </div>

      {error && <p className="stock-error">{error}</p>}

      {/* Formulario para agregar ingredientes */}
      {!esProductos && (
        <form className="stock-new" onSubmit={crearIngrediente}>
          <input
            type="text"
            placeholder="Nuevo ingrediente"
            value={nuevo.nombre}
            onChange={(e) =>
              setNuevo({ ...nuevo, nombre: e.target.value })
            }
            required
          />

          <select
            value={nuevo.unidad}
            onChange={(e) =>
              setNuevo({ ...nuevo, unidad: e.target.value })
            }
          >
            {UNIDADES.map((unidad) => (
              <option key={unidad} value={unidad}>
                {unidad}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            step="any"
            placeholder="Stock inicial"
            value={nuevo.stock}
            onChange={(e) =>
              setNuevo({ ...nuevo, stock: e.target.value })
            }
          />

          <input
            type="number"
            min="0"
            step="any"
            placeholder="Stock mínimo"
            value={nuevo.stock_minimo}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                stock_minimo: e.target.value,
              })
            }
          />

          <button type="submit">+ Agregar</button>
        </form>
      )}

      {/* Búsqueda y filtros */}
      <div className="stk-toolbar">
        <div className="stk-search">
          <Search size={16} />

          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={
              esProductos
                ? "Buscar producto..."
                : "Buscar ingrediente..."
            }
          />

          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar búsqueda"
            >
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
            className={`warn ${
              filtro === "reponer" ? "active" : ""
            }`}
            onClick={() => setFiltro("reponer")}
          >
            Por reponer ({alertas})
          </button>

          <button
            type="button"
            className={`danger ${
              filtro === "agotado" ? "active" : ""
            }`}
            onClick={() => setFiltro("agotado")}
          >
            Agotados ({agotados})
          </button>
        </div>
      </div>

      {/* Tabla de inventario */}
      {loading ? (
        <Loader compact texto="Cargando inventario..." />
      ) : (
        <div className="stock-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>
                  {esProductos ? "Producto" : "Ingrediente"}
                </th>
                <th>{esProductos ? "Tipo" : "Unidad"}</th>
                <th>Stock</th>
                <th>Mínimo</th>
                <th>Estado</th>
                <th>Cantidad</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {visibles.map((r) => {
                const editable =
                  !esProductos || r.tipo_pedido === "stock";

                const e = estado(r);

                return (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>

                    <td>
                      {esProductos
                        ? r.tipo_pedido === "stock"
                          ? "Stock"
                          : "Bajo pedido"
                        : r.unidad}
                    </td>

                    <td>
                      {editable ? Number(r.stock) : "—"}
                    </td>

                    <td>
                      {editable && (
                        <input
                          className="stock-min"
                          type="number"
                          min="0"
                          step={esProductos ? 1 : "any"}
                          key={`${r.id}-${r.stock_minimo}`}
                          defaultValue={Number(r.stock_minimo)}
                          onBlur={(e) =>
                            guardarMinimo(r, e.target.value)
                          }
                        />
                      )}
                    </td>

                    <td>
                      <span className={`stock-badge ${e}`}>
                        {LABELS[e]}
                      </span>
                    </td>

                    <td>
                      {editable && (
                        <input
                          type="number"
                          min="0"
                          step={esProductos ? 1 : "any"}
                          placeholder="Ej. 10"
                          value={inputs[r.id] ?? ""}
                          onChange={(e) =>
                            setInputs((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </td>

                    <td className="stock-actions">
                      {editable && (
                        <>
                          <button
                            type="button"
                            title="Suma esta cantidad al stock actual"
                            onClick={() => mover(r.id, "entrada")}
                          >
                            + Agregar
                          </button>

                          {!esProductos && (
                            <button
                              type="button"
                              title="Resta esta cantidad del stock actual"
                              onClick={() => mover(r.id, "salida")}
                            >
                              − Quitar
                            </button>
                          )}

                          <button
                            type="button"
                            title="Reemplaza el stock actual por esta cantidad"
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
      )}
    </div>
  );
}
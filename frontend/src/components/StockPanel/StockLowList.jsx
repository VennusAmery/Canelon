import React from "react";
import { AlertTriangle } from "lucide-react";

const TITULOS = {
  productos: "Productos por reponer",
  ingredientes: "Ingredientes por reponer",
};

export default function StockLowList({ tipo, items, onGoStock }) {
  return (
    <section className="sa-card">
      <div className="sa-card-head">
        <div className="sa-card-title">
          <AlertTriangle size={26} />
          <div>
            <h3>
              {TITULOS[tipo]}: {items.length}
            </h3>
            <p>Estos elementos están por debajo de su mínimo.</p>
          </div>
        </div>
        <button className="sa-go" onClick={onGoStock}>
          Ir al inventario
        </button>
      </div>

      {items.length === 0 ? (
        <p className="sa-empty">
          Todo en orden: ningún {tipo === "productos" ? "producto" : "ingrediente"} está por debajo de su mínimo.
        </p>
      ) : (
        <div className="sa-list">
          {items.map((it) => (
            <div className="sa-row" key={it.id ?? it.nombre}>
              <span>
                {it.nombre} <small>(mín. {it.minimo})</small>
              </span>
              <strong>
                {it.cantidad}
                {it.unidad ? ` ${it.unidad}` : ""}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
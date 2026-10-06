import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import "./ProductOptionsModal.css";

const GRANDES = ["Mediano", "Grande"]; // tamaños con recargo mayor en coberturas

const GROUP_LABELS = {
  masa: "Masa",
  relleno: "Relleno",
  cobertura: "Cobertura",
  decoracion: "Decoración",
  extra: "Extras",
};

export default function ProductOptionsModal({ product, onClose, onConfirm }) {
  const variantes = product.variantes || [];
  const opciones = product.opciones || [];

  const [varianteId, setVarianteId] = useState(variantes[0]?.id ?? null);

  const grupos = useMemo(() => {
    const g = {};
    opciones.forEach((o) => {
      (g[o.grupo] = g[o.grupo] || []).push(o);
    });
    return g;
  }, [opciones]);

  // un grupo "extra" permite varios; los demás, solo uno (por defecto el primero)
  const [unica, setUnica] = useState(() => {
    const init = {};
    Object.entries(grupos).forEach(([g, list]) => {
      if (g !== "extra") init[g] = list[0].id;
    });
    return init;
  });
  const [extras, setExtras] = useState([]);

  const variante = variantes.find((v) => v.id === varianteId);
  const esGrande = variante && GRANDES.includes(variante.nombre);

  const extraDe = (o) =>
    esGrande && o.precio_extra_tamano_grande != null
      ? o.precio_extra_tamano_grande
      : o.precio_extra;

  const seleccionadas = [
    ...Object.entries(unica).map(([g, id]) =>
      grupos[g].find((o) => o.id === id)
    ),
    ...opciones.filter((o) => extras.includes(o.id)),
  ].filter(Boolean);

  const base = variante ? variante.precio : product.precio ?? 0;
  const total = base + seleccionadas.reduce((s, o) => s + extraDe(o), 0);

  const toggleExtra = (id) =>
    setExtras((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const confirmar = () => {
    const detalle = [
      variante?.nombre,
      ...seleccionadas.map((o) => o.nombre),
    ]
      .filter(Boolean)
      .join(" · ");

    onConfirm({
      id: `${product.id}|${varianteId ?? ""}|${seleccionadas
        .map((o) => o.id)
        .sort()
        .join(",")}`,
      productId: product.id,
      nombre: product.nombre,
      detalle,
      precio: total,
      image: product.image,
    });
  };

  return (
    <div className="pom-overlay" onClick={onClose}>
      <div className="pom-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pom-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        <h2>{product.nombre}</h2>
        {product.desc && <p className="pom-desc">{product.desc}</p>}

        {variantes.length > 0 && (
          <fieldset className="pom-group">
            <legend>Elige una opción</legend>
            {variantes.map((v) => (
              <label key={v.id} className="pom-row">
                <input
                  type="radio"
                  name="variante"
                  checked={varianteId === v.id}
                  onChange={() => setVarianteId(v.id)}
                />
                <span className="pom-name">
                  {v.nombre}
                  {v.detalle && <small> · {v.detalle}</small>}
                </span>
                <span className="pom-price">Q{v.precio}</span>
              </label>
            ))}
          </fieldset>
        )}

        {Object.entries(grupos).map(([g, list]) => (
          <fieldset className="pom-group" key={g}>
            <legend>{GROUP_LABELS[g] || g}</legend>
            {list.map((o) => {
              const extra = extraDe(o);
              return (
                <label key={o.id} className="pom-row">
                  {g === "extra" ? (
                    <input
                      type="checkbox"
                      checked={extras.includes(o.id)}
                      onChange={() => toggleExtra(o.id)}
                    />
                  ) : (
                    <input
                      type="radio"
                      name={g}
                      checked={unica[g] === o.id}
                      onChange={() => setUnica((p) => ({ ...p, [g]: o.id }))}
                    />
                  )}
                  <span className="pom-name">{o.nombre}</span>
                  <span className="pom-price">
                    {extra > 0 ? `+Q${extra}` : "Incluido"}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}

        <button className="pom-confirm" onClick={confirmar}>
          Agregar al carrito · Q{total}
        </button>
      </div>
    </div>
  );
}
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Check, ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { API_ORIGIN } from "../../api/client.js";
import { useCart } from "../../context/CartContext.jsx";
import "./ProductCarousel.css";
import ProductOptionsModal from "./ProductOptionsModal.jsx";

const ADD_FEEDBACK_MS = 1200;
const mediaUrl = (path) => (path ? `${API_ORIGIN}${path}` : null);
const videoUrl = (path) => (path ? `${API_ORIGIN}${path}` : null);

function getDisplayPrice(product) {
  if (product.precio != null) return `Q${product.precio}`;
  if (product.variantes && product.variantes.length > 0) {
    const min = Math.min(...product.variantes.map((v) => v.precio));
    return `Q${min}`;
  }
  return "Precio a consultar";
}

function ProductImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`${className} pc-img-fallback`} role="img" aria-label={alt}>
        <ImageOff size={24} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}

const ProductCard = React.forwardRef(function ProductCard(
  { product, onAdd, justAdded, active, onMouseEnter },
  ref
) {
  return (
    <div
      ref={ref}
      className={`pc-card ${active ? "pc-card-active" : ""}`}
      onMouseEnter={onMouseEnter}
    >
      <div className="pc-card-media">
        {product.video ? (
          <video
            src={videoUrl(product.video)}
            className="pc-card-media-content"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <ProductImage
            className="pc-card-media-content"
            src={mediaUrl(product.image)}
            alt={product.nombre || "Producto"}
          />
        )}
      </div>
      <div className="pc-card-body">
        <h3 className="pc-card-title">{product.nombre}</h3>
        <p className="pc-card-desc">{product.desc}</p>
        <div className="pc-card-footer">
          <span className="pc-card-price">{getDisplayPrice(product)}</span>
          <button
            className={`pc-card-add ${justAdded ? "pc-card-add-added" : ""}`}
            onClick={() => onAdd(product)}
            aria-label={`Agregar ${product.nombre}`}
          >
            {justAdded ? <Check size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
});

export default function ProductCarousel() {
  const [showAll, setShowAll] = useState(false);
  const [justAddedId, setJustAddedId] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef(null);
  const cardRefs = useRef([]);
  const feedbackTimeoutRef = useRef(null);
  const rafRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [products, setProducts] = useState([]);
const [productoOpciones, setProductoOpciones] = useState(null);

  const { addItem } = useCart();

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/products`)
      .then((res) => res.json())
      .then(setProducts)
      .catch((err) => console.error("Error cargando productos:", err));
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const updateActiveIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;

    let closestIndex = 0;
    let closestDist = Infinity;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cardCenter = r.left + r.width / 2;
      const dist = Math.abs(cardCenter - trackCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    });
    setActiveIndex(closestIndex);
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateActiveIndex);
  }, [updateActiveIndex]);

  useEffect(() => {
    if (showAll) return;
    updateActiveIndex();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
  }, [showAll, updateActiveIndex, handleScroll]);

const flashAdded = (id) => {
  setJustAddedId(id);
  if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  feedbackTimeoutRef.current = setTimeout(() => setJustAddedId(null), ADD_FEEDBACK_MS);
};

const handleAdd = (product) => {
  const tieneOpciones =
    (product.variantes && product.variantes.length > 0) ||
    (product.opciones && product.opciones.length > 0);

  if (tieneOpciones) {
    setProductoOpciones(product); // abre el modal
    return;
  }
  addItem(product);
  flashAdded(product.id);
};

const confirmarOpciones = (item) => {
  addItem(item);
  flashAdded(productoOpciones.id);
  setProductoOpciones(null);
};

  const scrollByCard = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector(".pc-card");
    const step = card ? card.offsetWidth + 20 : 240;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section id="menu" className="pc-section">
      <div className="pc-wrap">
        <div className="pc-head-row">
          <div>
            <div className="kicker">Menú</div>
            <h2 className="pc-heading">Nuestro menú</h2>
          </div>
          {products.length > 0 && (
            <button className="pc-showall-btn" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Ver menos" : "Ver más"}
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <p>Todavía no hay productos disponibles.</p>
        ) : showAll ? (
          <div className="pc-grid pc-fade-in">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onAdd={handleAdd}
                justAdded={justAddedId === p.id}
                active={false}
              />
            ))}
          </div>
        ) : (
          <div className="pc-carousel" onMouseLeave={() => setHoveredId(null)}>
            <button className="pc-arrow pc-arrow-left" onClick={() => scrollByCard(-1)} aria-label="Anterior">
              <ChevronLeft size={20} />
            </button>

            <div className="pc-track" ref={trackRef} onScroll={handleScroll}>
              {products.map((p, i) => (
                <ProductCard
                  key={p.id}
                  ref={(el) => (cardRefs.current[i] = el)}
                  product={p}
                  onAdd={handleAdd}
                  justAdded={justAddedId === p.id}
                  active={hoveredId != null ? hoveredId === p.id : i === activeIndex}
                  onMouseEnter={() => setHoveredId(p.id)}
                />
              ))}
            </div>
              <button className="pc-arrow pc-arrow-right" onClick={() => scrollByCard(1)} aria-label="Siguiente">
                <ChevronRight size={20} />
              </button>
          </div>
        )}

        <div className="pc-note">
          <p>
            También elaboramos productos personalizados para celebraciones y
            ocasiones especiales, con un toque único en cada pedido.
          </p>
          <a href="#redes" className="pc-note-btn">
            Escríbenos
          </a>
        </div>
      </div>
      {productoOpciones && (
        <ProductOptionsModal
          product={productoOpciones}
          onClose={() => setProductoOpciones(null)}
          onConfirm={confirmarOpciones}
        />
      )}
    </section>
  );
}
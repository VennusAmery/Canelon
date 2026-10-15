import React from "react";
import "./Loader.css";

export default function Loader({ texto = "", compact = false, size = 140 }) {
  return (
    <div
      className={`loader ${compact ? "loader-compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <img
        src="/images/loading.gif"
        alt=""
        width={size}
        height={size}
        className="loader-img"
      />
      <span className="loader-sr">Cargando</span>
      {texto && <p className="loader-text">{texto}</p>}
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { getValores } from "../../api/client.js";
import './About.css';

export default function About() {
  const [valores, setValores] = useState([]);

  useEffect(() => {
    getValores()
      .then(setValores)
      .catch(() => setValores([]));
  }, []);
  return (
    <section id="nosotros" className="about-section">

      <div className="wrap">
        <div className="section-head">
          <div className="kicker">Sobre nosotros</div>
          <h2>Lo que nos mueve cada día</h2>
        </div>

        <div className="mv-grid">
          <div className="mv-card">
            <h3>Misión</h3>
            <p>
              Elaborar postres y panes artesanales de calidad, hechos con
              dedicación y un toque casero, buscando hornear felicidad en
              cada bocado.
            </p>
          </div>
          <div className="mv-card">
            <h3>Visión</h3>
            <p>
              Ser un emprendimiento reconocido por sus productos artesanales,
              creciendo sin perder la esencia casera y el cariño detrás de
              cada producto.
            </p>
          </div>
        </div>

        <div className="valores-grid">
          {valores.map((v) => (
            <div className="valor-card" key={v.nombre}>
              <h4>{v.nombre}</h4>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

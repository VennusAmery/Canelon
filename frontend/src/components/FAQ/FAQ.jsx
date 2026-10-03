import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getFaqs } from "../../api/client.js";
import "./FAQ.css";

export default function FAQ() {
  const [faqs, setFaqs] = useState([]);
  const [openIndex, setOpenIndex] = useState(0);

  useEffect(() => {
    getFaqs()
      .then(setFaqs)
      .catch(() => setFaqs([]));
  }, []);

  return (
    <section id="dudas" className="faq-section">
      <div className="wrap">
        <div className="section-head">
          <div className="kicker">Preguntas frecuentes</div>
          <h2>Dudas que nos hacen seguido</h2>
          <p>Si tienes alguna otra pregunta, escríbenos y con gusto te ayudamos.</p>
        </div>

        <div className="faq-grid">
          <div className="faq-list">
            {faqs.map((item, i) => {
              const open = openIndex === i;
              return (
                <div className={`faq-item ${open ? "open" : ""}`} key={item.q}>
                  <button className="faq-q" onClick={() => setOpenIndex(open ? -1 : i)}>
                    {item.q}
                    <Plus size={20} className="plus" />
                  </button>
                  <div className="faq-a">
                    <p>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>

            <video
              src="/images/think.mp4"
              aria-label="Animación dudas frecuentes"
              className="faq-giff"
              autoPlay
              loop
              muted
              playsInline
            />

        </div>
      </div>
    </section>
  );
}
import React from "react";
import {
  Instagram,
  Mail,
  MessageCircle,
  Clock,
  MapPin,
} from "lucide-react";
import ContactForm from "./ContactForm.jsx";
import "./Social.css";

export default function Social() {
  return (
    <section id="redes" className="social-section">
      <div className="wrap social-inner">
        <div>
          <div className="section-head">
            <div className="kicker">Contacto</div>

            <h2>Síguenos y haz tu pedido</h2>

            <p>
              Cuéntanos qué necesitas y con gusto te ayudamos a diseñar el
              pedido perfecto para tu celebración.
            </p>

            <video
              src="/images/bye.mp4"
              aria-label="Animación de un pedido personalizado"
              className="social-gif"
              autoPlay
              loop
              muted
              playsInline
            />

            <div className="social-icons-row">

              {/* Instagram */}
              <a
                className="social-icon"
                href="https://instagram.com/canelon_gt"
                target="_blank"
                rel="noreferrer"
                title="@canelon_gt"
                aria-label="Instagram"
              >
                <Instagram size={18} />
              </a>

              {/* Correo */}
              <a
                className="social-icon"
                href="mailto:canelongt@gmail.com"
                title="canelongt@gmail.com"
                aria-label="Correo"
              >
                <Mail size={18} />
              </a>

              {/* WhatsApp */}
              <div
                className="social-icon"
                title="Escríbenos para pedidos especiales"
                aria-label="WhatsApp"
              >
                <MessageCircle size={18} />
              </div>

              {/* Horario */}
              <div
                className="social-icon"
                title="Lunes a sábado, 8:00 AM – 4:00 PM"
                aria-label="Horario"
              >
                <Clock size={18} />
              </div>

              {/* Ubicación */}
              <div
                className="social-icon"
                title="Ciudad de Guatemala"
                aria-label="Ubicación"
              >
                <MapPin size={18} />
              </div>

            </div>
          </div>
        </div>

        <ContactForm />
      </div>
    </section>
  );
}

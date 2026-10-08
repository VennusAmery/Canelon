import React from "react";
import {
  Instagram,
  Mail,
  MessageCircle,
  Facebook,
} from "lucide-react";
import ContactForm from "./ContactForm.jsx";
import "./Social.css";

function TikTokIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.6 6.7a4.8 4.8 0 0 1-3.8-4.2V2h-3.4v13.3a2.9 2.9 0 1 1-2-2.8V9a6.3 6.3 0 1 0 5.4 6.3V8.9a8.1 8.1 0 0 0 4.7 1.5V7a4.8 4.8 0 0 1-.9-.3z" />
    </svg>
  );
}

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

              {/* Facebook */}
              <a
                className="social-icon"
                href="https://www.facebook.com/share/18RaMWJUPJ/?mibextid=wwXIfr"
                target="_blank"
                rel="noreferrer"
                title="Facebook de Canelón"
                aria-label="Facebook"
              >
                <Facebook size={18} />
              </a>

              {/* TikTok */}
              <a
                className="social-icon"
                href="https://www.tiktok.com/@canelon.gt"
                target="_blank"
                rel="noreferrer"
                title="@canelon.gt"
                aria-label="TikTok"
              >
                <TikTokIcon size={18} />
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

              {/* WhatsApp 
              <div
                className="social-icon"
                title="Escríbenos para pedidos especiales"
                aria-label="WhatsApp"
              >
                <MessageCircle size={18} />
              </div>
              */}
              
            </div>
          </div>
        </div>

        <ContactForm />
      </div>
    </section>
  );
}

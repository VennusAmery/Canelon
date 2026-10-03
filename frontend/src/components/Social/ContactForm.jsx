import React, { useState } from "react";
import { Send, X } from "lucide-react";
import "./ContactForm.css";

export default function ContactForm() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("sending");

    // no se envía nada realmente
    setTimeout(() => {
      setStatus("idle");
      setShowModal(true);
      setNombre("");
      setEmail("");
      setMensaje("");
    }, 800);
  };

  return (
    <div className="contact-form-card">
      <p className="contact-form-kicker">Escríbenos</p>
      <h3>Envíanos un mensaje</h3>

      <form onSubmit={handleSubmit}>
        <label>
          Nombre
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Mensaje
          <textarea rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} required />
        </label>

        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Enviando..." : (<><Send size={16} /> Enviar mensaje</>)}
        </button>
      </form>

      {showModal && (
        <div className="contact-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="contact-modal" onClick={(e) => e.stopPropagation()}>

            <img src="/images/done.png" alt="Mensaje enviado" className="contact-modal-img" />
            <h3>¡Enviado correctamente!</h3>
            <p>Gracias por escribirnos, te responderemos pronto.</p>
            <button className="contact-modal-btn" onClick={() => setShowModal(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
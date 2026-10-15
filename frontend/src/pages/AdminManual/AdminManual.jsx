import React from "react";
import { Download, BookOpen, ExternalLink } from "lucide-react";
import "./AdminManual.css";

const PDF_URL = "/Pdf/Manual.pdf";

export default function AdminManual() {
  return (
    <div className="manual-page">
      <header className="manual-header">
        <div className="manual-heading">
          <div className=" ">
          </div>

          <div>
            <p className="manual-eyebrow">CANELÓN · ADMINISTRACIÓN</p>
            <h1>Manual de usuario</h1>
          </div>
        </div>

        <div className="manual-actions">
          <a
            href={PDF_URL}
            download="Manual.pdf"
            className="manual-btn manual-btn-primary"
          >
            <Download size={18} />
            Descargar manual
          </a>

          <a
            href={PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="manual-btn manual-btn-secondary"
          >
            <ExternalLink size={17} />
            Abrir en otra pestaña
          </a>
        </div>
      </header>

      <section className="manual-card">
        <div className="manual-viewer">
          <iframe
            src={`${PDF_URL}#toolbar=1&navpanes=0`}
            title="Manual de usuario de Canelón"
            className="manual-iframe"
          />
        </div>

      </section>
    </div>
  );
}
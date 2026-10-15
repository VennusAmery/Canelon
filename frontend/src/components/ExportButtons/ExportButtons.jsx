import React, { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportExcel, exportPDF } from "../../utils/exportReport.js";
import "./ExportButtons.css";

/**
 * Props: filename, title, subtitle, kpis, charts, sections
 * o getReport: async () => ({...}) para reportes que cargan datos al hacer clic.
 */
export default function ExportButtons({ getReport, caption, ...report }) {
  const [busy, setBusy] = useState("");

  const run = async (kind) => {
    setBusy(kind);
    try {
      const rep = getReport ? await getReport() : report;
      if (kind === "xlsx") await exportExcel(rep);
      else await exportPDF(rep);
    } catch (e) {
      console.error(e);
      alert("No se pudo generar el archivo.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="export-wrap">
      {caption && <span className="export-caption">{caption}</span>}
      <div className="export-btns">
        <button onClick={() => run("xlsx")} disabled={!!busy}>
          {busy === "xlsx" ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />} Excel
        </button>
        <button onClick={() => run("pdf")} disabled={!!busy}>
          {busy === "pdf" ? <Loader2 size={16} className="spin" /> : <FileText size={16} />} PDF
        </button>
      </div>
    </div>
  );
}
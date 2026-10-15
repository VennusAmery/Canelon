import React, { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { buildFullReport } from "../../utils/fullReport.js";
import { exportExcel, exportPDF } from "../../utils/exportReport.js";
import "./ExportButtons.css";

export default function ExportButtons({ getReport = buildFullReport }) {
  const [loading, setLoading] = useState(null); // "excel" | "pdf" | null
  const [error, setError] = useState("");

  const run = async (tipo, fn) => {
    setError("");
    setLoading(tipo);
    try {
      const report = await getReport();
      await fn(report);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo exportar.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="exp-wrap">
      <button type="button" className="exp-btn" disabled={!!loading} onClick={() => run("excel", exportExcel)}>
        <FileSpreadsheet size={18} />
        {loading === "excel" ? "Generando..." : "Excel"}
      </button>

      <button type="button" className="exp-btn" disabled={!!loading} onClick={() => run("pdf", exportPDF)}>
        <FileText size={18} />
        {loading === "pdf" ? "Generando..." : "PDF"}
      </button>

      {error && <span className="exp-error">{error}</span>}
    </div>
  );
}
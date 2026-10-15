const COLORS = ["#b9793f", "#e0913c", "#3a2a1e", "#7a6a5c", "#d9c9b7", "#8c5a3a", "#c9a227", "#6f8f72"];
const stamp = () => new Date().toISOString().slice(0, 10);
const quetzal = (n) =>
  `Q${Number(n || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

  const excluirHojas = (sections) =>
  sections
    .filter(
      (s) =>
        !["preguntas frecuentes", "valores"].includes(
          s.title.trim().toLowerCase()
        )
    )
    .map((s) => ({
      ...s,
      columns: s.columns.filter(
        (c) => c.header.trim().toLowerCase() !== "imagen"
      ),
    }));

export async function loadImage(url) {
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(blob);
  });
  const dims = await new Promise((res) => {
    const i = new Image();
    i.onload = () => res({ w: i.width, h: i.height });
    i.src = dataUrl;
  });
  return { dataUrl, ...dims };
}

/* ---------- Gráficas dibujadas en canvas (sirven para Excel y PDF) ---------- */
export function chartToPNG({ type, title, data, prefix = "" }) {
  const W = 1000, H = 520;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");

  g.fillStyle = "#fffdf8"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#e5d8c3"; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
  g.fillStyle = "#3a2a1e"; g.font = "bold 28px Georgia, serif";
  g.fillText(title, 32, 48);

  const items = data.slice(0, 10);
  const fmt = (v) => `${prefix}${Number(v).toLocaleString("es-GT", { maximumFractionDigits: 2 })}`;

  if (type === "pie") {
    const total = items.reduce((s, d) => s + Number(d.value), 0) || 1;
    const cx = 270, cy = 295, r = 165;
    let a = -Math.PI / 2;
    items.forEach((d, i) => {
      const ang = (Number(d.value) / total) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a, a + ang); g.closePath();
      g.fillStyle = COLORS[i % COLORS.length]; g.fill();
      g.strokeStyle = "#fffdf8"; g.lineWidth = 3; g.stroke();
      a += ang;
    });
    g.font = "22px Arial";
    items.forEach((d, i) => {
      const y = 110 + i * 38;
      g.fillStyle = COLORS[i % COLORS.length]; g.fillRect(520, y - 18, 22, 22);
      g.fillStyle = "#3a2a1e";
      g.fillText(`${d.label} — ${fmt(d.value)} (${((d.value / total) * 100).toFixed(0)}%)`, 552, y);
    });
  } else {
    const left = 250, right = W - 130, top = 80, bottom = H - 30;
    const max = Math.max(...items.map((d) => Number(d.value)), 1);
    const slot = (bottom - top) / items.length;
    const bh = Math.min(36, slot * 0.65);
    g.font = "20px Arial";
    items.forEach((d, i) => {
      const y = top + i * slot + (slot - bh) / 2;
      const w = ((right - left) * Number(d.value)) / max;
      g.fillStyle = "#3a2a1e"; g.textAlign = "right";
      g.fillText(String(d.label).slice(0, 22), left - 14, y + bh * 0.7);
      g.fillStyle = COLORS[i % COLORS.length]; g.fillRect(left, y, w, bh);
      g.fillStyle = "#3a2a1e"; g.textAlign = "left";
      g.fillText(fmt(d.value), left + w + 10, y + bh * 0.7);
    });
    g.textAlign = "left";
  }
  return { dataUrl: c.toDataURL("image/png"), w: W, h: H };
}

const norm = (rep) => ({
  ...rep,
  kpis: rep.kpis ?? [],
  charts: (rep.charts ?? []).filter((c) => c.data?.length),
  sections: (rep.sections ?? []).filter((s) => s.rows?.length),
});


/* ============================== EXCEL ============================== */
export async function exportExcel(input) {
const rep = {
  ...norm(input),
  sections: excluirHojas(norm(input).sections),
};

  const ExcelJS = (await import("exceljs")).default;
  const mascot = await loadImage("/images/guiño.png").catch(() => null);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Canelón";
  wb.created = new Date();

  const BROWN = "FF3A2A1E", CANELA = "FFB9793F", CREAM = "FFFDF6E9", LINE = "FFE5D8C3";
  const side = { style: "thin", color: { argb: LINE } };
  const border = { top: side, left: side, bottom: side, right: side };
  const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

  /* ---- Hoja Resumen ---- */
  const ws = wb.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  ws.columns = Array.from({ length: 10 }, () => ({ width: 17 }));

  for (let r = 1; r <= 4; r++) {
    ws.getRow(r).height = 24;
    for (let c = 1; c <= 10; c++) ws.getCell(r, c).fill = solid(BROWN);
  }
  ws.mergeCells("C1:J2");
  ws.mergeCells("C3:J4");
  Object.assign(ws.getCell("C1"), {
    value: `Canelón · ${rep.title}`,
    font: { name: "Georgia", size: 22, bold: true, color: { argb: "FFFBF3E4" } },
    alignment: { vertical: "middle" },
  });
  Object.assign(ws.getCell("C3"), {
    value: `${rep.subtitle ? rep.subtitle + " · " : ""}Generado: ${new Date().toLocaleString("es-GT")}`,
    font: { size: 11, color: { argb: "FFF3DFA8" } },
    alignment: { vertical: "top" },
  });
  if (mascot) {
    const id = wb.addImage({ base64: mascot.dataUrl, extension: "png" });

    const h = 125;

    ws.addImage(id, {
    tl: { col: 0.2, row: 0.1 },
    ext: {
        width: (h * mascot.w) / mascot.h,
        height: h
    }
    });
  }

  // KPIs (5 por fila, cada uno ocupa 2 columnas)
  let row = 6;
  rep.kpis.forEach((k, i) => {
    const col = 1 + (i % 5) * 2;
    const r = 6 + Math.floor(i / 5) * 3;
    ws.mergeCells(r, col, r, col + 1);
    ws.mergeCells(r + 1, col, r + 1, col + 1);
    const lab = ws.getCell(r, col), val = ws.getCell(r + 1, col);
    lab.value = k.label; lab.font = { size: 10, color: { argb: "FF7A6A5C" } };
    val.value = k.value; val.font = { name: "Georgia", size: 18, bold: true, color: { argb: BROWN } };
    for (const rr of [r, r + 1]) for (const cc of [col, col + 1]) {
      ws.getCell(rr, cc).fill = solid(CREAM);
      ws.getCell(rr, cc).border = border;
    }
    lab.alignment = val.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r + 1).height = 30;
    row = r + 3;
  });
  row += 1;

  // Gráficas (2 por fila)
  rep.charts.forEach((ch, i) => {
    const png = chartToPNG(ch);
    const id = wb.addImage({ base64: png.dataUrl, extension: "png" });
    const col = i % 2 === 0 ? 0 : 5;
    const r = row + Math.floor(i / 2) * 14;
    ws.addImage(id, { tl: { col, row: r - 1 }, ext: { width: 480, height: 250 } });
  });
  row += Math.ceil(rep.charts.length / 2) * 14 + 1;

  // Índice del contenido
  if (rep.sections.length) {
    ws.mergeCells(row, 1, row, 4);
    Object.assign(ws.getCell(row, 1), {
      value: "Contenido del archivo",
      font: { bold: true, size: 13, color: { argb: CANELA } },
    });
    rep.sections.forEach((s, i) => {
      ws.getCell(row + 1 + i, 1).value = s.title;
      ws.getCell(row + 1 + i, 3).value = `${s.rows.length} filas`;
      ws.getCell(row + 1 + i, 3).font = { color: { argb: "FF7A6A5C" } };
    });
  }

  /* ---- Hojas de datos ---- */
  const usados = new Set(["Resumen"]);
  rep.sections.forEach((s, idx) => {
    let name = s.title.replace(/[\\/?*[\]:]/g, "").slice(0, 28) || `Hoja ${idx + 1}`;
    while (usados.has(name)) name = `${name.slice(0, 25)} ${idx + 1}`;
    usados.add(name);

    s.columns = s.columns.filter(
        (c) => c.header.trim().toLowerCase() !== "imagen"
        );

    const sh = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3, showGridLines: false }] });
    sh.mergeCells(1, 1, 1, Math.max(s.columns.length, 2));
    Object.assign(sh.getCell(1, 1), {
      value: `${s.title} · Canelón`,
      font: { name: "Georgia", size: 15, bold: true, color: { argb: "FFFBF3E4" } },
      alignment: { vertical: "middle" },
    });
    sh.getRow(1).height = 28;
    s.columns.forEach((_, c) => (sh.getCell(1, c + 1).fill = solid(BROWN)));

    const head = sh.getRow(3);
    s.columns.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = solid(CANELA);
      cell.border = border;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    head.height = 24;

    s.rows.forEach((r, ri) => {
      const rowX = sh.getRow(4 + ri);
      s.columns.forEach((c, ci) => {
        const cell = rowX.getCell(ci + 1);
        cell.value = c.money ? Number(r[c.key] ?? 0) : r[c.key] ?? "";
        if (c.money) cell.numFmt = '"Q"#,##0.00';
        cell.border = border;
        cell.alignment = { vertical: "middle", wrapText: true };
        if (ri % 2 === 1) cell.fill = solid(CREAM);
      });
    });

    s.columns.forEach((c, i) => {
      const max = Math.max(c.header.length, ...s.rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length));
      sh.getColumn(i + 1).width = Math.min(Math.max(max + 3, 12), 45);
    });
    sh.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: s.columns.length } };
  });

  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${rep.filename}_${stamp()}.xlsx`
  );
}

/* =============================== PDF =============================== */
export async function exportPDF(input) {
  const rep = norm(input);
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const mascot = await loadImage("/images/guiño.png").catch(() => null);

  const landscape = rep.sections.some((s) => s.columns.length > 7);
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: landscape ? "landscape" : "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;

  // Banda de encabezado
  doc.setFillColor(58, 42, 30); doc.rect(0, 0, W, 92, "F");
  doc.setFillColor(224, 145, 60); doc.rect(0, 92, W, 4, "F");
  let tx = M;
  if (mascot) {
    const h = 78, w = (h * mascot.w) / mascot.h;
    doc.addImage(mascot.dataUrl, "PNG", M, 7, w, h);
    tx = M + w + 16;
  }
  doc.setTextColor(251, 243, 228); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text(`Canelón · ${rep.title}`, tx, 42);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(243, 223, 168);
  doc.text(rep.subtitle || "Reporte administrativo", tx, 60);
  doc.text(`Generado: ${new Date().toLocaleString("es-GT")}`, tx, 76);

  let y = 120;
  const need = (h) => {
    if (y + h > H - 50) { doc.addPage(); y = 40; }
  };

  // KPIs
  if (rep.kpis.length) {
    const per = Math.min(rep.kpis.length, 4);
    const gap = 10, cw = (W - 2 * M - gap * (per - 1)) / per;
    rep.kpis.forEach((k, i) => {
      if (i % per === 0 && i > 0) y += 64;
      need(60);
      const x = M + (i % per) * (cw + gap);
      doc.setFillColor(253, 246, 233); doc.setDrawColor(229, 216, 195);
      doc.roundedRect(x, y, cw, 52, 8, 8, "FD");
      doc.setTextColor(122, 106, 92); doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
      doc.text(String(k.label), x + 10, y + 18);
      doc.setTextColor(58, 42, 30); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
      doc.text(String(k.value), x + 10, y + 40);
    });
    y += 72;
  }

  // Gráficas (2 por fila)
  if (rep.charts.length) {
    const gap = 12, cw = (W - 2 * M - gap) / 2, ch = (cw * 520) / 1000;
    rep.charts.forEach((c, i) => {
      if (i % 2 === 0) need(ch + 12);
      const png = chartToPNG(c);
      const x = M + (i % 2) * (cw + gap);
      doc.addImage(png.dataUrl, "PNG", x, y, cw, ch);
      if (i % 2 === 1 || i === rep.charts.length - 1) y += ch + 14;
    });
  }

  // Tablas
  const maxRows = rep.pdfMaxRows ?? 300;
  const cell = (r, c) => {
    const v = r[c.key] ?? "";
    return c.money ? quetzal(v) : String(v);
  };
  rep.sections.forEach((s) => {
    need(70);
    doc.setTextColor(185, 121, 63); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(s.title, M, y);
    const rows = s.rows.slice(0, maxRows);
    autoTable(doc, {
      startY: y + 6,
      margin: { left: M, right: M, bottom: 46 },
      head: [s.columns.map((c) => c.header)],
      body: rows.map((r) => s.columns.map((c) => cell(r, c))),
      styles: { fontSize: landscape ? 7.5 : 8, cellPadding: 4, lineColor: [229, 216, 195], lineWidth: 0.4, textColor: [58, 42, 30] },
      headStyles: { fillColor: [185, 121, 63], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [253, 246, 233] },
      columnStyles: Object.fromEntries(
        s.columns.map((c, i) => [i, c.money ? { halign: "right" } : {}])
      ),
    });
    y = doc.lastAutoTable.finalY + 8;
    if (s.rows.length > rows.length) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(122, 106, 92);
      doc.text(`Se muestran ${rows.length} de ${s.rows.length} filas. El archivo Excel contiene todas.`, M, y + 4);
      y += 12;
    }
    y += 18;
  });

  // Pie de página en todas las hojas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(224, 145, 60); doc.setLineWidth(1);
    doc.line(M, H - 32, W - M, H - 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(122, 106, 92);
    doc.text("Canelón · Horneando felicidad en cada bocado", M, H - 18);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 18, { align: "right" });
  }

  doc.save(`${rep.filename}_${stamp()}.pdf`);
}
import { Router } from "express";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Lista blanca: NO se incluye la tabla admins (hashes de contraseña)
const TABLAS = [
  "orders", "order_items", "ventas_historicas",
  "products", "product_variants", "product_options",
  "puntos_clientes", "costos_fijos", "faqs", "valores",
];

// Solo se muestran los últimos 4 dígitos del DPI
const enmascarar = (r) =>
  r.dpi_cliente ? { ...r, dpi_cliente: `**** ***** ${String(r.dpi_cliente).slice(-4)}` } : r;

router.get("/", requireAuth, async (req, res) => {
  const out = {};

  for (const t of TABLAS) {
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${t}\``);
      out[t] = t === "ventas_historicas"
        ? rows.map(enmascarar)
        : rows;
    } catch (error) {
      console.error(`Error consultando ${t}:`, error.message);
      out[t] = [];
    }
  }

  res.json(out);
});

export default router;

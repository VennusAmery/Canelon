import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import contentRoutes from "./routes/content.js";
import authRoutes from "./routes/auth.js";
import adminVentasRoutes from "./routes/adminVentas.js";
import ordersRoutes from "./routes/orders.js";
import adminPedidosRoutes from "./routes/adminPedidos.js";
import adminMetricasRoutes from "./routes/adminMetricas.js";
import contactoRoutes from "./routes/contacto.js";
import "express-async-errors";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/images", express.static(path.join(__dirname, "public/images")));

// rutas
app.use("/api/auth", authRoutes);
app.use("/api", contentRoutes);
app.use("/api/admin/ventas", adminVentasRoutes);
app.use("/comprobantes", express.static(path.join(__dirname, "public/comprobantes")));
app.use("/api/orders", ordersRoutes);
app.use("/api/admin/pedidos", adminPedidosRoutes);
app.use("/api/admin/metricas", adminMetricasRoutes);
app.use("/api/contacto", contactoRoutes);

app.get("/api", (req, res) => {
  res.json({ ok: true, message: "API de Canelon funcionando." });
});

// ---------- Frontend compilado ----------
const FRONT_DIR = path.join(__dirname, "public-app");
if (fs.existsSync(FRONT_DIR)) {
  app.use(express.static(FRONT_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") ||
        req.path.startsWith("/images") ||
        req.path.startsWith("/comprobantes")) {
      return next();
    }
    res.sendFile(path.join(FRONT_DIR, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

app.listen(PORT, () => {
  console.log(`API de Canelon corriendo en http://localhost:${PORT}`);
});
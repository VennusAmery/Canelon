import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
  }

  const [rows] = await pool.query(
    "SELECT id, username, password_hash FROM admins WHERE username = ?",
    [username]
  );
  const admin = rows[0];

  if (!admin) {
    return res.status(401).json({ error: "Credenciales inválidas." });
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciales inválidas." });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token, username: admin.username });
});


// registro de usuarios
router.post("/register", requireAuth, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
      [username, hash]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ese usuario ya existe." });
    }
    throw err;
  }
});
export default router;
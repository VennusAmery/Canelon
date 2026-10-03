import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../lib/db.js";

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("Uso: node scripts/createAdmin.js <usuario> <contraseña>");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);

await pool.query(
  `INSERT INTO admins (username, password_hash) VALUES (?, ?)
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
  [username, hash]
);

console.log(`Admin "${username}" creado/actualizado.`);
process.exit(0);
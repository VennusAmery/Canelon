//conexion mysql
import 'dotenv/config';
import mysql from "mysql2/promise";

let ssl;
if (process.env.DB_CA) {
  ssl = { ca: process.env.DB_CA.replace(/\\n/g, "\n"), rejectUnauthorized: true };
} else if (process.env.DB_SSL === "true") {
  ssl = { rejectUnauthorized: false };
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  ssl,
});
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seedVentas() {
  const ventas = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../data/ventas.json"), "utf-8")
  );

  for (const v of ventas) {
    await pool.query(
      `INSERT INTO ventas_historicas
        (codigo_venta, dpi_cliente, nombre_cliente, categoria, producto, metodo_pago, estado_pedido, cantidad, precio_unitario, costo_envio, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nombre_cliente = VALUES(nombre_cliente),
         categoria = VALUES(categoria),
         producto = VALUES(producto),
         metodo_pago = VALUES(metodo_pago),
         estado_pedido = VALUES(estado_pedido),
         cantidad = VALUES(cantidad),
         precio_unitario = VALUES(precio_unitario),
         costo_envio = VALUES(costo_envio),
         total = VALUES(total)`,
      [
        v.codigo_venta,
        v.dpi_cliente,
        v.nombre_cliente,
        v.categoria,
        v.producto,
        v.metodo_pago,
        v.estado_pedido,
        v.cantidad,
        v.precio_unitario,
        v.costo_envio,
        v.total,
      ]
    );
  }

  console.log(`Ventas sembradas: ${ventas.length} registros.`);
  process.exit(0);
}

seedVentas().catch((err) => {
  console.error(err);
  process.exit(1);
});
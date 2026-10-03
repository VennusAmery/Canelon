import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const slugify = (str) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function seedMenu() {
  const menu = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../data/menu.json"), "utf-8")
  );

  for (const item of menu) {
    const productId = slugify(`${item.categoria}-${item.nombre}`);

    await pool.query(
      `INSERT INTO products (id, categoria, nombre, descripcion, precio, personalizable)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         categoria = VALUES(categoria),
         descripcion = VALUES(descripcion),
         precio = VALUES(precio),
         personalizable = VALUES(personalizable)`,
      [
        productId,
        item.categoria,
        item.nombre,
        item.descripcion || null,
        item.precio ?? null,
        !!item.personalizable,
      ]
    );

    if (item.variantes) {
      for (const [i, v] of item.variantes.entries()) {
        const variantId = `${productId}-${slugify(v.nombre)}`;
        await pool.query(
          `INSERT INTO product_variants (id, product_id, nombre, detalle, precio, orden)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE detalle = VALUES(detalle), precio = VALUES(precio), orden = VALUES(orden)`,
          [variantId, productId, v.nombre, v.detalle || null, v.precio, i]
        );
      }
    }

    if (item.opciones) {
      await pool.query(`DELETE FROM product_options WHERE product_id = ?`, [productId]);
      for (const [i, o] of item.opciones.entries()) {
        await pool.query(
          `INSERT INTO product_options (product_id, grupo, nombre, precio_extra, precio_extra_tamano_grande, orden)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            productId,
            o.grupo,
            o.nombre,
            o.precio_extra || 0,
            o.precio_extra_tamano_grande ?? null,
            i,
          ]
        );
      }
    }
  }

  console.log(`Menú sembrado: ${menu.length} productos.`);
  process.exit(0);
}

seedMenu().catch((err) => {
  console.error(err);
  process.exit(1);
});
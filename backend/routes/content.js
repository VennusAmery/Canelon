import { Router } from "express";
import { pool } from "../lib/db.js";

const router = Router();

router.get("/products", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, nombre, descripcion, precio, image FROM products"
  );
  const [variantRows] = await pool.query(
    "SELECT id, product_id, nombre, detalle, precio, imagen, orden FROM product_variants ORDER BY orden"
  );

  const products = rows.map((r) => {
    const variantes = variantRows
      .filter((v) => v.product_id === r.id)
      .map((v) => ({
        id: v.id,
        nombre: v.nombre,
        detalle: v.detalle,
        precio: v.precio,
        imagen: v.imagen,
      }));

    return {
      id: r.id,
      nombre: r.nombre,
      desc: r.descripcion,
      precio: r.precio,
      image: r.image,
      variantes,
    };
  });

  res.json(products);
});

router.get("/faqs", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, pregunta, respuesta FROM faqs"
  );
  const faqs = rows.map((r) => ({ q: r.pregunta, a: r.respuesta }));
  res.json(faqs);
});

router.get("/valores", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, nombre, descripcion FROM valores"
  );
  const valores = rows.map((r) => ({ nombre: r.nombre, desc: r.descripcion }));
  res.json(valores);
});

export default router;
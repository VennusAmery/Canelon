router.get("/products", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, nombre, descripcion, precio, image FROM products"
  );
  const [variantRows] = await pool.query(
    "SELECT id, product_id, nombre, detalle, precio, imagen, orden FROM product_variants ORDER BY orden"
  );
  const [optionRows] = await pool.query(
    "SELECT * FROM product_options ORDER BY orden"
  );

  const products = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    desc: r.descripcion,
    precio: r.precio,
    image: r.image,
    variantes: variantRows
      .filter((v) => v.product_id === r.id)
      .map((v) => ({
        id: v.id,
        nombre: v.nombre,
        detalle: v.detalle,
        precio: v.precio,
        imagen: v.imagen,
      })),
    opciones: optionRows
      .filter((o) => o.product_id === r.id)
      .map((o) => ({
        id: o.id,
        grupo: o.grupo,
        nombre: o.nombre,
        precio_extra: o.precio_extra || 0,
        precio_extra_tamano_grande: o.precio_extra_tamano_grande ?? null,
      })),
  }));

  res.json(products);
});
router.get("/api/products", async (req, res) => {
  const [products] = await pool.query(
    `SELECT * FROM products WHERE activo = TRUE ORDER BY orden, categoria`
  );
  const [variants] = await pool.query(`SELECT * FROM product_variants ORDER BY orden`);
  const [options] = await pool.query(`SELECT * FROM product_options ORDER BY orden`);

  const result = products.map((p) => ({
    id: p.id,
    categoria: p.categoria,
    nombre: p.nombre,
    desc: p.descripcion,
    precio: p.precio,
    image: p.image, 
    personalizable: !!p.personalizable,
    variantes: variants.filter((v) => v.product_id === p.id),
    opciones: options.filter((o) => o.product_id === p.id),
  }));

  res.json(result);
});
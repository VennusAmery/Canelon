import React, { createContext, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);

// Una línea del carrito = producto + variante elegida (si tiene)
const lineIdOf = (p) =>
  p.variantId != null ? `${p.id}:${p.variantId}` : String(p.id);

export function CartProvider({ children }) {
  // cada item: id (producto), variantId, variantNombre, lineId, nombre, precio, image, qty
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const addItem = (product) => {
    const lineId = lineIdOf(product);
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) =>
          i.lineId === lineId ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...product, lineId, qty: 1 }];
    });
  };

  const removeItem = (lineId) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const updateQty = (lineId, qty) => {
    if (qty <= 0) return removeItem(lineId);
    setItems((prev) =>
      prev.map((i) => (i.lineId === lineId ? { ...i, qty } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalCount = useMemo(
    () => items.reduce((sum, i) => sum + i.qty, 0),
    [items]
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + i.qty * i.precio, 0),
    [items]
  );

  const value = {
    items,
    addItem,
    removeItem,
    updateQty,
    clearCart,
    totalCount,
    totalPrice,
    isOpen,
    setIsOpen,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
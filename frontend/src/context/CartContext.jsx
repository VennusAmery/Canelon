import React, { createContext, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // id, nombre, precio, image
  const [isOpen, setIsOpen] = useState(false);
  
const addItem = (product) => {
  setItems((prev) => {
    const existing = prev.find((i) => i.id === product.id);
    if (existing) {
      return prev.map((i) =>
        i.id === product.id ? { ...i, qty: i.qty + 1 } : i
      );
    }
    return [...prev, { ...product, qty: 1 }];
  });
};

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) return removeItem(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)));
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

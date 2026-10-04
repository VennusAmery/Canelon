import React, { useState } from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "../../context/CartContext.jsx";
import CheckoutModal from "./CheckoutModal.jsx";
import './CartDrawer.css';

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, updateQty, removeItem, totalPrice, clearCart } =
    useCart();
  const [showCheckout, setShowCheckout] = useState(false);
  const [status, setStatus] = useState("idle");

  const handleOrderSuccess = () => {
    setShowCheckout(false);
    clearCart();
    setStatus("done");
    setTimeout(() => setStatus("idle"), 2500);
  };

  return (
    <>
      <div
        className={`cart-backdrop ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(false)}
      />
      <aside className={`cart-drawer ${isOpen ? "open" : ""}`} aria-label="Carrito de compras">
        <div className="cart-header">
          <h3>Tu carrito</h3>
          <button className="cart-close" onClick={() => setIsOpen(false)} aria-label="Cerrar carrito">
            <X size={22} />
          </button>
        </div>

        <div className="cart-items">
          {items.length === 0 && (
            <p className="cart-empty">Todavía no has agregado productos.</p>
          )}
          {items.map((item) => (
            <div className="cart-line" key={item.lineId}>
              <div className="thumb" style={{ backgroundImage: `url(${item.image})` }} />
              <div className="cart-line-info">
                <h4>{item.nombre}</h4>
                {item.variantNombre && (
                  <div className="precio-unit">{item.variantNombre}</div>
                )}
                <div className="precio-unit">Q{item.precio} c/u</div>
                <div className="qty-control">
                  <button onClick={() => updateQty(item.lineId, item.qty - 1)} aria-label="Quitar uno">
                    <Minus size={14} />
                  </button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.lineId, item.qty + 1)} aria-label="Agregar uno">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="cart-line-actions">
                <span className="subtotal">Q{item.qty * item.precio}</span>
                <button onClick={() => removeItem(item.lineId)} aria-label="Eliminar producto">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total</span>
              <span>Q{totalPrice}</span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCheckout(true)}>
              Finalizar pedido
            </button>
            {status === "done" && (
              <p style={{ color: "var(--canela)", marginTop: 10, fontSize: 14 }}>
                ¡Pedido recibido! Te contactaremos para confirmar.
              </p>
            )}
            <button className="cart-clear" onClick={clearCart}>
              Vaciar carrito
            </button>
          </div>
        )}
      </aside>

      {showCheckout && (
        <CheckoutModal
          items={items}
          total={totalPrice}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleOrderSuccess}
        />
      )}
    </>
  );
}
import React, { useEffect, useState } from "react";
import { Menu as MenuIcon, X, ShoppingBag } from "lucide-react";
import { useCart } from "../../context/CartContext.jsx";
import './Navbar.css';

const LINKS = [
  { id: "inicio", label: "Inicio" },
  { id: "menu", label: "Menú" },
  { id: "nosotros", label: "Sobre nosotros" },
  { id: "dudas", label: "Preguntas frecuentes" },
  { id: "redes", label: "Contacto" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { totalCount, setIsOpen } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (id) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>

      <div className="navbar-inner">
        <button className="navbar-brand" onClick={() => goTo("inicio")}>
          <img src="/images/canelon3.png" alt="Canelón" className="navbar-logo" />
        </button>

        <div className="navbar-links">
          {LINKS.map((l) => (
            <button key={l.id} onClick={() => goTo(l.id)}>
              {l.label}
            </button>
          ))}
        </div>

        <div className="navbar-actions">
          <button className="cart-btn" onClick={() => setIsOpen(true)} aria-label="Abrir carrito">
            <ShoppingBag size={18} />
            Carrito
            {totalCount > 0 && <span className="cart-badge">{totalCount}</span>}
          </button>
          <button className="nav-toggle" onClick={() => setOpen((v) => !v)} aria-label="Abrir menú">
            {open ? <X size={26} /> : <MenuIcon size={26} />}
          </button>
        </div>
      </div>

      <div className={`mobile-menu ${open ? "open" : ""}`}>
        {LINKS.map((l) => (
          <button key={l.id} onClick={() => goTo(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

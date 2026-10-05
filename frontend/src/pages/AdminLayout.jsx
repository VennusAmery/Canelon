import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  UserPlus,
  LogOut,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import "./AdminLayout.css";

// El token JWT ya trae el username en el payload
function getUsername() {
  try {
    const token = localStorage.getItem("admin_token");
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).username || "Administrador";
  } catch {
    return "Administrador";
  }
}

const LINKS = [
  { to: "/admin", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/admin/stock", label: "Inventario", icon: Package },
  { to: "/admin/usuarios", label: "Crear usuario", icon: UserPlus },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false); // sidebar en móvil
  const navigate = useNavigate();
  const username = getUsername();

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    navigate("/");
  };

  return (
    <div className="admin-shell">
      {/* Barra superior (solo móvil) */}
      <div className="admin-topbar">
        <button onClick={() => setOpen(true)} aria-label="Abrir menú">
          <MenuIcon size={22} />
        </button>
        <span>Canelón · Admin</span>
      </div>

      <div
        className={`admin-backdrop ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`admin-sidebar ${open ? "open" : ""}`}>
        <div className="admin-sidebar-head">

          <div className="admin-brand-wrap">

            <img
              src="/images/canelon3.png"
              alt="Canelón"
              className="admin-brand-image"
            />

            <div>
              <p className="admin-brand">Panel</p>
              <p className="admin-brand-sub">Administrativo</p>
            </div>

          </div>

          <button
            className="admin-sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>

        </div>

        <nav className="admin-nav">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `admin-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-user">
            <div className="admin-avatar">{username.charAt(0).toUpperCase()}</div>
            <div className="admin-user-info">
              <p className="admin-user-name">{username}</p>
              <p className="admin-user-role">Administrador</p>
            </div>
          </div>
          <button className="admin-logout" onClick={handleLogout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>

    </div>
  );
}

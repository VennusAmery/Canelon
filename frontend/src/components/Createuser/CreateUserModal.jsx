import React, { useState } from "react";
import { X } from "lucide-react";
import { API_ORIGIN } from "../../api/client.js";
import "./CreateUserModal.css";

export default function CreateUserModal({ onClose }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_ORIGIN}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear el usuario.");
        return;
      }
      setSuccess(true);
      setUsername("");
      setPassword("");
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cum-overlay" onClick={onClose}>
      <div className="cum-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cum-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
        <h2>Crear usuario administrador</h2>

        {success ? (
          <p className="cum-success">Usuario creado correctamente.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Usuario
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Contraseña
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </label>
            {error && <p className="cum-error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
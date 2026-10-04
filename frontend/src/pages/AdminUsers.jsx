import React, { useState } from "react";
import { API_ORIGIN } from "../api/client.js";
import "./AdminDashboard.css";
import "./AdminUsers.css";

export default function AdminUsers() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

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
      setSuccess(`Usuario "${username}" creado correctamente.`);
      setUsername("");
      setPassword("");
      setConfirm("");
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div>
          <p className="dash-kicker">Panel administrativo</p>
          <h1>Canelón · Crear usuario</h1>
        </div>
      </header>

      <div className="users-layout">
        <div className="dash-card users-card">
          <h3>Nuevo administrador</h3>
          <p className="users-hint">
            El nuevo usuario podrá iniciar sesión en este panel con estas credenciales.
          </p>

          <form onSubmit={handleSubmit}>
            <label>
              Usuario
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>

            <label>
              Confirmar contraseña
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>

            {error && <p className="users-error">{error}</p>}
            {success && <p className="users-success">{success}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </form>
        </div>

        <div className="users-image-container">
          <img
            src="/images/write.png"
            alt="Osito Canelón anotando"
            className="users-illustration"
          />
        </div>
      </div>
    </div>
  );
}
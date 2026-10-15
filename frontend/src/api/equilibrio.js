import { API_ORIGIN } from "./client.js";

export async function eqApi(path, method = "GET", body) {
  const token = localStorage.getItem("admin_token");
  const res = await fetch(`${API_ORIGIN}/api/admin/equilibrio${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    window.location.href = "/admin/login";
    throw new Error("Sesión expirada.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// Formato de moneda; muestra "—" cuando no hay dato
export const fmtQ = (n) =>
  n == null
    ? "—"
    : `Q${Number(n).toLocaleString("es-GT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
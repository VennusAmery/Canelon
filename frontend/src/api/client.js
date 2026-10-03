const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Origen del backend sin el sufijo /api, para armar URLs de imágenes
// (ej. http://localhost:4000/images/alfajores.jpg)
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status} al llamar ${path}`);
  }

  return res.json();
}

export function getProducts() {
  return request("/products");
}

export function getFaqs() {
  return request("/faqs");
}

export function getValores() {
  return request("/valores");
}

export async function createOrder(payload) {
  const res = await fetch(`${API_ORIGIN}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "No se pudo enviar el pedido.");
  }
  return data;
}

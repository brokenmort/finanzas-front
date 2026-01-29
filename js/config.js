// js/config.js
// Configuración local-only: el front siempre llama al API en localhost.
// - API_BASE fijo: http://127.0.0.1:8000
// - Helpers: apiUrl() y apiFetch()
// - Usa JWT guardado en sessionStorage ("authToken") por defecto.

(() => {
  const LOCAL_API_BASE = "http://127.0.0.1:8000";

  // Base API expuesto globalmente
  window.API_BASE = LOCAL_API_BASE;

  // Construye una URL absoluta a partir de un path.
  // Acepta: "/api/..." o "api/..." o una URL completa "http(s)://..."
  window.apiUrl = (path) => {
    if (!path) return window.API_BASE;
    if (/^https?:\/\//i.test(path)) return path;
    return window.API_BASE + (path.startsWith("/") ? path : `/${path}`);
  };

  // Fetch wrapper:
  // - JSON por defecto
  // - Adjunta Authorization: Bearer <token> si existe authToken en sessionStorage
  // - Si vas a enviar FormData (archivos), usa { json: false } y NO pongas Content-Type.
  window.apiFetch = async (path, opts = {}) => {
    const {
      json = true,
      auth = true,
      headers: extraHeaders,
      body,
      ...rest
    } = opts;

    const headers = new Headers(extraHeaders || {});

    // Si JSON, seteamos headers de JSON
    if (json) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
    }

    // Token JWT desde sessionStorage (coherente con tu login actual)
    if (auth && !headers.has("Authorization")) {
      let token = null;
      try {
        token = sessionStorage.getItem("authToken") || null;
      } catch (_) {
        token = null;
      }
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    const url = window.apiUrl(path);

    const init = {
      method: "GET",
      mode: "cors",
      credentials: "omit", // JWT en header. Si algún día usas cookies: "include"
      headers,
      ...rest,
    };

    // Body handling
    if (typeof body !== "undefined") {
      // Si no te pasaron method, asumimos POST
      if (!init.method || init.method === "GET") init.method = "POST";

      // JSON stringify si corresponde
      if (json && body && typeof body === "object") {
        init.body = JSON.stringify(body);
      } else {
        // FormData o string u otro
        init.body = body;
      }
    }

    return fetch(url, init);
  };

  console.info("[config] API_BASE:", window.API_BASE);
})();

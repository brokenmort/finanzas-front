// index.js (login)
// Usa window.API_BASE (inyectado por js/config.js) y evita URLs hardcodeadas.
// Intenta login contra varias rutas conocidas y normaliza la respuesta.

(() => {
  // Asegúrate de que js/config.js se cargó antes en index.html
  const API_BASE = (typeof window.API_BASE === "string" && window.API_BASE) 
    ? window.API_BASE 
    : window.location.origin;

  // Candidatos de endpoint (en orden de preferencia).
  // 1) Tu ruta antigua
  // 2) Otra ruta común en proyectos con users/
  // 3) SimpleJWT por defecto
  const LOGIN_ENDPOINTS = [
    `${API_BASE}/api/auth/login/`,
    `${API_BASE}/api/users/login/`,
    `${API_BASE}/api/token/`,
  ];

  const form = document.getElementById("loginForm");
  const messageDiv = document.getElementById("message");

  // Helpers UI
  const setMsg = (text, color = "black") => {
    messageDiv.style.color = color;
    messageDiv.textContent = text;
  };

  // Normaliza respuesta de distintos backends a { access, refresh? }
  const normalizeTokenResponse = (data, endpoint) => {
    // SimpleJWT: {access, refresh}
    if (data && data.access) return { access: data.access, refresh: data.refresh };

    // Otros backends: a veces {token: "..."} o {key:"..."}
    if (data && data.token) return { access: data.token, refresh: data.refresh };
    if (data && data.key)   return { access: data.key,   refresh: data.refresh };

    // Si es /api/token/ pero devolvió distinto
    if (endpoint.endsWith("/api/token/") && data) {
      if (data.access || data.refresh) return { access: data.access, refresh: data.refresh };
    }
    return null;
  };

  // Intenta loguear probando cada endpoint con el payload adecuado
  const tryLogin = async (email, password) => {
    for (const url of LOGIN_ENDPOINTS) {
      // payload por defecto: email/password
      let body = { email, password };

      // Si es SimpleJWT clásico, pide username/password
      if (url.endsWith("/api/token/")) {
        body = { username: email, password };
      }

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        // Si 404, probamos el siguiente endpoint sin ruido
        if (resp.status === 404) continue;

        const data = await resp.json().catch(() => ({}));

        if (resp.ok) {
          const tokens = normalizeTokenResponse(data, url);
          if (tokens && tokens.access) {
            return { ok: true, tokens, endpoint: url };
          }
          // Si la respuesta es 200 pero no trae token conocido, seguimos
          continue;
        } else {
          // Si hubo un 400/401 con detail, lo devolvemos para mostrar
          if (data && data.detail) {
            return { ok: false, error: data.detail, endpoint: url };
          }
          // Si no, seguimos probando la siguiente
          continue;
        }
      } catch (_) {
        // Error de red; intenta el siguiente endpoint
        continue;
      }
    }
    return { ok: false, error: "No se pudo iniciar sesión con los endpoints conocidos." };
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      setMsg("Por favor ingresa tus credenciales", "red");
      return;
    }

    setMsg("Verificando...");

    try {
      const result = await tryLogin(email, password);

      if (result.ok) {
        const { tokens, endpoint } = result;
        // Guarda tokens + info útil
        sessionStorage.setItem("authToken", tokens.access);
        if (tokens.refresh) sessionStorage.setItem("refreshToken", tokens.refresh);
        sessionStorage.setItem("username", email);
        sessionStorage.setItem("lastLoginEndpoint", endpoint);
        sessionStorage.setItem("apiBase", API_BASE);

        setMsg("✅ Login exitoso. Redirigiendo...", "green");
        setTimeout(() => (window.location.href = "home.html"), 1200);
      } else {
        setMsg("❌ " + (result.error || "Credenciales inválidas"), "red");
      }
    } catch (err) {
      setMsg("❌ Error de conexión: " + err.message, "red");
    }
  });

  // Log informativo en consola para depurar
  console.info("[login] API_BASE:", API_BASE, "candidatos:", LOGIN_ENDPOINTS);
})();

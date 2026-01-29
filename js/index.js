// index.js (login) — LOCAL ONLY
// ✅ CAMBIOS PRINCIPALES (comparado con tu versión):
// 1) Ya NO probamos varios endpoints (quitamos Render/paths alternos).
//    -> usamos SOLO el endpoint real de tu API local: /api/auth/login/
// 2) Ya NO usamos window.location.origin como fallback (podría apuntar al host del front, no del API).
//    -> usamos window.API_BASE (inyectado por config.js) y si no existe, caemos a http://127.0.0.1:8000
// 3) En vez de fetch directo, usamos apiFetch() (de config.js) para que:
//    - mantenga headers JSON consistentes
//    - puedas reutilizar el mismo patrón en el resto de vistas
// 4) Login robusto: intenta payload {email,password} y si falla intenta {username,password}
//    -> esto te evita problemas si SimpleJWT espera username en vez de email.

(() => {
  // ✅ MODIFICADO: fallback seguro a tu API local (evita apuntar al origin del FRONT)
  const API_BASE =
    (typeof window.API_BASE === "string" && window.API_BASE)
      ? window.API_BASE
      : "http://127.0.0.1:8000";

  // ✅ MODIFICADO: un solo endpoint real (tu router: path('auth/login/', ...))
  const LOGIN_URL = `${API_BASE}/api/auth/login/`;

  const form = document.getElementById("loginForm");
  const messageDiv = document.getElementById("message");

  // Helpers UI
  const setMsg = (text, color = "black") => {
    messageDiv.style.color = color;
    messageDiv.textContent = text;
  };

  // Normaliza respuesta de distintos backends a { access, refresh? }
  // (lo dejamos porque es útil si cambias backend o formato)
  const normalizeTokenResponse = (data) => {
    // SimpleJWT: {access, refresh}
    if (data && data.access) return { access: data.access, refresh: data.refresh };

    // Otros backends: a veces {token: "..."} o {key:"..."}
    if (data && data.token) return { access: data.token, refresh: data.refresh };
    if (data && data.key)   return { access: data.key,   refresh: data.refresh };

    return null;
  };

  // ✅ MODIFICADO: ya no iteramos LOGIN_ENDPOINTS; intentamos 2 payloads en el MISMO endpoint
  const tryLogin = async (email, password) => {
    // Helper para postear JSON usando apiFetch (de config.js)
    const post = async (body) => {
      // ✅ MODIFICADO: apiFetch ya maneja headers JSON por defecto
      const resp = await window.apiFetch("/api/auth/login/", {
        method: "POST",
        body,      // objeto -> apiFetch hace JSON.stringify()
        auth: false // ✅ MODIFICADO: en login NO debes mandar Authorization
      });
      const data = await resp.json().catch(() => ({}));
      return { resp, data };
    };

    // 1) Intento ideal: tu API debería aceptar email/password
    let { resp, data } = await post({ email, password });
    if (resp.ok) {
      const tokens = normalizeTokenResponse(data);
      if (tokens?.access) return { ok: true, tokens, endpoint: LOGIN_URL };
    }

    // 2) Fallback: si SimpleJWT espera username/password
    ({ resp, data } = await post({ username: email, password }));
    if (resp.ok) {
      const tokens = normalizeTokenResponse(data);
      if (tokens?.access) return { ok: true, tokens, endpoint: LOGIN_URL };
    }

    // Error útil
    const error =
      data?.detail ||
      (typeof data === "string" ? data : null) ||
      "No se pudo iniciar sesión (revisa credenciales o formato del payload).";

    return { ok: false, error, endpoint: LOGIN_URL, raw: data };
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

        // ✅ Se mantiene igual: guardas tokens en sessionStorage
        sessionStorage.setItem("authToken", tokens.access);
        if (tokens.refresh) sessionStorage.setItem("refreshToken", tokens.refresh);
        sessionStorage.setItem("username", email);

        // ✅ MODIFICADO: guardamos el endpoint y apiBase (útil para debug local)
        sessionStorage.setItem("lastLoginEndpoint", endpoint);
        sessionStorage.setItem("apiBase", API_BASE);

        setMsg("✅ Login exitoso. Redirigiendo...", "green");
        setTimeout(() => (window.location.href = "home.html"), 800);
      } else {
        console.warn("[login] fallo:", result.raw);
        setMsg("❌ " + (result.error || "Credenciales inválidas"), "red");
      }
    } catch (err) {
      setMsg("❌ Error de conexión: " + err.message, "red");
    }
  });

  // ✅ MODIFICADO: log más claro y con URL final
  console.info("[login] API_BASE:", API_BASE);
  console.info("[login] LOGIN_URL:", LOGIN_URL);
})();

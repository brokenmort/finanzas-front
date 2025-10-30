// new-password.js
// Pantalla de cambio de contrasena (confirm).
// - Usa API_BASE de js/config.js para hablar con el backend cross-origin.
// - Soporta email y token desde sessionStorage o desde la URL (?email=...&token=...).
// - Muestra errores del backend de forma clara.
// - Solo usa ASCII en comentarios.

document.addEventListener("DOMContentLoaded", () => {
  // 1) Base del API (inyectada por js/config.js)
  const API_BASE =
    typeof window.API_BASE === "string" && window.API_BASE
      ? window.API_BASE
      : window.location.origin;

  // Endpoint (ajusta si tu backend usa otra ruta)
  const API_URL = `${API_BASE}/api/auth/password-reset-confirm/`;

  // 2) Elementos
  const form = document.getElementById("newPassForm");
  const messageDiv = document.getElementById("message");

  // 3) Helpers
  const setMsg = (text, color) => {
    if (!messageDiv) return;
    messageDiv.style.color = color || "black";
    messageDiv.textContent = text || "";
  };

  // Lee email y token desde querystring o sessionStorage
  function getEmailToken() {
    const params = new URLSearchParams(window.location.search);
    const qEmail = params.get("email");
    const qToken = params.get("token");

    const sEmail = sessionStorage.getItem("resetEmail");
    const sToken = sessionStorage.getItem("resetToken");

    return {
      email: (qEmail || sEmail || "").trim(),
      token: (qToken || sToken || "").trim(),
    };
  }

  // 4) Submit
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const newPassword = (document.getElementById("newPassword")?.value || "").trim();
      const confirmPassword = (document.getElementById("confirmPassword")?.value || "").trim();

      const { email, token } = getEmailToken();

      // Validaciones basicas
      if (!newPassword || !confirmPassword) {
        setMsg("Faltan datos para cambiar la contrasena", "red");
        return;
      }
      if (newPassword !== confirmPassword) {
        setMsg("Error: Las contrasenas no coinciden", "red");
        return;
      }
      if (!email || !token) {
        setMsg("Faltan email y/o token. Abre el enlace de tu correo o vuelve a solicitar el cambio.", "red");
        return;
      }

      setMsg("Cambiando contrasena...", "black");

      try {
        const resp = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token, new_password: newPassword }),
        });

        // Intentar parsear JSON; si no es JSON, mostrar texto
        const ct = resp.headers.get("content-type") || "";
        let payload = null;
        try {
          payload = ct.includes("application/json") ? await resp.json() : null;
        } catch {
          payload = null;
        }

        if (resp.ok) {
          // Limpia posibles restos
          try {
            sessionStorage.removeItem("resetEmail");
            sessionStorage.removeItem("resetToken");
          } catch (_) {}

          setMsg("Listo. Contrasena cambiada correctamente. Redirigiendo a login...", "green");
          setTimeout(() => { window.location.href = "index.html"; }, 1500);
        } else {
          // Manejo de errores comun en DRF
          const detail =
            (payload && (payload.detail || payload.error || payload.message)) ||
            (await resp.text()).slice(0, 300) ||
            "Error cambiando la contrasena";

          setMsg("Error: " + detail, "red");
        }
      } catch (err) {
        setMsg("Error de conexion: " + (err?.message || String(err)), "red");
      }
    });
  }

  // 5) UX: si hay email/token en URL, guardalos para siguientes pasos
  (() => {
    try {
      const { email, token } = getEmailToken();
      if (email) sessionStorage.setItem("resetEmail", email);
      if (token) sessionStorage.setItem("resetToken", token);
    } catch (_) {}
  })();

  console.info("[new-password] API_BASE:", API_BASE);
});

// recover-password.js
// Solicita código de recuperación a /api/auth/password-reset/ (DRF / custom).
// Usa window.API_BASE (inyectado por js/config.js) para funcionar cross-origin.

(function () {
  const API_BASE =
    (typeof window.API_BASE === "string" && window.API_BASE) ||
    window.location.origin;

  const API_URL = `${API_BASE}/api/auth/password-reset/`;
  const form = document.getElementById("resetForm");
  const messageDiv = document.getElementById("message");

  if (!form) {
    console.error("[recover-password] No se encontró el formulario #resetForm");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (document.getElementById("usuario")?.value || "").trim();

    if (!email) return showMessage("Por favor ingresa un correo válido", "red");

    showMessage("Enviando código...", "black");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errText = await parseError(response);
        showMessage("Error: " + errText, "red");
        return;
      }

      // éxito
      sessionStorage.setItem("resetEmail", email);
      showMessage(
        "Listo. Te enviamos un código de verificación a tu correo",
        "green"
      );
      setTimeout(() => {
        window.location.href = "verify-code.html";
      }, 1500);
    } catch (err) {
      showMessage("Error de conexión: " + (err?.message || err), "red");
    }
  });

  function showMessage(text, color) {
    if (!messageDiv) return console.log(text);
    messageDiv.style.color = color || "black";
    messageDiv.textContent = text;
  }

  // Intenta leer JSON estándar de DRF: {detail}|{error}|{message}|{...}
  async function parseError(resp) {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const j = await resp.json();
        return (
          j.detail ||
          j.error ||
          j.message ||
          JSON.stringify(j).slice(0, 400) ||
          `HTTP ${resp.status}`
        );
      } catch (_) {}
    }
    const txt = (await resp.text()) || "";
    // Si el backend devolvió HTML (p.ej. 502 de plataforma), evita ensuciar la UI
    return txt.replace(/<[^>]+>/g, "").slice(0, 400) || `HTTP ${resp.status}`;
  }

  console.info("[recover-password] API_BASE:", API_BASE);
})();

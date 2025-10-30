// verify-code.js
// Verificación del código para resetear contraseña.
// Front (Netlify/Vercel) -> API (Render) usando window.API_BASE (definido en js/config.js).

(function () {
  const form = document.getElementById("verifyForm");
  const messageDiv = document.getElementById("message");

  if (!form) {
    console.error("[verify-code] No se encontró #verifyForm");
    return;
  }

  const API_BASE =
    (typeof window.API_BASE === "string" && window.API_BASE) ||
    window.location.origin;
  const API_URL = `${API_BASE}/api/auth/password-verify/`;

  function showMessage(text, color) {
    if (!messageDiv) { alert(text); return; }
    messageDiv.style.color = color || "black";
    messageDiv.textContent = text;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = (document.getElementById("code")?.value || "").trim();
    const email = sessionStorage.getItem("resetEmail");

    if (!token || !email) {
      return showMessage("Faltan datos para verificar.", "red");
    }

    showMessage("Verificando código...", "black");

    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, token }),
      });

      if (!resp.ok) {
        const errText = await parseError(resp);
        return showMessage("Error: " + errText, "red");
      }

      // Esperamos formato { valid: true/false }
      const data = await resp.json();
      if (data && data.valid) {
        sessionStorage.setItem("resetToken", token);
        showMessage("Listo. Código verificado. Redirigiendo...", "green");
        setTimeout(() => { window.location.href = "new-password.html"; }, 1500);
      } else {
        showMessage("Error: Código inválido o expirado.", "red");
      }
    } catch (err) {
      showMessage("Error de conexión: " + (err?.message || err), "red");
    }
  });

  // Lee JSON de error de DRF o limpia HTML si la plataforma devuelve una página.
  async function parseError(resp) {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const j = await resp.json();
        return j.detail || j.error || j.message || JSON.stringify(j).slice(0, 400);
      } catch (_) {}
    }
    const txt = (await resp.text()) || "";
    return txt.replace(/<[^>]+>/g, "").slice(0, 400) || `HTTP ${resp.status}`;
  }

  console.info("[verify-code] API_BASE:", API_BASE);
})();

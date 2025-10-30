// verify-signup.js
// Verificación del código de registro (signup).
// Front (Netlify/Vercel) -> API (Render) usando window.API_BASE (definido en js/config.js).

(function () {
  const form = document.getElementById("verifySignupForm");
  const messageDiv = document.getElementById("message");

  if (!form) {
    console.error("[verify-signup] No se encontró #verifySignupForm");
    return;
  }

  const API_BASE =
    (typeof window.API_BASE === "string" && window.API_BASE) ||
    window.location.origin;
  const API_URL = `${API_BASE}/api/auth/signup-verify/`;

  function showMessage(text, color) {
    if (!messageDiv) { alert(text); return; }
    messageDiv.style.color = color || "black";
    messageDiv.textContent = text;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = (document.getElementById("code")?.value || "").trim();
    const email = sessionStorage.getItem("signupEmail");

    if (!token || !email) {
      return showMessage("Faltan datos para verificar.", "red");
    }

    showMessage("Verificando código...", "black");

    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ email, token }),
      });

      if (!resp.ok) {
        const errText = await parseError(resp);
        return showMessage("Error: " + errText, "red");
      }

      // Éxito
      showMessage("Cuenta creada. Redirigiendo a login...", "green");
      setTimeout(() => { window.location.href = "index.html"; }, 1500);
    } catch (err) {
      showMessage("Error de conexión: " + (err?.message || err), "red");
    }
  });

  // Extrae mensaje de error útil de DRF (JSON) o limpia HTML si hay una página de error.
  async function parseError(resp) {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const j = await resp.json();
        return j.error || j.detail || j.message || JSON.stringify(j).slice(0, 400);
      } catch (_) { /* ignore */ }
    }
    const txt = (await resp.text()) || "";
    return txt.replace(/<[^>]+>/g, "").slice(0, 400) || `HTTP ${resp.status}`;
  }

  console.info("[verify-signup] API_BASE:", API_BASE);
})();

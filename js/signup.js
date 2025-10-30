// signup.js
// Front separado (Netlify/Vercel) -> API en Render usando window.API_BASE (definido en js/config.js)

(function () {
  const btn = document.getElementById("signup-btn");
  const messageDiv = document.getElementById("message");

  if (!btn) {
    console.error("[signup] No se encontró #signup-btn");
    return;
  }

  function showMessage(txt, color) {
    if (!messageDiv) { alert(txt); return; }
    messageDiv.style.color = color || "black";
    messageDiv.textContent = txt;
  }

  // Valida formato básico de email
  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  btn.addEventListener("click", async function () {
    const email = (document.getElementById("email")?.value || "").trim();
    const firstName = (document.getElementById("firstname")?.value || "").trim();
    const lastName = (document.getElementById("lastname")?.value || "").trim();
    const birthday = (document.getElementById("birthday")?.value || "").trim();
    const phone = (document.getElementById("phone")?.value || "").trim();
    const country = (document.getElementById("country")?.value || "").trim();
    const password = document.getElementById("password")?.value || "";
    const confirmPassword = document.getElementById("confirm-password")?.value || "";

    if (!email || !birthday || !phone || !country || !password || !confirmPassword) {
      return showMessage("Por favor completa todos los campos obligatorios.", "red");
    }
    if (!isEmail(email)) {
      return showMessage("Ingresa un correo válido.", "red");
    }
    if (password !== confirmPassword) {
      return showMessage("Las contraseñas no coinciden.", "red");
    }

    showMessage("Enviando solicitud...", "black");

    const API_BASE =
      (typeof window.API_BASE === "string" && window.API_BASE) ||
      window.location.origin;

    try {
      const resp = await fetch(`${API_BASE}/api/auth/signup-request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email,
          password,
          birthday,
          phone,
          country,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      if (!resp.ok) {
        const errText = await parseError(resp);
        return showMessage("Error: " + errText, "red");
      }

      // Éxito: guardamos correo para el paso de verificación
      sessionStorage.setItem("signupEmail", email);
      showMessage("Solicitud enviada. Te redirigimos para verificar el código...", "green");
      setTimeout(() => { window.location.href = "verify-signup.html"; }, 1200);
    } catch (err) {
      showMessage("Error de conexión: " + (err?.message || err), "red");
    }
  });

  // Lee JSON estándar de DRF o limpia HTML si viene un error de plataforma
  async function parseError(resp) {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const j = await resp.json();
        return j.error || j.detail || j.message || JSON.stringify(j).slice(0, 400);
      } catch (_) {}
    }
    const txt = (await resp.text()) || "";
    return txt.replace(/<[^>]+>/g, "").slice(0, 400) || `HTTP ${resp.status}`;
  }

  console.info("[signup] API_BASE:", (typeof window.API_BASE === "string" && window.API_BASE) || window.location.origin);
})();

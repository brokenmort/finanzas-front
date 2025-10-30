document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.API_BASE || window.location.origin;
  const API_URL = `${API_BASE}/api/auth/signup-verify/`;
  const form = document.getElementById("verifySignupForm");
  const messageDiv = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = document.getElementById("code").value.trim();
    const email = sessionStorage.getItem("signupEmail");

    if (!token || !email) {
      messageDiv.style.color = "red";
      messageDiv.textContent = "Faltan datos para verificar";
      return;
    }

    messageDiv.style.color = "black";
    messageDiv.textContent = "Verificando codigo...";

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token })
      });

      const ct = response.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await response.json() : {};

      if (response.ok) {
        messageDiv.style.color = "green";
        messageDiv.textContent = "Cuenta creada. Redirigiendo a login...";
        setTimeout(() => { window.location.href = "index.html"; }, 1500);
      } else {
        messageDiv.style.color = "red";
        messageDiv.textContent = "Error: " + (data.error || data.detail || "Codigo invalido");
      }

    } catch (err) {
      messageDiv.style.color = "red";
      messageDiv.textContent = "Error de conexion: " + err.message;
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.API_BASE || window.location.origin;
  const API_URL = `${API_BASE}/api/auth/password-verify/`;
  const form = document.getElementById("verifyForm");
  const messageDiv = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = document.getElementById("code").value.trim();
    const email = sessionStorage.getItem("resetEmail");

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

      const contentType = response.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Respuesta no JSON:", text);
        throw new Error("El servidor respondio HTML; revisa la URL o la configuracion del servidor.");
      }

      if (response.ok && data.valid) {
        sessionStorage.setItem("resetToken", token);
        messageDiv.style.color = "green";
        messageDiv.textContent = "Listo. Codigo verificado. Redirigiendo...";
        setTimeout(() => { window.location.href = "new-password.html"; }, 1500);
      } else {
        messageDiv.style.color = "red";
        messageDiv.textContent = "Error: Codigo invalido o expirado";
      }

    } catch (err) {
      messageDiv.style.color = "red";
      messageDiv.textContent = "Error de conexion: " + err.message;
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.API_BASE || window.location.origin;
  const API_URL = `${API_BASE}/api/auth/password-reset-confirm/`;
  const form = document.getElementById("newPassForm");
  const messageDiv = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById("newPassword").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    const email = sessionStorage.getItem("resetEmail");
    const token = sessionStorage.getItem("resetToken");

    if (!newPassword || !confirmPassword || !email || !token) {
      messageDiv.style.color = "red";
      messageDiv.textContent = "Faltan datos para cambiar la contrasena";
      return;
    }

    if (newPassword !== confirmPassword) {
      messageDiv.style.color = "red";
      messageDiv.textContent = "Error: Las contrasenas no coinciden";
      return;
    }

    messageDiv.style.color = "black";
    messageDiv.textContent = "Cambiando contrasena...";

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, new_password: newPassword })
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

      if (response.ok) {
        messageDiv.style.color = "green";
        messageDiv.textContent = "Listo. Contrasena cambiada correctamente. Redirigiendo a login...";
        setTimeout(() => { window.location.href = "index.html"; }, 2000);
      } else {
        messageDiv.style.color = "red";
        messageDiv.textContent = "Error: " + (data.error || "Error cambiando la contrasena");
      }

    } catch (err) {
      messageDiv.style.color = "red";
      messageDiv.textContent = "Error de conexion: " + err.message;
    }
  });
});

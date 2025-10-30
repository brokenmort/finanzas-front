const API_BASE = window.API_BASE || "https://pagina-web-finansas-b6474cfcee14.herokuapp.com";
const API_URL = `${API_BASE}/api/auth/login/`;
const form = document.getElementById("loginForm");
const messageDiv = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    messageDiv.style.color = "red";
    messageDiv.textContent = "Por favor ingresa tus credenciales";
    return;
  }

  messageDiv.style.color = "black";
  messageDiv.textContent = "Verificando...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Guardamos usuario y token en sessionStorage
      sessionStorage.setItem("authToken", data.access);
      sessionStorage.setItem("username", email);

      messageDiv.style.color = "green";
      messageDiv.textContent = "✅ Login exitoso. Redirigiendo...";
      setTimeout(() => { window.location.href = "home.html"; }, 1500);
    } else {
      messageDiv.style.color = "red";
      messageDiv.textContent = "❌ " + (data.detail || "Credenciales inválidas");
    }

  } catch (err) {
    messageDiv.style.color = "red";
    messageDiv.textContent = "❌ Error de conexión: " + err.message;
  }
});

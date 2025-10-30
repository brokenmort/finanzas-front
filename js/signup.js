document.getElementById('signup-btn').addEventListener('click', async function () {
  const email = document.getElementById('email').value.trim();
  const firstName = document.getElementById('firstname').value.trim();
  const lastName = document.getElementById('lastname').value.trim();
  const birthday = document.getElementById('birthday').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const country = document.getElementById('country').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  const messageDiv = document.getElementById('message');
  function showMessage(txt, color) {
    if (!messageDiv) { alert(txt); return; }
    messageDiv.style.color = color;
    messageDiv.textContent = txt;
  }

  if (!email || !birthday || !phone || !country || !password || !confirmPassword) {
    showMessage('Por favor completa todos los campos obligatorios.', 'red');
    return;
  }
  if (password !== confirmPassword) {
    showMessage('Las contrasenas no coinciden.', 'red');
    return;
  }

  showMessage('Enviando solicitud...', 'black');

  try {
    const API_BASE = window.API_BASE || window.location.origin;
    const response = await fetch(`${API_BASE}/api/auth/signup-request/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email, password, birthday, phone, country, first_name: firstName, last_name: lastName,
      }),
    });

    const ct = response.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await response.json() : {};

    if (response.ok) {
      sessionStorage.setItem('signupEmail', email);
      showMessage('Solicitud enviada. Te redirigimos para verificar el codigo...', 'green');
      setTimeout(() => { window.location.href = 'verify-signup.html'; }, 1200);
    } else {
      showMessage('Error: ' + (data.error || data.detail || 'No fue posible crear la solicitud'), 'red');
    }
  } catch (err) {
    showMessage('Error de conexion: ' + err.message, 'red');
  }
});


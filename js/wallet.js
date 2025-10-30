document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const API_BASE = window.API_BASE || window.location.origin;
  const nameEl = document.getElementById('walletUsername');
  const iconEl = document.getElementById('walletProfileIcon');
  const imgEl = document.getElementById('walletProfileImage');

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    const path = s.startsWith('/') ? s : `/${s}`;
    return `${API_BASE}${path}`;
  };
  try {
    const res = await fetch(`${API_BASE}/api/auth/me/`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
    });
    if (!res.ok) throw new Error('No autorizado');
    const data = await res.json();
    if (nameEl) nameEl.textContent = (data.first_name || data.email || 'Usuario');
    try {
      const url = resolveImageUrl(data && data.profile_image);
      if (url && imgEl && iconEl) {
        imgEl.onload = () => { imgEl.style.display = 'block'; iconEl.style.display = 'none'; };
        imgEl.onerror = () => { imgEl.style.display = 'none'; iconEl.style.display = 'block'; };
        imgEl.src = url + (url.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`);
      }
    } catch (_) {}
  } catch (e) {
    // Si falla, fuerza login
    window.location.href = 'index.html';
  }
});

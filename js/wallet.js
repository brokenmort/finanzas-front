// wallet.js
// Vista "Wallet": obtiene perfil y muestra nombre + avatar.
// Front (Netlify/Vercel) -> API (Render) usando window.API_BASE.

document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const API_BASE =
    (typeof window.API_BASE === 'string' && window.API_BASE) ||
    window.location.origin;

  const nameEl = document.getElementById('walletUsername');
  const iconEl = document.getElementById('walletProfileIcon');
  const imgEl  = document.getElementById('walletProfileImage');

  // Normaliza rutas relativas que vengan del backend
  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;       // ya es absoluta
    const path = s.startsWith('/') ? s : `/${s}`; // hazla absoluta respecto al API
    return `${API_BASE}${path}`;
  };

  const showIcon = () => {
    if (imgEl) imgEl.style.display = 'none';
    if (iconEl) iconEl.style.display = 'block';
  };

  const setProfileImageFromUrl = async (rawUrl) => {
    const absUrl = resolveImageUrl(rawUrl);
    if (!absUrl || !imgEl || !iconEl) return showIcon();

    // 1) Intento directo (público)
    iconEl.style.display = 'none';
    imgEl.style.display = 'block';
    const directUrl = absUrl + (absUrl.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`);

    imgEl.onerror = async () => {
      // 2) Reintento con fetch + token (si el recurso requiere auth)
      try {
        const res = await fetch(absUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('fetch image not ok');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        imgEl.onload = () => { imgEl.style.display = 'block'; iconEl.style.display = 'none'; };
        imgEl.src = url;
      } catch {
        showIcon();
      }
    };
    imgEl.onload = () => { imgEl.style.display = 'block'; iconEl.style.display = 'none'; };
    imgEl.src = directUrl;
  };

  try {
    const res = await fetch(`${API_BASE}/api/auth/me/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
      },
    });
    if (!res.ok) throw new Error('No autorizado');

    const data = await res.json();
    if (nameEl) nameEl.textContent = data.first_name || data.email || 'Usuario';

    if (data && data.profile_image) {
      await setProfileImageFromUrl(data.profile_image);
    } else {
      showIcon();
    }
  } catch (e) {
    // Si falla (401/403/etc), forzamos login
    window.location.href = 'index.html';
  }
});

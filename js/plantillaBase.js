document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const API_BASE = window.API_BASE || window.location.origin;

  const profileIcon = document.getElementById('baseProfileIcon');
  const profileImage = document.getElementById('baseProfileImage');
  let userId = null;

  const showIconFallback = () => {
    if (profileImage) profileImage.style.display = 'none';
    if (profileIcon) profileIcon.style.display = 'block';
  };

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    const path = s.startsWith('/') ? s : `/${s}`;
    return `${API_BASE}${path}`;
  };

  const setProfileImageFromUrl = async (rawUrl) => {
    const absUrl = resolveImageUrl(rawUrl);
    if (!absUrl) { showIconFallback(); return; }

    // Estado inicial: intentar carga directa con cache-busting
    profileIcon.style.display = 'none';
    profileImage.style.display = 'block';
    const directUrl = absUrl + (absUrl.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`);

    profileImage.onerror = async () => {
      try {
        // Fallback: fetch autenticado (por si el recurso requiere cabecera Authorization)
        const res = await fetch(absUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('fetch image not ok');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        profileImage.src = url;
        profileImage.onload = () => {
          profileImage.style.display = 'block';
          profileIcon.style.display = 'none';
        };
      } catch {
        // Último intento: cache local por userId si existe
        try {
          const k = userId ? `profileImage:${userId}` : null;
          const dataUrl = k ? localStorage.getItem(k) : null;
          if (dataUrl) {
            profileImage.src = dataUrl;
            profileImage.onload = () => {
              profileImage.style.display = 'block';
              profileIcon.style.display = 'none';
            };
            return;
          }
        } catch(_) {}
        showIconFallback();
      }
    };

    profileImage.onload = () => {
      profileImage.style.display = 'block';
      profileIcon.style.display = 'none';
    };
    profileImage.src = directUrl;
  };

  // Cargar datos básicos del usuario
  fetch(`${API_BASE}/api/auth/me/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
  })
    .then((res) => { if (!res.ok) throw new Error('No autorizado'); return res.json(); })
    .then((data) => {
      try { if (data && data.id) userId = data.id; } catch(_) {}
      const name = (data && (data.first_name || data.email)) || 'Usuario';
      const nameEl = document.getElementById('displayName');
      if (nameEl) nameEl.textContent = name;

      if (data && data.profile_image) {
        setProfileImageFromUrl(data.profile_image);
      } else {
        // Intento de cache local si no hay URL remota disponible
        try {
          const k = userId ? `profileImage:${userId}` : null;
          const dataUrl = k ? localStorage.getItem(k) : null;
          if (dataUrl) {
            profileImage.src = dataUrl;
            profileImage.onload = () => {
              profileImage.style.display = 'block';
              profileIcon.style.display = 'none';
            };
          } else {
            showIconFallback();
          }
        } catch(_) { showIconFallback(); }
      }
    })
    .catch((err) => {
      console.error('Error al cargar datos:', err);
      showIconFallback();
    });
});


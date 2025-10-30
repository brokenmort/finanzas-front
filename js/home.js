// home.js
// Home con API desacoplada (Render). Sin dominios hardcodeados.
// - Usa window.API_BASE inyectado por js/config.js
// - Descubre y cachea el endpoint "me" (varios nombres posibles)
// - Maneja 401 (token expirado) → redirige al login
// - Muestra botón Admin solo si es staff/superuser y apunta a API_BASE/admin/

document.addEventListener("DOMContentLoaded", () => {
  // 0) Autenticación básica
  const token = sessionStorage.getItem("authToken");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // 1) BASE del API: viene de js/config.js
  const API_BASE =
    typeof window.API_BASE === "string" && window.API_BASE
      ? window.API_BASE
      : window.location.origin;

  // 2) Elementos de UI
  const profileIcon  = document.getElementById("homeProfileIcon");
  const profileImage = document.getElementById("homeProfileImage");
  const usernameEl   = document.getElementById("username");
  const adminBtn     = document.getElementById("adminBtn");
  const logoutBtn    = document.getElementById("logoutBtn");

  // 3) Helpers UI
  const showIconFallback = () => {
    if (profileImage) profileImage.style.display = "none";
    if (profileIcon) profileIcon.style.display = "block";
  };

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s; // absoluta (p.ej. Cloudinary)
    const path = s.startsWith("/") ? s : `/${s}`;
    return `${API_BASE}${path}`;           // relativa al backend (e.g. /media/…)
  };

  // 4) fetch con auth + manejo 401
  async function authFetch(url, options = {}) {
    const resp = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(options.headers || {}),
      },
    });
    if (resp.status === 401) {
      sessionStorage.clear();
      window.location.href = "index.html";
      throw new Error("No autorizado");
    }
    return resp;
  }

  // 5) Descubridor de endpoints (cache en sessionStorage)
  async function discoverOnce(key, candidates) {
    const cached = sessionStorage.getItem(key);
    if (cached) return cached;

    for (const url of candidates) {
      try {
        const r = await authFetch(url, { method: "GET" });
        if (r.ok) {
          sessionStorage.setItem(key, url);
          return url;
        }
      } catch {
        // prueba siguiente candidato
      }
    }
    // si ninguno fue OK, devolvemos el primero para que el error sea visible
    return candidates[0];
  }

  // 6) Perfil (me) con nombres alternativos
  async function fetchMe() {
    const ME_KEY = "endpoint_me";
    const candidates = [
      `${API_BASE}/api/auth/me/`,
      `${API_BASE}/api/users/me/`,
      `${API_BASE}/api/me/`,
      `${API_BASE}/api/user/me/`,
    ];
    const meUrl = await discoverOnce(ME_KEY, candidates);
    const res = await authFetch(meUrl);
    if (!res.ok) throw new Error("No autorizado");
    return res.json();
  }

  // 7) Establecer imagen de perfil (con fallback y modo “fetch blob” si 403 en media)
  let userId = null;
  const setProfileImageFromUrl = async (rawUrl) => {
    const absUrl = resolveImageUrl(rawUrl);
    if (!absUrl) { showIconFallback(); return; }

    if (profileIcon)  profileIcon.style.display  = "none";
    if (profileImage) profileImage.style.display = "block";

    const directUrl = absUrl + (absUrl.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`);

    if (!profileImage) return; // defensa
    profileImage.onerror = async () => {
      try {
        // si falla la carga directa (p.ej. media privada), intentamos con fetch+blob
        const res = await fetch(absUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("fetch image not ok");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        profileImage.src = url;
        profileImage.onload = () => {
          profileImage.style.display = "block";
          if (profileIcon) profileIcon.style.display = "none";
        };
      } catch {
        // Intentar cache local por userId
        try {
          const k = userId ? `profileImage:${userId}` : null;
          if (k) {
            const dataUrl = localStorage.getItem(k);
            if (dataUrl) {
              profileImage.src = dataUrl;
              profileImage.onload = () => {
                profileImage.style.display = "block";
                if (profileIcon) profileIcon.style.display = "none";
              };
              return;
            }
          }
        } catch {}
        showIconFallback();
      }
    };
    profileImage.onload = () => {
      profileImage.style.display = "block";
      if (profileIcon) profileIcon.style.display = "none";
    };
    profileImage.src = directUrl;
  };

  // 8) Cargar datos del usuario y preparar UI
  fetchMe()
    .then((data) => {
      try { if (data && data.id) userId = data.id; } catch {}
      if (usernameEl) usernameEl.textContent = (data.first_name || data.email || "Usuario");

      if (data && data.profile_image) {
        setProfileImageFromUrl(data.profile_image);
      } else {
        // si no hay URL remota intenta cache local
        try {
          const k = userId ? `profileImage:${userId}` : null;
          const dataUrl = k ? localStorage.getItem(k) : null;
          if (dataUrl && profileImage) {
            profileImage.src = dataUrl;
            profileImage.onload = () => {
              profileImage.style.display = "block";
              if (profileIcon) profileIcon.style.display = "none";
            };
          } else {
            showIconFallback();
          }
        } catch { showIconFallback(); }
      }

      // Botón Admin solo para staff/superuser
      try {
        if (adminBtn) {
          const isAdmin = !!(data && (data.is_staff || data.is_superuser));
          if (isAdmin) {
            adminBtn.style.display = "inline-block";
            adminBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              // 👉 importante: admin del BACKEND (API), no del dominio del front
              window.location.href = `${API_BASE}/admin/`;
            });
          } else {
            adminBtn.style.display = "none";
          }
        }
      } catch {}
    })
    .catch((err) => {
      console.error("Error al cargar datos:", err);
      // Si aquí recibimos un 401, authFetch ya redirigió al login.
    });

  // 9) Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("firstName");
      window.location.href = "index.html";
    });
  }

  // Log útil
  console.info("[home] API_BASE:", API_BASE);
});

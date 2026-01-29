// home.js (LOCAL)
// ✅ CAMBIOS vs tu versión anterior:
// 1) Ya NO usamos window.location.origin como fallback (eso apunta al host del FRONT).
//    -> usamos window.API_BASE (config.js) y si no existe, caemos a http://127.0.0.1:8000
// 2) Ya NO "descubrimos" endpoints con varios candidatos.
//    -> usamos el endpoint REAL de tu API: GET /api/auth/me/
// 3) Ya NO usamos authFetch propio.
//    -> usamos window.apiFetch() (config.js), que ya adjunta Bearer automáticamente.
// 4) Si el token no existe o expira (401/403), limpiamos sesión y redirigimos a index.html.
// 5) Para profile_image: si la URL viene relativa, la convertimos contra API_BASE.

document.addEventListener("DOMContentLoaded", () => {
  // 0) Autenticación básica
  const token = sessionStorage.getItem("authToken");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // ✅ MODIFICADO: base del API SIEMPRE desde config.js
  const API_BASE =
    (typeof window.API_BASE === "string" && window.API_BASE)
      ? window.API_BASE
      : "http://127.0.0.1:8000";

  // ✅ MODIFICADO: endpoint fijo (tu router actual)
  const ME_URL = "/api/auth/me/";

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

  // ✅ MODIFICADO: normaliza URL de imagen (absoluta vs relativa)
  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;     // absoluta (Cloudinary, etc.)
    const path = s.startsWith("/") ? s : `/${s}`;
    return `${API_BASE}${path}`;               // relativa al backend (/media/...)
  };

  // ✅ NUEVO: manejar 401/403 consistente en todas las llamadas
  const handleAuthError = () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  };

  // ✅ MODIFICADO: usa apiFetch (incluye Authorization automáticamente)
  async function fetchMe() {
    const res = await window.apiFetch(ME_URL, { method: "GET" });

    // Si expiró el token o no autorizado, vuelve al login
    if (res.status === 401 || res.status === 403) {
      handleAuthError();
      throw new Error("No autorizado");
    }

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Error al cargar perfil: ${res.status} ${t}`);
    }

    return res.json();
  }

  // 7) Establecer imagen de perfil (con fallback)
  let userId = null;

  const setProfileImageFromUrl = async (rawUrl) => {
    const absUrl = resolveImageUrl(rawUrl);
    if (!absUrl) {
      showIconFallback();
      return;
    }

    if (profileIcon) profileIcon.style.display = "none";
    if (profileImage) profileImage.style.display = "block";

    if (!profileImage) return;

    // Cache-buster para que no quede imagen vieja en el browser
    const directUrl = absUrl + (absUrl.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`);

    // Si falla carga directa, intentamos fetch+blob con Bearer (por si media requiere auth)
    profileImage.onerror = async () => {
      try {
        const res = await fetch(absUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("No se pudo descargar la imagen");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        profileImage.src = url;

        profileImage.onload = () => {
          profileImage.style.display = "block";
          if (profileIcon) profileIcon.style.display = "none";
        };
      } catch {
        // último intento: cache local por userId
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

      // Nombre visible (prioriza first_name, si no email)
      if (usernameEl) usernameEl.textContent = (data.first_name || data.email || "Usuario");

      // Imagen
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

      // ✅ MODIFICADO: Botón Admin solo para staff/superuser (tus serializers lo exponen)
      try {
        if (adminBtn) {
          const isAdmin = !!(data && (data.is_staff || data.is_superuser));
          if (isAdmin) {
            adminBtn.style.display = "inline-block";
            adminBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              // Admin del BACKEND
              window.location.href = `${API_BASE}/admin/`;
            });
          } else {
            adminBtn.style.display = "none";
          }
        }
      } catch {}
    })
    .catch((err) => {
      console.error("[home] Error al cargar datos:", err);
      // Si fue 401/403 ya redirigimos en fetchMe()
    });

  // 9) Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("refreshToken");
      sessionStorage.removeItem("username");
      window.location.href = "index.html";
    });
  }

  console.info("[home] API_BASE:", API_BASE, "ME_URL:", ME_URL);
});

// profile.js
// Edición de perfil y foto, funcionando cross-origin contra el backend.
// - Usa window.API_BASE (inyectado por js/config.js).
// - Soporta imágenes privadas (try <img> directo → fetch con Bearer → caché local).
// - No fija Content-Type en PUT con FormData (deja que el navegador ponga multipart).

document.addEventListener("DOMContentLoaded", () => {
  // 1) Requiere login
  const token = sessionStorage.getItem("authToken");
  if (!token) return (window.location.href = "index.html");

  // 2) Base del API (si no hay config.js, hace fallback a mismo origen)
  const API_BASE =
    (typeof window.API_BASE === "string" && window.API_BASE) ||
    window.location.origin;

  // 3) Referencias de UI
  const inputs = document.querySelectorAll(".profile-input");
  const editBtn = document.getElementById("edit-btn");
  const saveBtn = document.getElementById("save-btn");
  const cancelBtn = document.getElementById("cancel-btn");

  const profileImageInput = document.getElementById("profile_image");
  const profileImage = document.getElementById("profileImage");
  const profileIcon = document.getElementById("profileIcon");
  const selectPhotoLabel = document.querySelector('label[for="profile_image"]');

  const confirmModal = document.getElementById("confirmModal");
  const successModal = document.getElementById("successModal");
  const confirmChangesBtn = document.getElementById("confirmChangesBtn");
  const cancelChangesBtn = document.getElementById("cancelChangesBtn");
  const successOkBtn = document.getElementById("successOkBtn");

  // 4) Estado interno
  let originalValues = {};
  let profileImageFile = null;
  let originalProfileImageSrc = null;
  let currentObjectUrl = null; // para revokeObjectURL
  let userId = null; // para caché local
  let lastPreviewDataUrl = null; // última vista previa base64

  // 5) Helpers
  const localKey = (id) => `profileImage:${id}`;

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s; // absoluta
    const path = s.startsWith("/") ? s : `/${s}`;
    return `${API_BASE}${path}`; // absoluta respecto al API
  };

  const showIconFallback = () => {
    try {
      profileImage.style.display = "none";
      profileIcon.style.display = "block";
    } catch (_) {}
  };

  const tryLoadLocalImage = () => {
    if (!userId) return false;
    try {
      const dataUrl = localStorage.getItem(localKey(userId));
      if (dataUrl) {
        if (currentObjectUrl) {
          URL.revokeObjectURL(currentObjectUrl);
          currentObjectUrl = null;
        }
        profileImage.src = dataUrl;
        profileImage.onload = () => {
          profileImage.style.display = "block";
          profileIcon.style.display = "none";
        };
        return true;
      }
    } catch (_) {}
    return false;
  };

  const setProfileImageFromUrl = async (rawUrl) => {
    const absUrl = resolveImageUrl(rawUrl);
    if (!absUrl) return showIconFallback();

    // limpia objectURL previo
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    // intento 1: URL directa con cache-busting
    const directUrl =
      absUrl + (absUrl.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`);

    try {
      profileIcon.style.display = "none";
      profileImage.style.display = "block";
    } catch (_) {}

    // Si el <img> falla (CORS/privado), usar fetch con token
    profileImage.onerror = async () => {
      try {
        const res = await fetch(absUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("fetch image not ok");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        currentObjectUrl = url;
        profileImage.src = url;
        profileImage.onload = () => {
          profileImage.style.display = "block";
          profileIcon.style.display = "none";
        };
      } catch {
        if (!tryLoadLocalImage()) showIconFallback();
      }
    };

    profileImage.onload = () => {
      profileImage.style.display = "block";
      profileIcon.style.display = "none";
    };

    profileImage.src = directUrl;
  };

  const parseError = async (resp) => {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const j = await resp.json();
        return (
          j.detail ||
          j.error ||
          j.message ||
          JSON.stringify(j).slice(0, 500) ||
          `HTTP ${resp.status}`
        );
      } catch (_) {}
    }
    return (await resp.text()).slice(0, 500) || `HTTP ${resp.status}`;
  };

  // 6) Cargar datos del perfil
  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      });
      if (!res.ok) throw new Error(await parseError(res));
      const data = await res.json();

      // userId para cache
      try {
        if (data && data.id) userId = data.id;
      } catch (_) {}

      // nombre visible
      const disp = document.getElementById("displayName");
      if (disp) disp.textContent = data.first_name || data.email || "Usuario";

      // setea valores en inputs (excepto file)
      Object.keys(data).forEach((key) => {
        const input = document.getElementById(key);
        if (input && input.type !== "file") input.value = data[key] ?? "";
      });

      // imagen
      if (data.profile_image) {
        originalProfileImageSrc = resolveImageUrl(data.profile_image);
        await setProfileImageFromUrl(originalProfileImageSrc);
      } else {
        originalProfileImageSrc = null;
        showIconFallback();
        // extra: intenta cache local
        try {
          if (profileImage.style.display === "none") tryLoadLocalImage();
        } catch (_) {}
      }
    } catch (err) {
      alert("❌ No se pudieron cargar los datos: " + (err?.message || err));
    }
  };

  // 7) Estado inicial (no editable)
  if (saveBtn) saveBtn.style.display = "none";
  if (cancelBtn) cancelBtn.style.display = "none";
  if (selectPhotoLabel) selectPhotoLabel.style.display = "none";
  loadProfile();

  // 8) Vista previa al seleccionar nueva imagen
  profileImageInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      profileImageFile = file;
      const reader = new FileReader();
      reader.onload = (ev) => {
        lastPreviewDataUrl = ev.target.result;
        profileImage.src = lastPreviewDataUrl;
        profileImage.style.display = "block";
        profileIcon.style.display = "none";
        // cache local por usuario
        try {
          if (userId) localStorage.setItem(localKey(userId), lastPreviewDataUrl);
        } catch (_) {}
      };
      reader.readAsDataURL(file);
    }
  });

  // 9) Editar → habilitar inputs
  editBtn.onclick = () => {
    inputs.forEach((input) => {
      originalValues[input.id] = input.value;
      input.disabled = false;
    });
    editBtn.style.display = "none";
    saveBtn.style.display = "inline-block";
    cancelBtn.style.display = "inline-block";
    if (selectPhotoLabel) selectPhotoLabel.style.display = "inline-flex";
  };

  // 10) Guardar → confirma
  saveBtn.onclick = () => (confirmModal.style.display = "flex");

  // 11) Confirmar cambios → PUT multipart
  confirmChangesBtn.onclick = async () => {
    const formData = new FormData();
    inputs.forEach((input) => formData.append(input.id, input.value));
    if (profileImageFile) formData.append("profile_image", profileImageFile);

    try {
      const res = await fetch(`${API_BASE}/api/auth/me/`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token }, // sin Content-Type
        body: formData,
      });
      if (!res.ok) throw new Error(await parseError(res));
      const data = await res.json();

      // volver a modo lectura
      inputs.forEach((input) => (input.disabled = true));
      const disp = document.getElementById("displayName");
      if (disp) disp.textContent = data.first_name || data.email || "Usuario";
      userId = data.id || userId;

      // actualizar imagen si el backend devolvió una nueva URL
      if (data.profile_image) {
        originalProfileImageSrc = resolveImageUrl(data.profile_image);
        await setProfileImageFromUrl(originalProfileImageSrc);
      } else if (!tryLoadLocalImage()) {
        // si no hay URL, intenta recargar perfil (por si cambia luego)
        await loadProfile();
      }

      // reset selección local
      profileImageFile = null;
      if (profileImageInput) profileImageInput.value = "";

      confirmModal.style.display = "none";
      successModal.style.display = "flex";
    } catch (err) {
      alert("❌ " + (err?.message || err));
      confirmModal.style.display = "none";
    }
  };

  // 12) Cancelar confirm modal
  cancelChangesBtn.onclick = () => (confirmModal.style.display = "none");

  // 13) Aceptar success
  successOkBtn.onclick = () => {
    successModal.style.display = "none";
    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
    editBtn.style.display = "inline-block";
    if (selectPhotoLabel) selectPhotoLabel.style.display = "none";
  };

  // 14) Cancelar edición
  cancelBtn.onclick = () => {
    inputs.forEach((input) => {
      input.value = originalValues[input.id];
      input.disabled = true;
    });

    // revertir imagen si se había cambiado
    profileImageFile = null;
    if (profileImageInput) profileImageInput.value = "";
    if (originalProfileImageSrc) {
      profileImage.src = originalProfileImageSrc;
      profileImage.style.display = "block";
      profileIcon.style.display = "none";
    } else {
      showIconFallback();
    }

    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
    editBtn.style.display = "inline-block";
    if (selectPhotoLabel) selectPhotoLabel.style.display = "none";
  };

  console.info("[profile] API_BASE:", API_BASE);
});

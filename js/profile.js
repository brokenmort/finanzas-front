document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.API_BASE || "https://pagina-web-finansas-b6474cfcee14.herokuapp.com";
  const token = sessionStorage.getItem("authToken");
  if (!token) return window.location.href = "index.html";

  const inputs = document.querySelectorAll('.profile-input');
  const editBtn = document.getElementById('edit-btn');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  const profileImageInput = document.getElementById('profile_image');
  const profileImage = document.getElementById('profileImage');
  const profileIcon = document.getElementById('profileIcon');
  const selectPhotoLabel = document.querySelector('label[for="profile_image"]');

  const confirmModal = document.getElementById('confirmModal');
  const successModal = document.getElementById('successModal');
  const confirmChangesBtn = document.getElementById('confirmChangesBtn');
  const cancelChangesBtn = document.getElementById('cancelChangesBtn');
  const successOkBtn = document.getElementById('successOkBtn');

  let originalValues = {};
  let profileImageFile = null;
  let originalProfileImageSrc = null;
  let currentObjectUrl = null; // para blobs autenticados
  let userId = null; // id de usuario para cache local
  let lastPreviewDataUrl = null; // última vista previa base64

  const localKey = (id) => `profileImage:${id}`;

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    // Une base y ruta relativa
    const path = s.startsWith('/') ? s : `/${s}`;
    return `${API_BASE}${path}`;
  };

  const showIconFallback = () => {
    profileImage.style.display = 'none';
    profileIcon.style.display = 'block';
  };

  const tryLoadLocalImage = () => {
    if (!userId) return false;
    try {
      const dataUrl = localStorage.getItem(localKey(userId));
      if (dataUrl) {
        if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
        profileImage.src = dataUrl;
        profileImage.onload = () => {
          profileImage.style.display = 'block';
          profileIcon.style.display = 'none';
        };
        return true;
      }
    } catch (_) {}
    return false;
  };

  const setProfileImageFromUrl = async (rawUrl) => {
    const absUrl = resolveImageUrl(rawUrl);
    if (!absUrl) { showIconFallback(); return; }
    // Limpia object URL anterior si existía
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    // Intento 1: URL directa con cache-busting ligero
    const directUrl = absUrl + (absUrl.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`);
    // Mostrar imagen de inmediato; si falla, onerror aplicará fallback
    profileIcon.style.display = 'none';
    profileImage.style.display = 'block';
    await new Promise((resolve) => setTimeout(resolve, 0));
    profileImage.onerror = async () => {
      // Intento 2: fetch autenticado como blob (por si el recurso es privado)
      try {
        const res = await fetch(absUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('fetch image not ok');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        currentObjectUrl = url;
        profileImage.src = url;
        profileImage.onload = () => {
          profileImage.style.display = 'block';
          profileIcon.style.display = 'none';
        };
      } catch (e) {
        if (!tryLoadLocalImage()) {
          showIconFallback();
        }
      }
    };
    profileImage.onload = () => {
      profileImage.style.display = 'block';
      profileIcon.style.display = 'none';
    };
    profileImage.src = directUrl;
  };

  // Cargar datos del perfil
  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        }
      });
      if(!res.ok) throw new Error("No autorizado");
      const data = await res.json();
      // Usar el id para cache local de imagen
      try { if (data && data.id) { userId = data.id; } } catch (_) {}

      document.getElementById("displayName").textContent = data.first_name;

      Object.keys(data).forEach(key => {
        const input = document.getElementById(key);
        // Evitar asignar programáticamente un valor al input type="file"
        if (input && input.type !== 'file') {
          input.value = data[key] ?? '';
        }
      });

      // Imagen de perfil
      if (data.profile_image) {
        originalProfileImageSrc = resolveImageUrl(data.profile_image);
        await setProfileImageFromUrl(originalProfileImageSrc);
      } else {
        originalProfileImageSrc = null;
        showIconFallback();
      }
      // Fallback extra: si no se muestra imagen, intenta cache local por usuario
      try { if (profileImage.style.display === 'none') { tryLoadLocalImage(); } } catch (_) {}
    } catch(err) {
      alert("❌ No se pudieron cargar los datos: " + err.message);
    }
  };
  // Estado inicial: ocultar Save/Cancel y el botón de Select Photo
  if (saveBtn) saveBtn.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (selectPhotoLabel) selectPhotoLabel.style.display = 'none';

  loadProfile();

  // Vista previa al seleccionar nueva imagen
  profileImageInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if(file){
      profileImageFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        lastPreviewDataUrl = e.target.result;
        profileImage.src = lastPreviewDataUrl;
        profileImage.style.display = 'block';
        profileIcon.style.display = 'none';
        // cachear imagen localmente para este usuario
        try { if (userId) localStorage.setItem(localKey(userId), lastPreviewDataUrl); } catch(_) {}
      }
      reader.readAsDataURL(file);
    }
  });

  // Editar perfil
  editBtn.onclick = () => {
    inputs.forEach(input => { 
      originalValues[input.id] = input.value;
      input.disabled = false;
    });
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';
    if (selectPhotoLabel) selectPhotoLabel.style.display = 'inline-flex';
  };

  // Guardar cambios - mostrar modal de confirmación
  saveBtn.onclick = () => confirmModal.style.display = 'flex';

  // Confirmar cambios
  confirmChangesBtn.onclick = async () => {
    const formData = new FormData();
    inputs.forEach(input => formData.append(input.id, input.value));
    if(profileImageFile) formData.append('profile_image', profileImageFile);

    try {
      const res = await fetch(`${API_BASE}/api/auth/me/`, {
        method: "PUT",
        headers: {"Authorization":"Bearer "+token},
        body: formData
      });
      if(!res.ok) throw new Error("Error al guardar cambios");
      const data = await res.json();
      inputs.forEach(input => input.disabled = true);
      document.getElementById("displayName").textContent = data.first_name;
      userId = data.id || userId;
      // Actualizar imagen mostrada si el backend devuelve nueva URL
      if (data.profile_image) {
        originalProfileImageSrc = resolveImageUrl(data.profile_image);
        await setProfileImageFromUrl(originalProfileImageSrc);
      } else {
        // Si el backend no devuelve URL, intenta cache local y reconsulta
        if (!tryLoadLocalImage()) {
          await loadProfile();
        }
      }
      // Reset selección local
      profileImageFile = null;
      profileImageInput.value = '';
      confirmModal.style.display = 'none';
      successModal.style.display = 'flex';
    } catch(err) {
      alert("❌ " + err.message);
      confirmModal.style.display = 'none';
    }
  };

  cancelChangesBtn.onclick = () => confirmModal.style.display = 'none';
  successOkBtn.onclick = () => {
    successModal.style.display = 'none';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    editBtn.style.display = 'inline-block';
    if (selectPhotoLabel) selectPhotoLabel.style.display = 'none';
  };

  // Cancelar edición
  cancelBtn.onclick = () => {
    inputs.forEach(input => {
      input.value = originalValues[input.id];
      input.disabled = true;
    });
    // Revertir imagen a la original si se había seleccionado una nueva
    profileImageFile = null;
    profileImageInput.value = '';
    if (originalProfileImageSrc) {
      profileImage.src = originalProfileImageSrc;
      profileImage.style.display = 'block';
      profileIcon.style.display = 'none';
    } else {
      profileImage.style.display = 'none';
      profileIcon.style.display = 'block';
    }
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    editBtn.style.display = 'inline-block';
    if (selectPhotoLabel) selectPhotoLabel.style.display = 'none';
  };
});

// newSuppIncome.js
// CRUD de Ingresos Extra (crear, editar, borrar) contra backend cross-origin.
// - Usa window.API_BASE (inyectado por js/config.js).
// - Resuelve URL de imagen (absoluta/relativa) y maneja modales.

document.addEventListener('DOMContentLoaded', () => {
  // 1) Requiere login
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'index.html'; return; }

  // 2) Base del API
  const API_BASE = (typeof window.API_BASE === 'string' && window.API_BASE) ? window.API_BASE : window.location.origin;

  // 3) Params (?id=... => modo edición)
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  // 4) Referencias UI
  const nameEl = document.getElementById('displayName');
  const iconEl = document.getElementById('baseProfileIcon');
  const imgEl  = document.getElementById('baseProfileImage');

  const addBtn = document.getElementById('add-btn');
  const deleteBtn = document.getElementById("delete-btn");
  const confirmModal = document.getElementById('confirmModal');
  const successModal = document.getElementById('successModal');
  const deleteModal = document.getElementById('deleteModal');
  const deleteSuccessModal = document.getElementById('deleteSuccessModal');
  const confirmChangesBtn = document.getElementById('confirmChangesBtn');
  const cancelChangesBtn = document.getElementById('cancelChangesBtn');
  const successOkBtn = document.getElementById('successOkBtn');
  const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
  const deleteCancelBtn = document.getElementById('deleteCancelBtn');
  const deleteSuccessOkBtn = document.getElementById('deleteSuccessOkBtn');
  const confirmText = document.getElementById("confirmText");
  const successText = document.getElementById("successText");
  const deleteText = document.getElementById("deleteText");
  const deleteSuccessText = document.getElementById("deleteSuccessText");

  const dateInput = document.getElementById('date');
  const today = new Date().toISOString().split('T')[0];
  if (dateInput && !id) dateInput.value = today; // fecha por defecto en crear

  // 5) Helpers
  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;        // ya es absoluta
    const path = s.startsWith('/') ? s : `/${s}`;  // normaliza
    return `${API_BASE}${path}`;                   // absoluta respecto al API
  };

  const setModal = (el, visible) => { if (el) el.style.display = visible ? 'flex' : 'none'; };

  const parseError = async (resp) => {
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        const j = await resp.json();
        return j.detail || j.error || j.message || JSON.stringify(j).slice(0, 500);
      } catch (_) {}
    }
    return (await resp.text()).slice(0, 500) || `HTTP ${resp.status}`;
  };

  // 6) Cargar cabecera de usuario
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me/`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      });
      if (!res.ok) throw new Error('No autorizado');
      const data = await res.json();
      if (nameEl) nameEl.textContent = data.first_name || data.email || 'Usuario';
      const url = resolveImageUrl(data && data.profile_image);
      if (url && imgEl && iconEl) {
        imgEl.onload = () => { imgEl.style.display = 'block'; iconEl.style.display = 'none'; };
        imgEl.onerror = () => { imgEl.style.display = 'none'; iconEl.style.display = 'block'; };
        imgEl.src = url + (url.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`);
      }
    } catch {
      window.location.href = 'index.html';
    }
  })();

  // 7) Modo edición: precarga y borrar
  if (id) {
    if (addBtn) addBtn.value = "Guardar Cambios";
    if (confirmText) confirmText.textContent = "¿Deseas guardar los cambios de este ingreso extra?";
    if (successText) successText.textContent = "¡El ingreso extra se actualizó correctamente!";
    if (deleteBtn) deleteBtn.style.display = "inline-block";
    if (deleteText) deleteText.textContent = "¿Seguro que deseas eliminar este ingreso extra?";
    if (deleteSuccessText) deleteSuccessText.textContent = "¡El ingreso extra se eliminó correctamente!";

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/IngresosExtra/${id}/`, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error(await parseError(res));
        const data = await res.json();
        document.getElementById("incomeType").value = data.name || "";
        document.getElementById("description").value = data.reason || "";
        document.getElementById("amount").value = data.quantity ?? "";
        document.getElementById("date").value = data.date || today;
      } catch (err) {
        alert("Error: " + (err?.message || String(err)));
      }
    })();

    if (deleteBtn) {
      deleteBtn.onclick = (e) => {
        e.preventDefault();
        setModal(deleteModal, true);
      };
    }
    if (deleteConfirmBtn) {
      deleteConfirmBtn.onclick = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/IngresosExtra/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (!res.ok) throw new Error(await parseError(res));
          setModal(deleteModal, false);
          setModal(deleteSuccessModal, true);
        } catch (err) {
          setModal(deleteModal, false);
          alert("Error: " + (err?.message || String(err)));
        }
      };
    }
  } else {
    // Modo crear
    if (addBtn) addBtn.value = "Agregar ingreso extra";
    if (confirmText) confirmText.textContent = "¿Deseas crear este ingreso extra?";
    if (successText) successText.textContent = "¡El ingreso extra se creó correctamente!";
    if (deleteBtn) deleteBtn.style.display = "none";
  }

  // 8) Abrir/cerrar modales
  if (addBtn) addBtn.onclick = (e) => { e.preventDefault(); setModal(confirmModal, true); };
  if (cancelChangesBtn) cancelChangesBtn.onclick = () => setModal(confirmModal, false);
  if (deleteCancelBtn) deleteCancelBtn.onclick = () => setModal(deleteModal, false);
  if (successOkBtn) {
  successOkBtn.onclick = () => {
    window.location.href = "income.html?tab=supp";
  };
}
  if (deleteSuccessOkBtn) {
    deleteSuccessOkBtn.onclick = () => {
      window.location.href = "income.html?tab=supp";
    };
  }


  // 9) Guardar (crear/actualizar)
  if (confirmChangesBtn) {
    confirmChangesBtn.onclick = async () => {
      const payload = {
        name: (document.getElementById('incomeType')?.value || '').trim(),
        reason: (document.getElementById('description')?.value || '').trim(),
        quantity: String(document.getElementById('amount')?.value || '').trim(),
        date: (document.getElementById('date')?.value || '').trim()
      };

      // Validaciones básicas
      if (!payload.name) { alert("El nombre del ingreso es requerido"); return; }
      if (!payload.quantity || isNaN(Number(payload.quantity))) { alert("El monto debe ser numérico"); return; }
      if (!payload.date) { alert("La fecha es requerida"); return; }

      const url = id ? `${API_BASE}/api/IngresosExtra/${id}/` : `${API_BASE}/api/IngresosExtra/`;
      const method = id ? "PUT" : "POST";

      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(await parseError(response));

        setModal(confirmModal, false);
        setModal(successModal, true);
      } catch (err) {
        setModal(confirmModal, false);
        alert("Error: " + (err?.message || String(err)));
      }
    };
  }

  console.info("[newSuppIncome] API_BASE:", API_BASE, "id:", id || "(new)");
});

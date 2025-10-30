// newExtraExp.js
// CRUD de Egresos Extra (crear, editar, borrar) contra backend cross-origin.
// - Usa window.API_BASE (inyectado por js/config.js).
// - Resuelve URL de imagen de perfil (absoluta/relativa).
// - Maneja modales de confirmacion/exito y errores legibles.

document.addEventListener('DOMContentLoaded', () => {
  // 1) Guard: requiere login
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'index.html'; return; }

  // 2) Base del API (si no esta definida, cae a same-origin en desarrollo)
  const API_BASE = (typeof window.API_BASE === 'string' && window.API_BASE) ? window.API_BASE : window.location.origin;

  // 3) Parametros (si hay ?id=..., estamos en modo edicion)
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  // 4) Elementos UI
  const nameEl = document.getElementById('displayName');
  const iconEl = document.getElementById('baseProfileIcon');
  const imgEl  = document.getElementById('baseProfileImage');

  const addBtn = document.getElementById('add-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const confirmModal = document.getElementById('confirmModal');
  const successModal = document.getElementById('successModal');
  const confirmChangesBtn = document.getElementById('confirmChangesBtn');
  const cancelChangesBtn = document.getElementById('cancelChangesBtn');
  const successOkBtn = document.getElementById('successOkBtn');
  const confirmText = document.getElementById('confirmText');
  const successText = document.getElementById('successText');
  const dateInput = document.getElementById("date");

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

  // 6) Header usuario
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

  // 7) Fecha por defecto al crear
  const today = new Date().toISOString().split('T')[0];
  if (!id && dateInput) dateInput.value = today;

  // 8) Modo edicion: precarga y borrar
  if (id) {
    if (addBtn) addBtn.value = "Save Changes";
    if (confirmText) confirmText.textContent = "Do you want to update this extra expense?";
    if (successText) successText.textContent = "The extra expense was updated successfully!";
    if (deleteBtn) deleteBtn.style.display = "inline-block";

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/EgresosExtra/${id}/`, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error(await parseError(res));
        const data = await res.json();
        document.getElementById("expenseType").value = data.name || "";
        document.getElementById("description").value = data.reason || "";
        document.getElementById("amount").value = data.quantity ?? "";
        document.getElementById("date").value = data.date || today;
      } catch (err) {
        alert("Error: " + (err?.message || String(err)));
      }
    })();

    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (!confirm("Delete this extra expense?")) return;
        try {
          const resp = await fetch(`${API_BASE}/api/EgresosExtra/${id}/`, {
            method: "DELETE",
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (!resp.ok) throw new Error(await parseError(resp));
          window.location.href = "expenses.html";
        } catch (err) {
          alert("Error: " + (err?.message || String(err)));
        }
      };
    }
  } else {
    // Modo crear
    if (addBtn) addBtn.value = "Add extra expense";
    if (confirmText) confirmText.textContent = "Do you want to create this extra expense?";
    if (successText) successText.textContent = "The extra expense was created successfully!";
    if (deleteBtn) deleteBtn.style.display = "none";
  }

  // 9) Modales
  if (addBtn) addBtn.onclick = (e) => { e.preventDefault(); setModal(confirmModal, true); };
  if (cancelChangesBtn) cancelChangesBtn.onclick = () => setModal(confirmModal, false);
  if (successOkBtn) successOkBtn.onclick = () => window.location.href = "expenses.html";

  // 10) Guardar (crear/actualizar)
  if (confirmChangesBtn) {
    confirmChangesBtn.onclick = async () => {
      const payload = {
        name: (document.getElementById("expenseType")?.value || "").trim(),
        reason: (document.getElementById("description")?.value || "").trim(),
        quantity: String(document.getElementById("amount")?.value || "").trim(),
        date: (document.getElementById("date")?.value || today).trim()
      };

      // Validaciones basicas
      if (!payload.name) { alert("Expense type is required"); return; }
      if (!payload.quantity || isNaN(Number(payload.quantity))) { alert("Amount must be numeric"); return; }
      if (!payload.date) { alert("Date is required"); return; }

      const url = id ? `${API_BASE}/api/EgresosExtra/${id}/` : `${API_BASE}/api/EgresosExtra/`;
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

  console.info("[newExtraExp] API_BASE:", API_BASE, "id:", id || "(new)");
});

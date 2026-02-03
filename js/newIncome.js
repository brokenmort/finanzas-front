// newIncome.js
// CRUD de Ingresos Fijos (crear, editar, borrar) contra backend cross-origin.
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
  const confirmChangesBtn = document.getElementById('confirmChangesBtn');
  const cancelChangesBtn = document.getElementById('cancelChangesBtn');
  const successOkBtn = document.getElementById('successOkBtn');
  const confirmText = document.getElementById("confirmText");
  const successText = document.getElementById("successText");

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
        // intenta varios campos comunes en DRF
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
    if (confirmText) confirmText.textContent = "¿Deseas guardar los cambios de este ingreso?";
    if (successText) successText.textContent = "¡El ingreso se actualizó correctamente!";
    if (deleteBtn) deleteBtn.style.display = "inline-block";

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/IngresosFijos/${id}/`, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error(await parseError(res));
        const data = await res.json();
        document.getElementById("incomeType").value = data.name || "";
        document.getElementById("description").value = data.reason || "";
        document.getElementById("amount").value = data.quantity ?? "";
        document.getElementById("period").value = data.period || "mensual";
      } catch (err) {
        alert("Error: " + (err?.message || String(err)));
      }
    })();

    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (!confirm("¿Seguro que deseas eliminar este ingreso?")) return;
        try {
          const resp = await fetch(`${API_BASE}/api/IngresosFijos/${id}/`, {
            method: "DELETE",
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (!resp.ok) throw new Error(await parseError(resp));
          window.location.href = "income.html";
        } catch (err) {
          alert("Error: " + (err?.message || String(err)));
        }
      };
    }
  } else {
    // Modo crear
    if (addBtn) addBtn.value = "Agregar ingreso";
    if (confirmText) confirmText.textContent = "¿Deseas crear este ingreso?";
    if (successText) successText.textContent = "¡El ingreso se creó correctamente!";
    if (deleteBtn) deleteBtn.style.display = "none";
  }

  // 8) Abrir/cerrar modales
  if (addBtn) addBtn.onclick = (e) => { e.preventDefault(); setModal(confirmModal, true); };
  if (cancelChangesBtn) cancelChangesBtn.onclick = () => setModal(confirmModal, false);
  if (successOkBtn) successOkBtn.onclick = () => window.location.replace("income.html");
;

  // 9) Guardar (crear/actualizar)
  if (confirmChangesBtn) {
    confirmChangesBtn.onclick = async () => {
      const payload = {
        name: (document.getElementById('incomeType')?.value || '').trim(),
        reason: (document.getElementById('description')?.value || '').trim(),
        quantity: String(document.getElementById('amount')?.value || '').trim(),
        period: (document.getElementById('period')?.value || 'mensual').trim()
      };

      // Validaciones básicas
      if (!payload.name) { alert("El nombre del ingreso es requerido"); return; }
      if (!payload.quantity || isNaN(Number(payload.quantity))) { alert("El monto debe ser numérico"); return; }
      if (!payload.period) { alert("La periodicidad es requerida"); return; }

      const url = id ? `${API_BASE}/api/IngresosFijos/${id}/` : `${API_BASE}/api/IngresosFijos/`;
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

  console.info("[newIncome] API_BASE:", API_BASE, "id:", id || "(new)");
});

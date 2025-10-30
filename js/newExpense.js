document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'index.html'; return; }

  const API_BASE = window.API_BASE || window.location.origin;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const nameEl = document.getElementById('displayName');
  const iconEl = document.getElementById('baseProfileIcon');
  const imgEl  = document.getElementById('baseProfileImage');

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    const path = s.startsWith('/') ? s : `/${s}`;
    return `${API_BASE}${path}`;
  };

  // Cargar usuario
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
    } catch { window.location.href = 'index.html'; }
  })();

  const addBtn = document.getElementById('add-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const confirmModal = document.getElementById('confirmModal');
  const successModal = document.getElementById('successModal');
  const confirmChangesBtn = document.getElementById('confirmChangesBtn');
  const cancelChangesBtn = document.getElementById('cancelChangesBtn');
  const successOkBtn = document.getElementById('successOkBtn');
  const confirmText = document.getElementById('confirmText');
  const successText = document.getElementById('successText');

  if (id) {
    addBtn.value = "Save Changes";
    confirmText.textContent = "Do you want to update this expense?";
    successText.textContent = "The expense was updated successfully!";
    deleteBtn.style.display = "inline-block";

    (async () => {
      const res = await fetch(`${API_BASE}/api/EgresosFijos/${id}/`, { headers: { 'Authorization': 'Bearer ' + token }});
      if (res.ok) {
        const data = await res.json();
        document.getElementById("expenseType").value = data.name || "";
        document.getElementById("description").value = data.reason || "";
        document.getElementById("amount").value = data.quantity || "";
        document.getElementById("periodicity").value = data.period || "mensual";
      }
    })();

    deleteBtn.onclick = async () => {
      if (confirm("Delete this fixed expense?")) {
        await fetch(`${API_BASE}/api/EgresosFijos/${id}/`, {
          method: "DELETE",
          headers: { 'Authorization': 'Bearer ' + token }
        });
        window.location.href = "expenses.html";
      }
    };
  }

  addBtn.onclick = (e) => { e.preventDefault(); confirmModal.style.display = 'flex'; };
  cancelChangesBtn.onclick = () => confirmModal.style.display = 'none';
  successOkBtn.onclick = () => window.location.href = "expenses.html";

  confirmChangesBtn.onclick = async () => {
    const payload = {
      name: document.getElementById("expenseType").value,
      reason: document.getElementById("description").value,
      quantity: String(document.getElementById("amount").value),
      period: document.getElementById("periodicity").value
    };

    const url = id ? `${API_BASE}/api/EgresosFijos/${id}/` : `${API_BASE}/api/EgresosFijos/`;
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      confirmModal.style.display = 'none';
      successModal.style.display = 'flex';
    } catch (err) {
      confirmModal.style.display = 'none';
      alert("Error: " + err.message);
    }
  };
});

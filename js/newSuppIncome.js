document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) { 
    window.location.href = 'index.html'; 
    return; 
  }

  const API_BASE = window.API_BASE || window.location.origin;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id"); // si viene, es edición

  const nameEl = document.getElementById('displayName');       
  const iconEl = document.getElementById('baseProfileIcon');    
  const imgEl  = document.getElementById('baseProfileImage');   

  const confirmText = document.getElementById("confirmText");
  const successText = document.getElementById("successText");
  const deleteBtn = document.getElementById("delete-btn");

  const dateInput = document.getElementById('date');
  const today = new Date().toISOString().split('T')[0];
  if (dateInput && !id) dateInput.value = today;

  // ---- Resolver imagen de perfil ----
  const resolveImageUrl = (raw) => {
    if (!raw) return null;              
    const s = String(raw).trim();       
    if (!s) return null;                
    if (/^https?:\/\//i.test(s)) return s; 
    const path = s.startsWith('/') ? s : `/${s}`;
    return `${API_BASE}${path}`;        
  };

  // ---- Cargar datos del usuario ----
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me/`, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token 
        },
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

  // ---- Formularios y modales ----
  const addBtn = document.getElementById('add-btn');
  const confirmModal = document.getElementById('confirmModal');
  const successModal = document.getElementById('successModal');
  const confirmChangesBtn = document.getElementById('confirmChangesBtn');
  const cancelChangesBtn = document.getElementById('cancelChangesBtn');
  const successOkBtn = document.getElementById('successOkBtn');

  // Si estamos editando, cargar datos
  if (id) {
    addBtn.value = "Guardar Cambios";
    confirmText.textContent = "¿Deseas guardar los cambios de este ingreso?";
    successText.textContent = "¡El ingreso se actualizó correctamente!";
    deleteBtn.style.display = "inline-block";

    (async () => {
      const res = await fetch(`${API_BASE}/api/IngresosExtra/${id}/`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        const data = await res.json();
        document.getElementById("incomeType").value = data.name || "";
        document.getElementById("description").value = data.reason || "";
        document.getElementById("amount").value = data.quantity || "";
        document.getElementById("date").value = data.date || today;
      }
    })();

    // Eliminar
    deleteBtn.onclick = async () => {
      if (confirm("¿Seguro que deseas eliminar este ingreso extra?")) {
        await fetch(`${API_BASE}/api/IngresosExtra/${id}/`, {
          method: "DELETE",
          headers: { 'Authorization': 'Bearer ' + token }
        });
        window.location.href = "income.html";
      }
    };
  }

  // Abrir modal de confirmación
  addBtn.onclick = function (e) {
    e.preventDefault();
    confirmModal.style.display = 'flex';
  };

  // Confirmar y guardar en API
  confirmChangesBtn.onclick = async function () {
    const incomeType = document.getElementById('incomeType').value;
    const description = document.getElementById('description').value;
    const amount = document.getElementById('amount').value;
    const date = document.getElementById('date').value;

    const payload = {
      name: incomeType,
      reason: description,
      quantity: String(amount),
      date: date
    };

    try {
      const response = await fetch(
        id ? `${API_BASE}/api/IngresosExtra/${id}/` : `${API_BASE}/api/IngresosExtra/`,
        {
          method: id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error("Error al guardar el ingreso: " + errorText);
      }

      confirmModal.style.display = 'none';
      successModal.style.display = 'flex';
    } catch (err) {
      confirmModal.style.display = 'none';
      alert("Error: " + err.message);
    }
  };

  // Cerrar modal de confirmación
  cancelChangesBtn.onclick = function () {
    confirmModal.style.display = 'none';
  };

  // Redirigir después de éxito
  successOkBtn.onclick = function () {
    window.location.href = "income.html";
  };
});

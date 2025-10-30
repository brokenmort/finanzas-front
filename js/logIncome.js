document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) { window.location.href = 'index.html'; return; }

  const API_BASE = window.API_BASE || window.location.origin;

  const nameEl = document.getElementById('displayName');
  const iconEl = document.getElementById('baseProfileIcon');
  const imgEl = document.getElementById('baseProfileImage');
  const incomeSelect = document.getElementById('income');
  const amountInput = document.getElementById('amount');
  const dateInput = document.getElementById('date');
  const historyBody = document.getElementById('historyBody');
  const filterIncome = document.getElementById('filterIncome');
  const filterDate = document.getElementById('filterDate');

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return `${API_BASE}/${s}`;
  };

  // --- User info ---
  try {
    const res = await fetch(`${API_BASE}/api/auth/me/`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('No autorizado');
    const data = await res.json();
    nameEl.textContent = data.first_name || data.email || 'Usuario';
    const url = resolveImageUrl(data.profile_image);
    if (url) {
      imgEl.onload = () => { imgEl.style.display = 'block'; iconEl.style.display = 'none'; };
      imgEl.onerror = () => { imgEl.style.display = 'none'; iconEl.style.display = 'block'; };
      imgEl.src = url + (url.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`);
    }
  } catch { window.location.href = 'index.html'; }

  // --- Fecha actual ---
  dateInput.value = new Date().toISOString().split("T")[0];

  // --- Cargar ingresos fijos ---
  let ingresosFijos = [];
  try {
    const res = await fetch(`${API_BASE}/api/IngresosFijos/`, { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) {
      ingresosFijos = await res.json();
      incomeSelect.innerHTML = '<option value="">-- Select --</option>';
      filterIncome.innerHTML = '<option value="">-- All --</option>';
      ingresosFijos.forEach(ing => {
        const opt = document.createElement('option');
        opt.value = ing.id;
        opt.textContent = `${ing.name} (${ing.period})`;
        opt.dataset.quantity = ing.quantity;
        incomeSelect.appendChild(opt);

        const opt2 = document.createElement('option');
        opt2.value = ing.name;
        opt2.textContent = ing.name;
        filterIncome.appendChild(opt2);
      });
    }
  } catch (err) { console.error(err); }

  // Autocompletar amount
  incomeSelect.addEventListener('change', () => {
    const selected = incomeSelect.options[incomeSelect.selectedIndex];
    amountInput.value = selected?.dataset.quantity || '';
  });

  // Guardar pago
  const saveBtn = document.getElementById('save-btn');
  const confirmModal = document.getElementById('confirmModal');
  const successModal = document.getElementById('successModal');
  const confirmChangesBtn = document.getElementById('confirmChangesBtn');
  const cancelChangesBtn = document.getElementById('cancelChangesBtn');
  const successOkBtn = document.getElementById('successOkBtn');

  saveBtn.onclick = (e) => { e.preventDefault(); confirmModal.style.display = 'flex'; };
  confirmChangesBtn.onclick = async () => {
    const incomeId = incomeSelect.value;
    if (!incomeId) return alert("Select income");
    try {
      const res = await fetch(`${API_BASE}/api/IngresosFijos/${incomeId}/pagos/`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ amount: amountInput.value, date: dateInput.value })
      });
      if (!res.ok) throw new Error(await res.text());
      confirmModal.style.display = 'none';
      successModal.style.display = 'flex';
    } catch (err) {
      confirmModal.style.display = 'none';
      alert("Error: " + err.message);
    }
  };
  cancelChangesBtn.onclick = () => confirmModal.style.display = 'none';
  successOkBtn.onclick = () => window.location.href = "./income.html";

  // Vistas
  const logButton = document.querySelector('.log-button');
  const logForm = document.querySelector('.log-form');
  const historyTable = document.querySelector('.history-table');
  const historyBtn = document.getElementById('history');
  const logDetailsBtn = document.getElementById('logDetails');
  const logDetailsSelect = document.getElementById('logDetailsSelect');

  historyBtn.onclick = () => { historyTable.style.display = 'block'; logForm.style.display = 'none'; logButton.style.display = 'none'; loadHistory(); };
  logDetailsBtn.onclick = logDetailsSelect.onclick = () => { logForm.style.display = 'block'; historyTable.style.display = 'none'; logButton.style.display = 'flex'; };

  // Historial
  let allPagos = [];
  async function loadHistory() {
    historyBody.innerHTML = '';
    allPagos = [];
    const datesSet = new Set();

    for (let ing of ingresosFijos) {
      try {
        const res = await fetch(`${API_BASE}/api/IngresosFijos/${ing.id}/pagos/`, { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
          const pagos = await res.json();
          pagos.forEach(p => {
            allPagos.push({ name: ing.name, amount: p.amount, date: p.date });
            datesSet.add(p.date);
          });
        }
      } catch (err) { console.error(err); }
    }

    // Popular filtro de fechas
    filterDate.innerHTML = '<option value="">-- All --</option>';
    Array.from(datesSet).sort().forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      filterDate.appendChild(opt);
    });

    renderHistory(allPagos);
  }

  function renderHistory(data) {
    historyBody.innerHTML = '';
    data.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${p.amount}</td><td>${p.date}</td>`;
      historyBody.appendChild(tr);
    });
  }

  // Filtros
  document.getElementById('search-btn').addEventListener('click', () => {
    const fName = filterIncome.value;
    const fDate = filterDate.value;
    const filtered = allPagos.filter(p =>
      (fName === '' || p.name === fName) &&
      (fDate === '' || p.date === fDate)
    );
    renderHistory(filtered);
  });
});

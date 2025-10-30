document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('authToken');
  if (!token) { 
    window.location.href = 'index.html'; 
    return; 
  }

  const API_BASE = window.API_BASE || window.location.origin;

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

  try {
    const res = await fetch(`${API_BASE}/api/auth/me/`, {
      headers: { 'Content-Type': 'application/json','Authorization': 'Bearer ' + token },
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

  let allFijos = [];
  let allVars = [];
  let currentTab = 'fix';

  async function loadExpenses() {
    try {
      const resFix = await fetch(`${API_BASE}/api/EgresosFijos/`, { headers: { 'Authorization': 'Bearer ' + token }});
      if (resFix.ok) {
        allFijos = await resFix.json();
        renderFix(allFijos);
        if (currentTab === 'fix') fillFiltersFix(allFijos);
      }
      const resVar = await fetch(`${API_BASE}/api/EgresosExtra/`, { headers: { 'Authorization': 'Bearer ' + token }});
      if (resVar.ok) {
        allVars = await resVar.json();
        renderVar(allVars);
        if (currentTab === 'var') fillFiltersVar(allVars);
      }
    } catch (err) { console.error('Error cargando gastos:', err); }
  }

  function renderFix(data) {
    const tbody = document.querySelector('.fixed-table tbody');
    tbody.innerHTML = '';
    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${item.name}</td><td>${item.quantity}</td><td>${item.period || ''}</td>`;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href = `newExpense.html?id=${item.id}`;
      });
      tbody.appendChild(tr);
    });
  }

  function renderVar(data) {
    const tbody = document.querySelector('.supp-table tbody');
    tbody.innerHTML = '';
    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${item.name}</td><td>${item.quantity}</td><td>${item.date}</td>`;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href = `newExtraExp.html?id=${item.id}`;
      });
      tbody.appendChild(tr);
    });
  }

  function fillFiltersFix(data) {
    const f1 = document.getElementById('fixFilter1');
    const f2 = document.getElementById('fixFilter2');
    const names = [...new Set(data.map(i => i.name).filter(Boolean))];
    const periods = [...new Set(data.map(i => i.period).filter(Boolean))];
    f1.innerHTML = '<option value="">-- All --</option>';
    names.forEach(n => f1.innerHTML += `<option value="${n}">${n}</option>`);
    f2.innerHTML = '<option value="">-- All --</option>';
    periods.forEach(p => f2.innerHTML += `<option value="${p}">${p}</option>`);
  }

  function fillFiltersVar(data) {
    const f1 = document.getElementById('varFilter1');
    const f2 = document.getElementById('varFilter2');
    const names = [...new Set(data.map(i => i.name).filter(Boolean))];
    const dates = [...new Set(data.map(i => i.date).filter(Boolean))];
    f1.innerHTML = '<option value="">-- All --</option>';
    names.forEach(n => f1.innerHTML += `<option value="${n}">${n}</option>`);
    f2.innerHTML = '<option value="">-- All --</option>';
    dates.forEach(d => f2.innerHTML += `<option value="${d}">${d}</option>`);
  }

  document.getElementById('fixSearchBtn').addEventListener('click', () => {
    const f1 = document.getElementById('fixFilter1').value;
    const f2 = document.getElementById('fixFilter2').value;
    const filtered = allFijos.filter(i =>
      (f1 === '' || i.name === f1) && (f2 === '' || i.period === f2)
    );
    renderFix(filtered);
  });

  document.getElementById('varSearchBtn').addEventListener('click', () => {
    const f1 = document.getElementById('varFilter1').value;
    const f2 = document.getElementById('varFilter2').value;
    const filtered = allVars.filter(i =>
      (f1 === '' || i.name === f1) && (f2 === '' || i.date === f2)
    );
    renderVar(filtered);
  });

  window.switchTab = (tab) => {
    currentTab = tab;
    if (tab === 'fix') {
      document.getElementById('fixView').style.display = 'block';
      document.getElementById('varView').style.display = 'none';
      fillFiltersFix(allFijos);
    } else {
      document.getElementById('fixView').style.display = 'none';
      document.getElementById('varView').style.display = 'block';
      fillFiltersVar(allVars);
    }
  };

  loadExpenses();
});

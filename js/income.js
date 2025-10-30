document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('authToken');
    if (!token) { 
        window.location.href = 'index.html'; 
        return; 
    }

    const API_BASE = window.API_BASE || window.location.origin;

    const nameEl = document.getElementById('incomeUsername');       
    const iconEl = document.getElementById('walletProfileIcon');    
    const imgEl  = document.getElementById('walletProfileImage');   

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
    let allExtra = [];
    let currentTab = 'fix'; // por defecto

    async function loadIngresos() {
      try {
        const resFijos = await fetch(`${API_BASE}/api/IngresosFijos/`, { headers: { 'Authorization': 'Bearer ' + token }});
        if (resFijos.ok) {
          allFijos = await resFijos.json();
          renderFijos(allFijos);
          if (currentTab === 'fix') fillFiltersFix(allFijos);
        }
        const resExtra = await fetch(`${API_BASE}/api/IngresosExtra/`, { headers: { 'Authorization': 'Bearer ' + token }});
        if (resExtra.ok) {
          allExtra = await resExtra.json();
          renderExtra(allExtra);
          if (currentTab === 'supp') fillFiltersSupp(allExtra);
        }
      } catch (err) { console.error('Error cargando ingresos:', err); }
    }

    function renderFijos(data) {
      const tbody = document.querySelector('.fixed-table tbody');
      tbody.innerHTML = '';
      data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.name}</td><td>${item.reason}</td><td>${item.quantity}</td><td>${item.period || ''}</td>`;
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => {
          window.location.href = `newIncome.html?id=${item.id}`;
        });
        tbody.appendChild(tr);
      });
    }

    function renderExtra(data) {
      const tbody = document.querySelector('.supp-table tbody');
      tbody.innerHTML = '';
      data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.name}</td><td>${item.quantity}</td><td>${item.date}</td>`;
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => {
          window.location.href = `newSuppIncome.html?id=${item.id}`;
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

    function fillFiltersSupp(data) {
      const f1 = document.getElementById('suppFilter1');
      const f2 = document.getElementById('suppFilter2');
      const names = [...new Set(data.map(i => i.name).filter(Boolean))];
      const dates = [...new Set(data.map(i => i.date).filter(Boolean))];
      f1.innerHTML = '<option value="">-- All --</option>';
      names.forEach(n => f1.innerHTML += `<option value="${n}">${n}</option>`);
      f2.innerHTML = '<option value="">-- All --</option>';
      dates.forEach(d => f2.innerHTML += `<option value="${d}">${d}</option>`);
    }

    // Filtros FIX
    document.getElementById('fixSearchBtn').addEventListener('click', () => {
      const f1 = document.getElementById('fixFilter1').value;
      const f2 = document.getElementById('fixFilter2').value;
      const filtered = allFijos.filter(i =>
        (f1 === '' || i.name === f1) && (f2 === '' || i.period === f2)
      );
      renderFijos(filtered);
    });

    // Filtros SUPP
    document.getElementById('suppSearchBtn').addEventListener('click', () => {
      const f1 = document.getElementById('suppFilter1').value;
      const f2 = document.getElementById('suppFilter2').value;
      const filtered = allExtra.filter(i =>
        (f1 === '' || i.name === f1) && (f2 === '' || i.date === f2)
      );
      renderExtra(filtered);
    });

    window.switchTab = (tab) => {
      currentTab = tab;
      if (tab === 'fix') {
        document.getElementById('fixView').style.display = 'block';
        document.getElementById('suppView').style.display = 'none';
        fillFiltersFix(allFijos);
      } else {
        document.getElementById('fixView').style.display = 'none';
        document.getElementById('suppView').style.display = 'block';
        fillFiltersSupp(allExtra);
      }
    };

    loadIngresos();
});

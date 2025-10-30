// logIncome.js
// Front desacoplado hablando con API en Render.
//
// Cambios clave frente a tu versión:
// - Base URL viene de window.API_BASE (config.js) → cross-origin seguro.
// - authFetch(): añade Authorization y redirige al login si 401.
// - Descubre/caché del endpoint "me" entre varias rutas comunes.
// - Imagen de perfil con soporte absoluto/relativo y fallback a fetch+blob.
// - Misma UX: registrar pago, ver historial y filtros.

document.addEventListener("DOMContentLoaded", async () => {
  // 0) Autenticación
  const token = sessionStorage.getItem("authToken");
  if (!token) { window.location.href = "index.html"; return; }

  // 1) BASE del API desde js/config.js
  const API_BASE =
    typeof window.API_BASE === "string" && window.API_BASE
      ? window.API_BASE
      : window.location.origin;

  // 2) Elementos del DOM
  const nameEl       = document.getElementById("displayName");
  const iconEl       = document.getElementById("baseProfileIcon");
  const imgEl        = document.getElementById("baseProfileImage");
  const incomeSelect = document.getElementById("income");
  const amountInput  = document.getElementById("amount");
  const dateInput    = document.getElementById("date");
  const historyBody  = document.getElementById("historyBody");
  const filterIncome = document.getElementById("filterIncome");
  const filterDate   = document.getElementById("filterDate");

  const logButton        = document.querySelector(".log-button");
  const logForm          = document.querySelector(".log-form");
  const historyTable     = document.querySelector(".history-table");
  const historyBtn       = document.getElementById("history");
  const logDetailsBtn    = document.getElementById("logDetails");
  const logDetailsSelect = document.getElementById("logDetailsSelect");

  const saveBtn           = document.getElementById("save-btn");
  const confirmModal      = document.getElementById("confirmModal");
  const successModal      = document.getElementById("successModal");
  const confirmChangesBtn = document.getElementById("confirmChangesBtn");
  const cancelChangesBtn  = document.getElementById("cancelChangesBtn");
  const successOkBtn      = document.getElementById("successOkBtn");

  // 3) Helpers
  const showIconFallback = () => {
    if (imgEl)  imgEl.style.display  = "none";
    if (iconEl) iconEl.style.display = "block";
  };

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s; // absoluta
    const path = s.startsWith("/") ? s : `/${s}`;
    return `${API_BASE}${path}`; // relativa a backend (/media/…)
  };

  async function authFetch(url, options = {}) {
    const resp = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(options.headers || {}),
      },
    });
    if (resp.status === 401) {
      sessionStorage.clear();
      window.location.href = "index.html";
      throw new Error("No autorizado");
    }
    return resp;
  }

  async function discoverOnce(key, candidates) {
    const cached = sessionStorage.getItem(key);
    if (cached) return cached;
    for (const url of candidates) {
      try {
        const r = await authFetch(url, { method: "GET" });
        if (r.ok) { sessionStorage.setItem(key, url); return url; }
      } catch { /* probar siguiente */ }
    }
    return candidates[0];
  }

  async function fetchMe() {
    const ME_KEY = "endpoint_me";
    const candidates = [
      `${API_BASE}/api/auth/me/`,
      `${API_BASE}/api/users/me/`,
      `${API_BASE}/api/me/`,
      `${API_BASE}/api/user/me/`,
    ];
    const meUrl = await discoverOnce(ME_KEY, candidates);
    const res = await authFetch(meUrl);
    if (!res.ok) throw new Error("No autorizado");
    return res.json();
  }

  // 4) Usuario e imagen
  try {
    const me = await fetchMe();
    if (nameEl) nameEl.textContent = me.first_name || me.email || "Usuario";

    const url = resolveImageUrl(me && me.profile_image);
    if (url && imgEl && iconEl) {
      imgEl.onload = () => { imgEl.style.display = "block"; iconEl.style.display = "none"; };
      imgEl.onerror = async () => {
        try {
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) throw new Error("fetch image not ok");
          const blob = await r.blob();
          const objUrl = URL.createObjectURL(blob);
          imgEl.src = objUrl;
          imgEl.onload = () => { imgEl.style.display = "block"; iconEl.style.display = "none"; };
        } catch { showIconFallback(); }
      };
      imgEl.src = url + (url.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`);
    } else {
      showIconFallback();
    }
  } catch { return; } // authFetch ya redirige si 401

  // 5) Fecha por defecto (YYYY-MM-DD) si existe el input
  try {
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
  } catch { /* no-op */ }

  // 6) Cargar ingresos fijos
  let ingresosFijos = [];
  try {
    const res = await authFetch(`${API_BASE}/api/IngresosFijos/`, { method: "GET" });
    if (res.ok) {
      ingresosFijos = await res.json();

      if (incomeSelect) {
        incomeSelect.innerHTML = '<option value="">-- Select --</option>';
        ingresosFijos.forEach((ing) => {
          const opt = document.createElement("option");
          opt.value = ing.id;
          opt.textContent = `${ing.name} (${ing.period || "-"})`;
          opt.dataset.quantity = ing.quantity;
          incomeSelect.appendChild(opt);
        });
      }

      if (filterIncome) {
        filterIncome.innerHTML = '<option value="">-- All --</option>';
        [...new Set(ingresosFijos.map(i => i.name).filter(Boolean))].forEach((name) => {
          const opt2 = document.createElement("option");
          opt2.value = name;
          opt2.textContent = name;
          filterIncome.appendChild(opt2);
        });
      }
    }
  } catch (err) {
    console.error("Error cargando ingresos fijos:", err);
  }

  // Autocompletar monto al elegir ingreso fijo
  if (incomeSelect && amountInput) {
    incomeSelect.addEventListener("change", () => {
      const selected = incomeSelect.options[incomeSelect.selectedIndex];
      amountInput.value = selected?.dataset.quantity || "";
    });
  }

  // 7) Guardar pago (POST /api/IngresosFijos/:id/pagos/)
  if (saveBtn && confirmModal && successModal && confirmChangesBtn && cancelChangesBtn && successOkBtn) {
    saveBtn.onclick = (e) => { e.preventDefault(); confirmModal.style.display = "flex"; };

    confirmChangesBtn.onclick = async () => {
      const incomeId = incomeSelect ? incomeSelect.value : "";
      if (!incomeId) { alert("Select income"); return; }
      try {
        const body = JSON.stringify({
          amount: amountInput ? amountInput.value : "",
          date:   dateInput   ? dateInput.value   : ""
        });
        const res = await authFetch(`${API_BASE}/api/IngresosFijos/${incomeId}/pagos/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body
        });
        if (!res.ok) throw new Error(await res.text());
        confirmModal.style.display = "none";
        successModal.style.display = "flex";
      } catch (err) {
        confirmModal.style.display = "none";
        alert("Error: " + (err?.message || "Error al guardar"));
      }
    };

    cancelChangesBtn.onclick = () => { confirmModal.style.display = "none"; };
    successOkBtn.onclick     = () => { window.location.href = "./income.html"; };
  }

  // 8) Vistas: cambiar entre formulario y tabla de historial
  if (historyBtn && logForm && historyTable && logButton) {
    historyBtn.onclick = () => {
      historyTable.style.display = "block";
      logForm.style.display = "none";
      logButton.style.display = "none";
      loadHistory();
    };
  }

  if (logDetailsBtn && logForm && historyTable && logButton) {
    logDetailsBtn.onclick = () => {
      logForm.style.display = "block";
      historyTable.style.display = "none";
      logButton.style.display = "flex";
    };
  }

  if (logDetailsSelect && logForm && historyTable && logButton) {
    logDetailsSelect.onclick = () => {
      logForm.style.display = "block";
      historyTable.style.display = "none";
      logButton.style.display = "flex";
    };
  }

  // 9) Historial
  let allPagos = [];

  async function loadHistory() {
    if (!historyBody) return;
    historyBody.innerHTML = "";
    allPagos = [];
    const datesSet = new Set();

    // Para cada ingreso fijo, traer sus pagos
    for (const ing of ingresosFijos) {
      try {
        const res = await authFetch(`${API_BASE}/api/IngresosFijos/${ing.id}/pagos/`, { method: "GET" });
        if (res.ok) {
          const pagos = await res.json();
          pagos.forEach((p) => {
            allPagos.push({ name: ing.name, amount: p.amount, date: p.date });
            datesSet.add(p.date);
          });
        }
      } catch (err) {
        console.error(`Error cargando pagos de ingreso ${ing.id}:`, err);
      }
    }

    // Popular filtro de fechas
    if (filterDate) {
      filterDate.innerHTML = '<option value="">-- All --</option>';
      Array.from(datesSet).sort().forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        filterDate.appendChild(opt);
      });
    }

    renderHistory(allPagos);
  }

  function renderHistory(data) {
    if (!historyBody) return;
    historyBody.innerHTML = "";
    data.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${p.name}</td><td>${p.amount}</td><td>${p.date}</td>`;
      historyBody.appendChild(tr);
    });
  }

  // 10) Filtros del historial
  const searchBtn = document.getElementById("search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      const fName = (filterIncome && filterIncome.value) || "";
      const fDate = (filterDate && filterDate.value) || "";
      const filtered = allPagos.filter((p) =>
        (fName === "" || p.name === fName) &&
        (fDate === "" || p.date === fDate)
      );
      renderHistory(filtered);
    });
  }

  console.info("[logIncome] API_BASE:", API_BASE);
});

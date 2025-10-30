// income.js
// Front desacoplado hablando con API en Render.
// Cambios clave:
// - Usa window.API_BASE (inyectado en js/config.js), no window.location.origin.
// - authFetch() añade Authorization y redirige al login si hay 401.
// - Descubre y cachea el endpoint "me" entre varias rutas comunes.
// - Resolver de imagen (absoluta o relativa al backend).

document.addEventListener("DOMContentLoaded", async () => {
  // 0) Autenticación básica
  const token = sessionStorage.getItem("authToken");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // 1) BASE del API: viene de js/config.js
  const API_BASE =
    typeof window.API_BASE === "string" && window.API_BASE
      ? window.API_BASE
      : window.location.origin;

  // 2) Elementos de perfil en la barra superior
  const nameEl = document.getElementById("incomeUsername");
  const iconEl = document.getElementById("walletProfileIcon");
  const imgEl  = document.getElementById("walletProfileImage");

  // 3) Helpers
  const showIconFallback = () => {
    if (imgEl)  imgEl.style.display  = "none";
    if (iconEl) iconEl.style.display = "block";
  };

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s; // absoluta (Cloudinary, etc.)
    const path = s.startsWith("/") ? s : `/${s}`;
    return `${API_BASE}${path}`; // relativa al backend (/media/…)
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
        if (r.ok) {
          sessionStorage.setItem(key, url);
          return url;
        }
      } catch {
        // probar siguiente candidato
      }
    }
    // si ninguno responde OK, devolvemos el primero (hará visible el error)
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

  // 4) Perfil: nombre e imagen
  try {
    const me = await fetchMe();
    if (nameEl) nameEl.textContent = me.first_name || me.email || "Usuario";

    const url = resolveImageUrl(me && me.profile_image);
    if (url && imgEl && iconEl) {
      imgEl.onload = () => { imgEl.style.display = "block"; iconEl.style.display = "none"; };
      imgEl.onerror = async () => {
        // si falla carga directa (media protegida), intenta fetch+blob
        try {
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) throw new Error("fetch image not ok");
          const blob = await r.blob();
          const objUrl = URL.createObjectURL(blob);
          imgEl.src = objUrl;
          imgEl.onload = () => { imgEl.style.display = "block"; iconEl.style.display = "none"; };
        } catch {
          showIconFallback();
        }
      };
      imgEl.src = url + (url.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`);
    } else {
      showIconFallback();
    }
  } catch {
    // si hay 401, authFetch ya nos llevó al login
    return;
  }

  // 5) Estado y carga de ingresos
  let allFijos = [];
  let allExtra = [];
  let currentTab = "fix"; // por defecto

  async function loadIngresos() {
    try {
      // Ingresos Fijos
      const resFijos = await authFetch(`${API_BASE}/api/IngresosFijos/`, { method: "GET" });
      if (resFijos.ok) {
        allFijos = await resFijos.json();
        renderFijos(allFijos);
        if (currentTab === "fix") fillFiltersFix(allFijos);
      }

      // Ingresos Extra
      const resExtra = await authFetch(`${API_BASE}/api/IngresosExtra/`, { method: "GET" });
      if (resExtra.ok) {
        allExtra = await resExtra.json();
        renderExtra(allExtra);
        if (currentTab === "supp") fillFiltersSupp(allExtra);
      }
    } catch (err) {
      console.error("Error cargando ingresos:", err);
    }
  }

  function renderFijos(data) {
    const tbody = document.querySelector(".fixed-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.name}</td><td>${item.reason || ""}</td><td>${item.quantity}</td><td>${item.period || ""}</td>`;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href = `newIncome.html?id=${item.id}`;
      });
      tbody.appendChild(tr);
    });
  }

  function renderExtra(data) {
    const tbody = document.querySelector(".supp-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.name}</td><td>${item.quantity}</td><td>${item.date}</td>`;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href = `newSuppIncome.html?id=${item.id}`;
      });
      tbody.appendChild(tr);
    });
  }

  function fillFiltersFix(data) {
    const f1 = document.getElementById("fixFilter1");
    const f2 = document.getElementById("fixFilter2");
    if (!f1 || !f2) return;

    const names   = [...new Set(data.map((i) => i.name).filter(Boolean))];
    const periods = [...new Set(data.map((i) => i.period).filter(Boolean))];

    f1.innerHTML = '<option value="">-- All --</option>';
    names.forEach((n) => (f1.innerHTML += `<option value="${n}">${n}</option>`));

    f2.innerHTML = '<option value="">-- All --</option>';
    periods.forEach((p) => (f2.innerHTML += `<option value="${p}">${p}</option>`));
  }

  function fillFiltersSupp(data) {
    const f1 = document.getElementById("suppFilter1");
    const f2 = document.getElementById("suppFilter2");
    if (!f1 || !f2) return;

    const names = [...new Set(data.map((i) => i.name).filter(Boolean))];
    const dates = [...new Set(data.map((i) => i.date).filter(Boolean))];

    f1.innerHTML = '<option value="">-- All --</option>';
    names.forEach((n) => (f1.innerHTML += `<option value="${n}">${n}</option>`));

    f2.innerHTML = '<option value="">-- All --</option>';
    dates.forEach((d) => (f2.innerHTML += `<option value="${d}">${d}</option>`));
  }

  // 6) Filtros
  const fixBtn  = document.getElementById("fixSearchBtn");
  const suppBtn = document.getElementById("suppSearchBtn");

  if (fixBtn) {
    fixBtn.addEventListener("click", () => {
      const f1 = (document.getElementById("fixFilter1") || {}).value || "";
      const f2 = (document.getElementById("fixFilter2") || {}).value || "";
      const filtered = allFijos.filter(
        (i) => (f1 === "" || i.name === f1) && (f2 === "" || i.period === f2)
      );
      renderFijos(filtered);
    });
  }

  if (suppBtn) {
    suppBtn.addEventListener("click", () => {
      const f1 = (document.getElementById("suppFilter1") || {}).value || "";
      const f2 = (document.getElementById("suppFilter2") || {}).value || "";
      const filtered = allExtra.filter(
        (i) => (f1 === "" || i.name === f1) && (f2 === "" || i.date === f2)
      );
      renderExtra(filtered);
    });
  }

  // 7) Tabs
  window.switchTab = (tab) => {
    currentTab = tab;
    const fixView  = document.getElementById("fixView");
    const suppView = document.getElementById("suppView");

    if (tab === "fix") {
      if (fixView)  fixView.style.display  = "block";
      if (suppView) suppView.style.display = "none";
      fillFiltersFix(allFijos);
    } else {
      if (fixView)  fixView.style.display  = "none";
      if (suppView) suppView.style.display = "block";
      fillFiltersSupp(allExtra);
    }
  };

  // 8) Carga inicial
  loadIngresos();

  console.info("[income] API_BASE:", API_BASE);
});

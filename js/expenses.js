// expenses.js
// Front robusto para gastos (fijos y variables).
// - Usa window.API_BASE definido en js/config.js (sin hardcodear dominios).
// - Tolera distintas rutas de backend (me, egresos fijos, egresos extra).
// - Maneja 401 → redirige al login.
// - Resuelve URL de imagen de perfil (absoluta o relativa al backend).

document.addEventListener("DOMContentLoaded", async () => {
  // 0) Autenticación básica
  const token = sessionStorage.getItem("authToken");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // 1) BASE del API: la inyecta js/config.js. Si no, cae a same-origin.
  const API_BASE =
    typeof window.API_BASE === "string" && window.API_BASE
      ? window.API_BASE
      : window.location.origin;

  // 2) Elementos del header/usuario
  const nameEl = document.getElementById("displayName"); // <span>
  const iconEl = document.getElementById("baseProfileIcon"); // ícono por defecto
  const imgEl = document.getElementById("baseProfileImage"); // <img>

  // 3) Helper: normaliza URL de imagen (acepta absoluta o relativa)
  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s; // ya es absoluta (p.ej. Cloudinary)
    const path = s.startsWith("/") ? s : `/${s}`;
    return `${API_BASE}${path}`;
  };

  // 4) Helper: fetch autenticado + manejo de 401
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
      // Sesión inválida/expirada → login
      sessionStorage.clear();
      window.location.href = "index.html";
      throw new Error("No autorizado");
    }
    return resp;
  }

  // 5) Descubrimiento de endpoints (tolerante a nombres)
  // Guardamos la ruta que funciona en sessionStorage para no probar siempre.
  async function discoverOnce(key, candidates) {
    // cache
    const cached = sessionStorage.getItem(key);
    if (cached) return cached;

    for (const url of candidates) {
      try {
        const r = await authFetch(url, { method: "GET" });
        // Para listados: aceptamos 200 (o 204 si backend devuelve vacío)
        if (r.ok) {
          sessionStorage.setItem(key, url);
          return url;
        }
      } catch {
        // ignora y sigue con el siguiente
      }
    }
    // Si ninguno responde OK, devolvemos el primero para que falle de forma visible
    return candidates[0];
  }

  // 5.a) Perfil del usuario (me)
  async function getProfile() {
    const ME_KEY = "endpoint_me";
    const meCandidates = [
      `${API_BASE}/api/auth/me/`,
      `${API_BASE}/api/users/me/`,
      `${API_BASE}/api/me/`,
      `${API_BASE}/api/user/me/`,
    ];
    const meUrl = await discoverOnce(ME_KEY, meCandidates);
    const res = await authFetch(meUrl);
    if (!res.ok) throw new Error("No autorizado");
    return res.json();
  }

  // 5.b) Endpoints de egresos fijos y extra (varios nombres comunes)
  async function getFixUrl() {
    const KEY = "endpoint_egresos_fijos";
    const candidates = [
      `${API_BASE}/api/EgresosFijos/`,   // tu ruta actual
      `${API_BASE}/api/egresos/fijos/`,  // alternativa common
      `${API_BASE}/api/egresos-fijos/`,  // alternativa common
    ];
    return discoverOnce(KEY, candidates);
  }

  async function getVarUrl() {
    const KEY = "endpoint_egresos_extra";
    const candidates = [
      `${API_BASE}/api/EgresosExtra/`,    // tu ruta actual
      `${API_BASE}/api/egresos/extra/`,   // alternativa common
      `${API_BASE}/api/egresos-variados/`,// alternativa común
    ];
    return discoverOnce(KEY, candidates);
  }

  // 6) Carga de datos
  let allFijos = [];
  let allVars = [];
  let currentTab = "fix";

  async function loadHeader() {
    try {
      const data = await getProfile();
      if (nameEl) nameEl.textContent = data.first_name || data.email || "Usuario";

      const url = resolveImageUrl(data && data.profile_image);
      if (url && imgEl && iconEl) {
        imgEl.onload = () => {
          imgEl.style.display = "block";
          iconEl.style.display = "none";
        };
        imgEl.onerror = () => {
          imgEl.style.display = "none";
          iconEl.style.display = "block";
        };
        imgEl.src = url + (url.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`);
      }
    } catch (_) {
      // Si falla el perfil, pedimos login
      window.location.href = "index.html";
    }
  }

  async function loadExpenses() {
    try {
      // Fijos
      const fixUrl = await getFixUrl();
      const resFix = await authFetch(fixUrl);
      if (resFix.ok) {
        allFijos = await resFix.json();
        renderFix(allFijos);
        if (currentTab === "fix") fillFiltersFix(allFijos);
      }

      // Variables
      const varUrl = await getVarUrl();
      const resVar = await authFetch(varUrl);
      if (resVar.ok) {
        allVars = await resVar.json();
        renderVar(allVars);
        if (currentTab === "var") fillFiltersVar(allVars);
      }
    } catch (err) {
      console.error("Error cargando gastos:", err);
    }
  }

  // 7) Render de tablas
  function renderFix(data) {
    const tbody = document.querySelector(".fixed-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.name ?? ""}</td><td>${item.quantity ?? 0}</td><td>${item.period ?? ""}</td>`;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href = `newExpense.html?id=${item.id}`;
      });
      tbody.appendChild(tr);
    });
  }

  function renderVar(data) {
    const tbody = document.querySelector(".supp-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.name ?? ""}</td><td>${item.quantity ?? 0}</td><td>${item.date ?? ""}</td>`;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href = `newExtraExp.html?id=${item.id}`;
      });
      tbody.appendChild(tr);
    });
  }

  // 8) Filtros
  function fillFiltersFix(data) {
    const f1 = document.getElementById("fixFilter1");
    const f2 = document.getElementById("fixFilter2");
    if (!f1 || !f2) return;

    const names = [...new Set(data.map((i) => i.name).filter(Boolean))];
    const periods = [...new Set(data.map((i) => i.period).filter(Boolean))];

    f1.innerHTML = '<option value="">-- All --</option>';
    names.forEach((n) => (f1.innerHTML += `<option value="${n}">${n}</option>`));

    f2.innerHTML = '<option value="">-- All --</option>';
    periods.forEach((p) => (f2.innerHTML += `<option value="${p}">${p}</option>`));
  }

  function fillFiltersVar(data) {
    const f1 = document.getElementById("varFilter1");
    const f2 = document.getElementById("varFilter2");
    if (!f1 || !f2) return;

    const names = [...new Set(data.map((i) => i.name).filter(Boolean))];
    const dates = [...new Set(data.map((i) => i.date).filter(Boolean))];

    f1.innerHTML = '<option value="">-- All --</option>';
    names.forEach((n) => (f1.innerHTML += `<option value="${n}">${n}</option>`));

    f2.innerHTML = '<option value="">-- All --</option>';
    dates.forEach((d) => (f2.innerHTML += `<option value="${d}">${d}</option>`));
  }

  // 9) Eventos de búsqueda
  const fixBtn = document.getElementById("fixSearchBtn");
  if (fixBtn) {
    fixBtn.addEventListener("click", () => {
      const f1 = (document.getElementById("fixFilter1") || {}).value || "";
      const f2 = (document.getElementById("fixFilter2") || {}).value || "";
      const filtered = allFijos.filter(
        (i) => (f1 === "" || i.name === f1) && (f2 === "" || i.period === f2)
      );
      renderFix(filtered);
    });
  }

  const varBtn = document.getElementById("varSearchBtn");
  if (varBtn) {
    varBtn.addEventListener("click", () => {
      const f1 = (document.getElementById("varFilter1") || {}).value || "";
      const f2 = (document.getElementById("varFilter2") || {}).value || "";
      const filtered = allVars.filter(
        (i) => (f1 === "" || i.name === f1) && (f2 === "" || i.date === f2)
      );
      renderVar(filtered);
    });
  }

  // 10) Cambio de pestaña (expuesto en window como antes)
  window.switchTab = (tab) => {
    currentTab = tab;
    const fixView = document.getElementById("fixView");
    const varView = document.getElementById("varView");
    if (!fixView || !varView) return;

    if (tab === "fix") {
      fixView.style.display = "block";
      varView.style.display = "none";
      fillFiltersFix(allFijos);
    } else {
      fixView.style.display = "none";
      varView.style.display = "block";
      fillFiltersVar(allVars);
    }
  };

  // 11) Arranque
  await loadHeader();
  await loadExpenses();

  // Log útil en consola
  console.info("[expenses] API_BASE:", API_BASE);
});

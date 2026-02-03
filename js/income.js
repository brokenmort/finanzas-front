// income.js (LOCAL)
// ✅ CAMBIOS PRINCIPALES vs tu versión anterior:
// 1) API_BASE: ya NO usamos window.location.origin (apunta al FRONT).
//    -> usamos window.API_BASE (config.js) y fallback a http://127.0.0.1:8000
// 2) Se elimina discovery de endpoints (discoverOnce + candidates).
//    -> endpoint real: GET /api/auth/me/
// 3) Se elimina authFetch propio.
//    -> usamos window.apiFetch() (config.js) que agrega Bearer automáticamente.
// 4) Todas las llamadas a endpoints ahora usan paths "/api/..." (sin concatenar API_BASE).
// 5) Manejo consistente de 401/403: limpia sesión y redirige al login.

document.addEventListener("DOMContentLoaded", async () => {
  // 0) Autenticación básica
  const token = sessionStorage.getItem("authToken");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // ✅ MODIFICADO: base del API desde config.js (solo para resolver media/urls absolutas)
  const API_BASE =
    (typeof window.API_BASE === "string" && window.API_BASE)
      ? window.API_BASE
      : "http://127.0.0.1:8000";

  // ✅ MODIFICADO: endpoint fijo para perfil
  const ME_URL = "/api/auth/me/";

  // ✅ NUEVO: helper de auth error
  const handleAuthError = () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  };

  // 2) Elementos de perfil en la barra superior
  const nameEl = document.getElementById("incomeUsername");
  const iconEl = document.getElementById("walletProfileIcon");
  const imgEl  = document.getElementById("walletProfileImage");

  // 3) Helpers UI
  const showIconFallback = () => {
    if (imgEl)  imgEl.style.display  = "none";
    if (iconEl) iconEl.style.display = "block";
  };

  // ✅ MODIFICADO: normaliza URL de imagen (absoluta vs relativa al backend)
  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s; // absoluta (Cloudinary, etc.)
    const path = s.startsWith("/") ? s : `/${s}`;
    return `${API_BASE}${path}`; // relativa al backend (/media/…)
  };

  // ✅ MODIFICADO: fetchMe usando apiFetch (sin discovery)
  async function fetchMe() {
    const res = await window.apiFetch(ME_URL, { method: "GET" });

    if (res.status === 401 || res.status === 403) {
      handleAuthError();
      throw new Error("No autorizado");
    }

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Error al cargar perfil: ${res.status} ${t}`);
    }

    return res.json();
  }

  // 4) Perfil: nombre e imagen
  try {
    const me = await fetchMe();
    if (nameEl) nameEl.textContent = me.first_name || me.email || "Usuario";

    const url = resolveImageUrl(me && me.profile_image);
    if (url && imgEl && iconEl) {
      imgEl.onload = () => {
        imgEl.style.display = "block";
        iconEl.style.display = "none";
      };

      imgEl.onerror = async () => {
        // Si falla carga directa (media protegida), intenta fetch+blob con Bearer
        try {
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) throw new Error("fetch image not ok");
          const blob = await r.blob();
          const objUrl = URL.createObjectURL(blob);
          imgEl.src = objUrl;
          imgEl.onload = () => {
            imgEl.style.display = "block";
            iconEl.style.display = "none";
          };
        } catch {
          showIconFallback();
        }
      };

      imgEl.src = url + (url.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`);
    } else {
      showIconFallback();
    }
  } catch (e) {
    // Si hay 401/403 ya redirigimos; si no, log.
    console.error("[income] error perfil:", e);
    return;
  }

  // 5) Estado y carga de ingresos
  let allFijos = [];
  let allExtra = [];
  let currentTab = "fix"; // por defecto

  // ✅ MODIFICADO: carga usando apiFetch con paths
  async function loadIngresos() {
    try {
      // Ingresos Fijos
      const resFijos = await window.apiFetch("/api/IngresosFijos/", { method: "GET" });
      if (resFijos.status === 401 || resFijos.status === 403) return handleAuthError();
      if (resFijos.ok) {
        allFijos = await resFijos.json();
        renderFijos(allFijos);
        if (currentTab === "fix") fillFiltersFix(allFijos);
      } else {
        console.warn("[income] IngresosFijos no ok:", resFijos.status);
      }

      // Ingresos Extra
      const resExtra = await window.apiFetch("/api/IngresosExtra/", { method: "GET" });
      if (resExtra.status === 401 || resExtra.status === 403) return handleAuthError();
      if (resExtra.ok) {
        allExtra = await resExtra.json();
        renderExtra(allExtra);
        if (currentTab === "supp") fillFiltersSupp(allExtra);
      } else {
        console.warn("[income] IngresosExtra no ok:", resExtra.status);
      }
    } catch (err) {
      console.error("[income] Error cargando ingresos:", err);
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

window.goToWallet = () => {
  window.location.replace("wallet.html");
};


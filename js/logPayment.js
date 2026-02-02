// logPayment.js
// Misma lógica que logIncome.js pero usando EGRESOS FIJOS.

document.addEventListener("DOMContentLoaded", async () => {

  // =========================
  // 0) AUTH
  // =========================
  const token = sessionStorage.getItem("authToken");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // =========================
  // 1) API BASE
  // =========================
  const API_BASE =
    typeof window.API_BASE === "string" && window.API_BASE
      ? window.API_BASE
      : window.location.origin;

  // =========================
  // 2) DOM
  // =========================
  const nameEl = document.getElementById("displayName");
  const iconEl = document.getElementById("baseProfileIcon");
  const imgEl = document.getElementById("baseProfileImage");

  const expenseSelect = document.getElementById("expense");
  const amountInput = document.getElementById("amount");
  const dateInput = document.getElementById("date");

  const historyBody = document.querySelector(".history-details tbody");

  const filterExpense = document.getElementById("exp");
  const filterDate = document.querySelector('.menu-list select[name="date"]');

  const logButton = document.querySelector(".log-button");
  const logForm = document.querySelector(".log-form");
  const historyTable = document.querySelector(".history-table");

  const historyBtn = document.getElementById("history");
  const logDetailsBtn = document.getElementById("logDetails");
  const logDetailsSelect = document.getElementById("logDetailsSelect");

  const saveBtn = document.getElementById("save-btn");
  const confirmModal = document.getElementById("confirmModal");
  const successModal = document.getElementById("successModal");
  const confirmChangesBtn = document.getElementById("confirmChangesBtn");
  const cancelChangesBtn = document.getElementById("cancelChangesBtn");
  const successOkBtn = document.getElementById("successOkBtn");

  const searchBtn = document.getElementById("search-btn");

  // =========================
  // HELPERS
  // =========================
  const showIconFallback = () => {
    if (imgEl) imgEl.style.display = "none";
    if (iconEl) iconEl.style.display = "block";
  };

  const resolveImageUrl = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;

    if (/^https?:\/\//i.test(s)) return s;

    const path = s.startsWith("/") ? s : `/${s}`;
    return `${API_BASE}${path}`;
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
        const r = await authFetch(url);
        if (r.ok) {
          sessionStorage.setItem(key, url);
          return url;
        }
      } catch {}
    }

    return candidates[0];
  }

  async function fetchMe() {
    const candidates = [
      `${API_BASE}/api/auth/me/`,
      `${API_BASE}/api/users/me/`,
      `${API_BASE}/api/me/`,
      `${API_BASE}/api/user/me/`,
    ];

    const meUrl = await discoverOnce("endpoint_me", candidates);
    const res = await authFetch(meUrl);

    if (!res.ok) throw new Error("No autorizado");
    return res.json();
  }

  // =========================
  // USER DATA
  // =========================
  try {
    const me = await fetchMe();

    if (nameEl)
      nameEl.textContent =
        me.first_name || me.email || "Usuario";

    const url = resolveImageUrl(me.profile_image);

    if (url && imgEl && iconEl) {
      imgEl.onload = () => {
        imgEl.style.display = "block";
        iconEl.style.display = "none";
      };

      imgEl.onerror = showIconFallback;
      imgEl.src = url + `?t=${Date.now()}`;
    } else {
      showIconFallback();
    }
  } catch {
    return;
  }

  // =========================
  // DEFAULT DATE
  // =========================
  if (dateInput)
    dateInput.value = new Date().toISOString().split("T")[0];

  // =========================
  // LOAD EGRESOS FIJOS
  // =========================
  let egresosFijos = [];

  try {
    const res = await authFetch(`${API_BASE}/api/EgresosFijos/`);

    if (res.ok) {
      egresosFijos = await res.json();

      if (expenseSelect) {
        expenseSelect.innerHTML =
          '<option value="">-- Select --</option>';

        egresosFijos.forEach((e) => {
          const opt = document.createElement("option");
          opt.value = e.id;
          opt.textContent = `${e.name} (${e.period || "-"})`;
          opt.dataset.quantity = e.quantity;
          expenseSelect.appendChild(opt);
        });
      }

      if (filterExpense) {
        filterExpense.innerHTML =
          '<option value="">-- All --</option>';

        [...new Set(egresosFijos.map(e => e.name))]
          .forEach((name) => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            filterExpense.appendChild(opt);
          });
      }
    }
  } catch (err) {
    console.error("Error cargando egresos:", err);
  }

  // Autocompletar monto
  if (expenseSelect && amountInput) {
    expenseSelect.addEventListener("change", () => {
      const selected =
        expenseSelect.options[expenseSelect.selectedIndex];
      amountInput.value =
        selected?.dataset.quantity || "";
    });
  }

  // =========================
  // SAVE PAYMENT
  // =========================
  saveBtn.onclick = (e) => {
    e.preventDefault();
    confirmModal.style.display = "flex";
  };

  confirmChangesBtn.onclick = async () => {
    const expenseId = expenseSelect.value;

    if (!expenseId) {
      alert("Select expense");
      return;
    }

    try {
      const body = JSON.stringify({
        amount: amountInput.value,
        date: dateInput.value,
      });

      const res = await authFetch(
        `${API_BASE}/api/EgresosFijos/${expenseId}/pagos/`,
        { method: "POST", body }
      );

      if (!res.ok) throw new Error();

      confirmModal.style.display = "none";
      successModal.style.display = "flex";
    } catch {
      confirmModal.style.display = "none";
      alert("Error saving payment");
    }
  };

  cancelChangesBtn.onclick =
    () => (confirmModal.style.display = "none");

  successOkBtn.onclick =
    () => (window.location.href = "expenses.html");

  // =========================
  // VIEW SWITCH
  // =========================
  historyBtn.onclick = () => {
    historyTable.style.display = "block";
    logForm.style.display = "none";
    logButton.style.display = "none";
    loadHistory();
  };

  logDetailsBtn.onclick =
    logDetailsSelect.onclick =
    () => {
      logForm.style.display = "block";
      historyTable.style.display = "none";
      logButton.style.display = "flex";
    };

  // =========================
  // HISTORY
  // =========================
  let allPagos = [];

  async function loadHistory() {
    if (!historyBody) return;

    historyBody.innerHTML = "";
    allPagos = [];
    const datesSet = new Set();

    for (const e of egresosFijos) {
      try {
        const res = await authFetch(
          `${API_BASE}/api/EgresosFijos/${e.id}/pagos/`
        );

        if (res.ok) {
          const pagos = await res.json();

          pagos.forEach((p) => {
            allPagos.push({
              name: e.name,
              amount: p.amount,
              date: p.date,
            });
            datesSet.add(p.date);
          });
        }
      } catch {}
    }

    if (filterDate) {
      filterDate.innerHTML =
        '<option value="">-- All --</option>';

      [...datesSet].sort().forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        filterDate.appendChild(opt);
      });
    }

    renderHistory(allPagos);
  }

  function renderHistory(data) {
    historyBody.innerHTML = "";

    data.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.amount}</td>
        <td>${p.date}</td>
      `;
      historyBody.appendChild(tr);
    });
  }

  // =========================
  // FILTERS
  // =========================
  searchBtn.addEventListener("click", () => {
    const fName = filterExpense?.value || "";
    const fDate = filterDate?.value || "";

    const filtered = allPagos.filter(
      (p) =>
        (fName === "" || p.name === fName) &&
        (fDate === "" || p.date === fDate)
    );

    renderHistory(filtered);
  });

  console.info("[logPayment] API_BASE:", API_BASE);
});

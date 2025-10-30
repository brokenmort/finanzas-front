// Central API base config (ASCII only comments).
// - Default production API: your Render backend
// - Local dev: if you open the front on localhost, it points to 127.0.0.1:8000
// - Supports override via query (?api=...) or localStorage (apiBaseOverride)

(function () {
  // ---- YOU CAN CHANGE THESE IF YOUR DOMAINS CHANGE ----
  const DEFAULT_RENDER_API = "https://django-api-05y3.onrender.com";
  const LOCAL_DEV_API = "http://127.0.0.1:8000";
  // ------------------------------------------------------

  // Decide a sensible default:
  // - If you're on localhost -> use local Django dev server
  // - Otherwise -> use Render backend
  const onLocalhost =
    ["localhost", "127.0.0.1"].includes(location.hostname) ||
    location.hostname.endsWith(".local");

  const DEFAULT_BASE = onLocalhost ? LOCAL_DEV_API : DEFAULT_RENDER_API;

  // Read override from URL (?api=...) or localStorage ("apiBaseOverride")
  const params = new URLSearchParams(window.location.search);
  const queryApi = params.get("api");
  const storedApi = (function () {
    try {
      return localStorage.getItem("apiBaseOverride");
    } catch (_) {
      return null;
    }
  })();

  // Normalize URL: trim, add https if missing when not absolute, drop trailing slash
  const normalize = (u) => {
    if (!u) return null;
    let x = String(u).trim();
    if (!x) return null;
    if (!/^https?:\/\//i.test(x)) x = "https://" + x;
    return x.replace(/\/+$/, "");
  };

  let apiBase =
    normalize(queryApi) || normalize(storedApi) || normalize(DEFAULT_BASE);

  // Expose base in window
  window.API_BASE = apiBase;

  // Helpers to set/clear override at runtime
  window.setApiBase = function (url) {
    const v = normalize(url);
    try {
      if (v) localStorage.setItem("apiBaseOverride", v);
    } catch (_) {}
    window.API_BASE = v || window.API_BASE;
    console.info("API_BASE override set to:", window.API_BASE);
  };

  window.clearApiBaseOverride = function () {
    try {
      localStorage.removeItem("apiBaseOverride");
    } catch (_) {}
    window.API_BASE = normalize(DEFAULT_BASE);
    console.info("API_BASE override cleared. Using:", window.API_BASE);
  };

  // Build absolute API URL from a path
  // Accepts: "/api/..." or "api/..." or a full "http(s)://..."
  window.apiUrl = function (path) {
    if (!path) return window.API_BASE;
    if (/^https?:\/\//i.test(path)) return path;
    return window.API_BASE + (path.startsWith("/") ? path : `/${path}`);
  };

  // Lightweight fetch wrapper:
  // - Adds JSON headers by default
  // - If a JWT token exists in localStorage ("access" or "token"), adds Authorization: Bearer
  // - You can pass { json: false } to avoid setting Content-Type/JSON encoding
  // - You can pass { auth: false } to avoid adding the Authorization header
  window.apiFetch = async function (path, opts = {}) {
    const {
      json = true,
      auth = true,
      headers: extraHeaders,
      body,
      ...rest
    } = opts;

    const headers = new Headers(extraHeaders || {});
    if (json && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (auth) {
      // Try common keys where the app might store JWT access token
      const token =
        (function () {
          try {
            return (
              localStorage.getItem("access") ||
              localStorage.getItem("token") ||
              null
            );
          } catch (_) {
            return null;
          }
        })() || null;

      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const url = window.apiUrl(path);

    const finalInit = {
      method: "GET",
      mode: "cors",
      credentials: "omit", // using JWT by header; if you switch to cookies, change to "include"
      headers,
      ...rest,
    };

    // Auto JSON stringify if body is a plain object and json=true
    if (typeof body !== "undefined") {
      finalInit.method = finalInit.method || "POST";
      finalInit.body = json && body && typeof body === "object"
        ? JSON.stringify(body)
        : body;
    }

    const res = await fetch(url, finalInit);
    return res;
  };

  console.info("API_BASE:", window.API_BASE);
})();

// Central API base config (ASCII only comments).
// - Default: Heroku (works with your Live Server)
// - If frontend runs on Render, set DEFAULT_RENDER_API to your backend on Render
// - Supports override via query (?api=...) or localStorage (apiBaseOverride)
(function () {
  // Default to same-origin so frontend and backend
  // work together in a single Heroku app (no CORS).
  const DEFAULT_SAME_ORIGIN = window.location.origin;

  // Read override from query or localStorage
  const params = new URLSearchParams(window.location.search);
  const queryApi = params.get("api");
  const storedApi = (function(){
    try { return localStorage.getItem("apiBaseOverride"); } catch (_) { return null; }
  })();

  // Normalize URL: trim, add https if missing, drop trailing slash
  const normalize = (u) => {
    if (!u) return null;
    let x = String(u).trim();
    if (!x) return null;
    if (!/^https?:\/\//i.test(x)) x = "https://" + x;
    return x.replace(/\/+$/, "");
  };

  let apiBase = normalize(queryApi) || normalize(storedApi) || normalize(DEFAULT_SAME_ORIGIN);

  window.API_BASE = apiBase;

  // Helpers to set/clear override at runtime
  window.setApiBase = function (url) {
    try { localStorage.setItem("apiBaseOverride", url); } catch (_) {}
    window.API_BASE = normalize(url);
    console.info("API_BASE override set to:", window.API_BASE);
  };
  window.clearApiBaseOverride = function () {
    try { localStorage.removeItem("apiBaseOverride"); } catch (_) {}
    console.info("API_BASE override cleared. Using:", window.API_BASE);
  };

  console.info("API_BASE:", window.API_BASE);
})();

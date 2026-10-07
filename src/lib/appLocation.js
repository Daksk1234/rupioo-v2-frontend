const APP_ROOT_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/no-access",
  "/profile",
  "/storage-settings",
  "/master/storage-connection",
]);

export function isAppRoutePath(pathname = "") {
  const path = String(pathname || "");
  return APP_ROOT_PATHS.has(path) || path.startsWith("/dms/") || path.startsWith("/master/") || path.startsWith("/vendor/portal/");
}

function hashRouteParts() {
  if (typeof window === "undefined") return { pathname: "/", search: "" };

  const hash = String(window.location.hash || "");
  if (hash.startsWith("#/")) {
    const route = hash.slice(1);
    const queryIndex = route.indexOf("?");
    return {
      pathname: queryIndex >= 0 ? route.slice(0, queryIndex) : route,
      search: queryIndex >= 0 ? route.slice(queryIndex) : "",
    };
  }

  return {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
  };
}

export function getAppPathname() {
  return hashRouteParts().pathname;
}

export function getAppSearch() {
  return hashRouteParts().search;
}

export function toHashRouteUrl(target) {
  if (typeof window === "undefined") return String(target || "");
  const raw = String(target || "").trim();
  if (!raw) return `${window.location.origin}/#/`;
  if (/^(?:mailto:|tel:|javascript:|blob:|data:)/i.test(raw)) return raw;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return url.toString();
    if (url.hash.startsWith("#/")) return url.toString();

    const route = `${url.pathname || "/"}${url.search || ""}`;
    return `${window.location.origin}/#${route}`;
  } catch {
    if (raw.startsWith("#/")) return `${window.location.origin}/${raw}`;
    const route = raw.startsWith("/") ? raw : `/${raw}`;
    return `${window.location.origin}/#${route}`;
  }
}

export function goToAppRoute(target, { replace = false } = {}) {
  if (typeof window === "undefined") return;
  const next = toHashRouteUrl(target);
  if (replace) window.location.replace(next);
  else window.location.assign(next);
}

export function ensureHashRoute() {
  if (typeof window === "undefined") return false;
  if (String(window.location.hash || "").startsWith("#/")) return false;

  const path = window.location.pathname || "/";
  const search = window.location.search || "";
  if (!isAppRoutePath(path)) return false;

  window.location.replace(`${window.location.origin}/#${path}${search}`);
  return true;
}

export function installHashRouteLinkGuard() {
  if (typeof window === "undefined") return () => {};

  const onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor || anchor.hasAttribute("download")) return;

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || /^(?:mailto:|tel:|javascript:|blob:|data:)/i.test(href)) return;

    let url;
    try {
      url = new URL(href, window.location.origin);
    } catch {
      return;
    }

    if (url.origin !== window.location.origin || !isAppRoutePath(url.pathname)) return;

    event.preventDefault();
    const next = toHashRouteUrl(url.toString());
    if (anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey) {
      window.open(next, anchor.target === "_blank" ? "_blank" : "_blank");
      return;
    }
    window.location.assign(next);
  };

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

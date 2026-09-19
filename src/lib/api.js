const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

// Legacy SUPERADMIN JWTs contained the complete permission catalogue and could
// exceed 50 KB. Treat such a stored token as unusable so it is never sent in a
// request header and the user is redirected to sign in again.
const MAX_SAFE_AUTH_TOKEN_LENGTH = 6000;

const PUBLIC_API_PATHS = new Set([
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
]);

const isPublicApiPath = (path) =>
  PUBLIC_API_PATHS.has(path) || String(path || "").startsWith("/registration/");

export const token = () => {
  const value = sessionStorage.getItem("rupioo_token") || "";
  return value.length <= MAX_SAFE_AUTH_TOKEN_LENGTH ? value : "";
};

export const getUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem("rupioo_user") || "null");
  } catch {
    return null;
  }
};

const normalizeAllowedPermission = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((code) => String(code || "").trim())
        .filter(Boolean),
    ),
  );

export const getAllowedPermission = () => {
  try {
    const stored =
      sessionStorage.getItem("allowedPermission") ||
      localStorage.getItem("allowedPermission") ||
      "[]";
    return normalizeAllowedPermission(JSON.parse(stored));
  } catch {
    return normalizeAllowedPermission(getUser()?.allowedPermission || []);
  }
};

const persistAllowedPermission = (user, explicitPermissions) => {
  if (!user || user.role === "MASTER") {
    sessionStorage.removeItem("allowedPermission");
    localStorage.removeItem("allowedPermission");
    return [];
  }

  const allowedPermission = normalizeAllowedPermission(
    explicitPermissions ?? user.allowedPermission ?? user.permissions ?? [],
  );
  const serialized = JSON.stringify(allowedPermission);

  // Keep the exact legacy key as well because older DMS modules may still read
  // localStorage.allowedPermission directly. Authorization remains enforced by
  // the signed backend session; this browser value only controls the UI.
  sessionStorage.setItem("allowedPermission", serialized);
  localStorage.setItem("allowedPermission", serialized);

  return allowedPermission;
};

export const getTenantId = () =>
  sessionStorage.getItem("rupioo_tenant_id") || getUser()?.tenantId || "";

export const setSession = (data) => {
  const rawUser = data?.user || null;
  const allowedPermission = persistAllowedPermission(
    rawUser,
    data?.allowedPermission ?? rawUser?.allowedPermission,
  );
  const sessionUser = rawUser
    ? {
        ...rawUser,
        ...(rawUser.role === "MASTER" ? {} : { allowedPermission }),
      }
    : null;

  sessionStorage.setItem("rupioo_token", data?.token || "");
  sessionStorage.setItem("rupioo_user", JSON.stringify(sessionUser));
  sessionStorage.setItem("rupioo_tenant_id", sessionUser?.tenantId || "");

  // Remove the old persistent browser login so closing the browser ends the session.
  localStorage.removeItem("rupioo_token");
  localStorage.removeItem("rupioo_user");
};

export const updateSessionUser = (patch = {}) => {
  const current = getUser() || {};
  const merged = { ...current, ...patch };
  const allowedPermission = persistAllowedPermission(
    merged,
    patch.allowedPermission ?? merged.allowedPermission,
  );
  const next =
    merged.role === "MASTER"
      ? merged
      : { ...merged, allowedPermission };

  sessionStorage.setItem("rupioo_user", JSON.stringify(next));
  if (next.tenantId) {
    sessionStorage.setItem("rupioo_tenant_id", next.tenantId);
  }
  return next;
};

export const replaceSessionToken = (nextToken = "") => {
  if (!nextToken) return;
  sessionStorage.setItem("rupioo_token", nextToken);
};

export const clearSession = () => {
  sessionStorage.removeItem("rupioo_token");
  sessionStorage.removeItem("rupioo_user");
  sessionStorage.removeItem("rupioo_tenant_id");
  sessionStorage.removeItem("allowedPermission");
  localStorage.removeItem("rupioo_token");
  localStorage.removeItem("rupioo_user");
  localStorage.removeItem("allowedPermission");
};

export async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const authToken = token();
  if (!isPublicApiPath(path) && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
    const tenantId = getTenantId();
    if (tenantId) headers["X-Tenant-Id"] = tenantId;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const type = res.headers.get("content-type") || "";
  const payload = type.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    throw new Error(
      payload?.message || payload || `Request failed ${res.status}`,
    );
  }

  return payload?.data ?? payload;
}

export async function apiBlob(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const authToken = token();
  if (!isPublicApiPath(path) && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
    const tenantId = getTenantId();
    if (tenantId) headers["X-Tenant-Id"] = tenantId;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const type = res.headers.get("content-type") || "";
    const payload = type.includes("application/json")
      ? await res.json()
      : await res.text();
    throw new Error(payload?.message || payload || `Request failed ${res.status}`);
  }

  return {
    blob: await res.blob(),
    disposition: res.headers.get("content-disposition") || "",
    contentType: res.headers.get("content-type") || "",
  };
}

export const demoDashboard = {
  kpis: {
    sales: 16400000,
    grossProfit: 2380000,
    grossMarginPct: 14.5,
    collectionAchievement: 77,
    targetAchievement: 82,
    greenSalesPct: 62,
    blueSalesPct: 27,
    redSalesPct: 11,
    receivable: 14200000,
    overdue: 3150000,
    stockValue: 8420000,
    deadStockValue: 380000,
    products: 248,
    customers: 1864,
    leads: 9017,
  },
  health: {
    score: 82,
    parts: {
      profitability: 86,
      salesGrowth: 82,
      collections: 77,
      inventory: 81,
      cashFlow: 76,
      customerQuality: 84,
      targetPerformance: 82,
      gstCompliance: 94,
    },
  },
  insights: [
    {
      severity: "high",
      title: "Low-margin sales rising",
      text: "11% of sales are in the red margin band. Review pricing and approvals.",
    },
    {
      severity: "medium",
      title: "Collections behind target",
      text: "Collection achievement is 77%. Prioritise overdue recovery.",
    },
    {
      severity: "good",
      title: "Healthy profit mix",
      text: "62% of sales are in the green band.",
    },
  ],
  salesTrend: [
    { month: "Apr", sales: 112 },
    { month: "May", sales: 126 },
    { month: "Jun", sales: 119 },
    { month: "Jul", sales: 143 },
    { month: "Aug", sales: 151 },
    { month: "Sep", sales: 164 },
  ],
  marginMix: [
    { name: "Green", value: 62 },
    { name: "Blue", value: 27 },
    { name: "Red", value: 11 },
  ],
};

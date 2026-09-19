const trimSlash = (value = "") => String(value || "").replace(/\/+$/, "");

export const apiBase = () => {
  const vite = import.meta?.env?.VITE_API_URL || import.meta?.env?.VITE_BACKEND_URL || "";
  if (vite) return trimSlash(vite);
  return trimSlash(localStorage.getItem("apiBaseUrl") || "http://localhost:4000");
};

export const getMailApiOrigin = () => {
  try {
    return new URL(apiBase(), window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("userData") || "{}");
  } catch {
    return {};
  }
};

export const getCurrentDatabase = () =>
  String(
    localStorage.getItem("selectedDatabase") ||
      localStorage.getItem("database") ||
      getCurrentUser()?.database ||
      "",
  ).trim();

const token = () => {
  const user = getCurrentUser();
  return (
    user?.token ||
    user?.accessToken ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("auth_token") ||
    ""
  );
};

const request = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  const auth = token();
  if (auth) headers.set("Authorization", `Bearer ${auth}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBase()}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

const dbPath = (database) => encodeURIComponent(database || getCurrentDatabase());

export const detectMailProvider = (email) =>
  request(`/mail/detect-provider?email=${encodeURIComponent(email)}`);

export const getMailStatus = (database) =>
  request(`/mail/status/${dbPath(database)}`);

export const beginMailConnect = (database, payload) =>
  request(`/mail/connect/${dbPath(database)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const connectSmtpMail = (database, payload) =>
  request(`/mail/connect-smtp/${dbPath(database)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const disconnectMail = (database) =>
  request(`/mail/disconnect/${dbPath(database)}`, { method: "POST" });

export const testMailConnection = (database) =>
  request(`/mail/test/${dbPath(database)}`, { method: "POST" });

export const updateMailSettings = (database, payload) =>
  request(`/mail/settings/${dbPath(database)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getMailOutbox = (database, params = {}) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.limit) qs.set("limit", String(params.limit));
  return request(`/mail/outbox/${dbPath(database)}${qs.toString() ? `?${qs}` : ""}`);
};

export const retryOutboxMail = (database, id) =>
  request(`/mail/outbox/${dbPath(database)}/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  });

export const sendCompanyDocumentMail = (database, formData) =>
  request(`/mail/send-document/${dbPath(database)}`, {
    method: "POST",
    body: formData,
  });

export const getMasterMailOverview = () => request("/mail/master/overview");

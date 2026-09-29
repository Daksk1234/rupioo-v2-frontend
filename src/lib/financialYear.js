const FY_RE = /^(\d{4})-(\d{2}|\d{4})$/;

export function normalizeFinancialYear(value) {
  const raw = String(value ?? "").trim().replace(/^FY\s*/i, "");
  const match = FY_RE.exec(raw);
  if (!match) return "";
  return `${match[1]}-${match[2].length === 4 ? match[2].slice(-2) : match[2]}`;
}

export function currentFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function financialYearFromDate(value) {
  if (!value) return "";
  let year;
  let month;
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
  } else {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    year = date.getFullYear();
    month = date.getMonth() + 1;
  }
  if (!Number.isFinite(year) || month < 1 || month > 12) return "";
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function configuredFinancialYear(user) {
  const profile = user?.companyProfile || {};
  return normalizeFinancialYear(profile.financialYear)
    || (Array.isArray(profile.financialYears) ? profile.financialYears.map(normalizeFinancialYear).find(Boolean) : "")
    || currentFinancialYear();
}

export function financialYearOptions(user, { count = 10, extra = [] } = {}) {
  const profile = user?.companyProfile || {};
  const configured = configuredFinancialYear(user);
  const configuredStart = Number(configured.slice(0, 4));
  const currentStart = Number(currentFinancialYear().slice(0, 4));
  const anchor = Math.max(configuredStart || 0, currentStart || 0);
  const generated = Array.from({ length: count }, (_, i) => {
    const start = anchor - i;
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  });
  return [...new Set([
    configured,
    ...(Array.isArray(profile.financialYears) ? profile.financialYears : []),
    ...extra,
    ...generated,
  ].map(normalizeFinancialYear).filter(Boolean))].sort((a, b) => Number(b.slice(0, 4)) - Number(a.slice(0, 4)));
}

export function localToday() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function initialDateForFinancialYear(financialYear, today = localToday()) {
  const fy = normalizeFinancialYear(financialYear) || currentFinancialYear();
  if (financialYearFromDate(today) === fy) return today;
  const start = Number(fy.slice(0, 4));
  if (!Number.isFinite(start)) return today;
  return `${start + 1}-03-31`;
}

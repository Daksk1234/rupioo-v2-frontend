import { api } from "./api.js";

export const GST_CHANGE_CONFIRMATION_REQUIRED = "GST_CHANGE_CONFIRMATION_REQUIRED";

const cleanGstin = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 15);

const clean = (value) => String(value ?? "").trim();

export const isGstTenantConfirmationError = (error) =>
  String(error?.code || error?.details?.code || "").toUpperCase() === GST_CHANGE_CONFIRMATION_REQUIRED;

const localConfirmationDetails = ({ currentGstin, currentTenantKey, nextGstin }) => ({
  code: GST_CHANGE_CONFIRMATION_REQUIRED,
  oldGstin: cleanGstin(currentGstin || currentTenantKey),
  newGstin: cleanGstin(nextGstin),
  oldTenantKey: clean(currentTenantKey || currentGstin),
  newTenantKey: cleanGstin(nextGstin),
  question: "GST Number changed. Do you want to move all company data from the old tenantKey to the new GST tenantKey?",
});

export async function saveWithGstTenantDecision({
  path,
  method = "PUT",
  payload = {},
  askDecision,
  currentGstin = "",
  currentTenantKey = "",
}) {
  const send = (body) => api(path, {
    method,
    body: JSON.stringify(body),
  });

  let body = { ...payload };
  const oldGstin = cleanGstin(currentGstin || currentTenantKey);
  const oldTenantKey = clean(currentTenantKey || currentGstin);
  const newGstin = cleanGstin(body?.gstin);
  const gstChangedInBrowser = Boolean(oldGstin && newGstin && oldGstin !== newGstin);
  const tenantMismatchInBrowser = Boolean(oldTenantKey && newGstin && cleanGstin(oldTenantKey) !== newGstin);
  const needsTenantDecision = gstChangedInBrowser || tenantMismatchInBrowser;

  // IMPORTANT: compare the requested GSTIN with the ACTUAL tenantKey, not only
  // with the saved GSTIN. This also repairs companies where an earlier edit
  // saved the new GSTIN but left the old tenantKey behind.
  if (needsTenantDecision && typeof body.migrateTenantData !== "boolean") {
    if (typeof askDecision !== "function") {
      throw new Error("GST Number changed. Migration confirmation is required before saving.");
    }
    const decision = await askDecision(localConfirmationDetails({
      currentGstin: oldGstin,
      currentTenantKey: oldTenantKey,
      nextGstin: newGstin,
    }));
    if (decision === null) {
      return { cancelled: true, migrateTenantData: null, data: null };
    }
    body = { ...body, gstin: newGstin, migrateTenantData: Boolean(decision) };
  }

  try {
    return {
      cancelled: false,
      migrateTenantData: typeof body.migrateTenantData === "boolean" ? body.migrateTenantData : null,
      data: await send(body),
    };
  } catch (error) {
    if (!isGstTenantConfirmationError(error)) throw error;
    if (typeof askDecision !== "function") throw error;

    // Backend fallback: if a page did not supply the current GSTIN or the
    // company changed in another session, use the backend's authoritative
    // confirmation payload and retry once with an explicit choice.
    if (typeof body.migrateTenantData === "boolean") throw error;

    const decision = await askDecision(error.details || {});
    if (decision === null) {
      return { cancelled: true, migrateTenantData: null, data: null };
    }

    return {
      cancelled: false,
      migrateTenantData: Boolean(decision),
      data: await send({ ...body, migrateTenantData: Boolean(decision) }),
    };
  }
}

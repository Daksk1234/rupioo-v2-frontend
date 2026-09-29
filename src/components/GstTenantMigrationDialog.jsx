import React, { useCallback, useRef, useState } from "react";

const clean = (value) => String(value ?? "").trim();

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "150px minmax(0, 1fr)",
  gap: 10,
  alignItems: "start",
  fontSize: 13,
};

export function GstTenantMigrationDialog({ details, onChoice }) {
  if (!details) return null;

  const oldGstin = clean(details.oldGstin || details.oldTenantKey) || "—";
  const newGstin = clean(details.newGstin || details.newTenantKey) || "—";
  const oldTenantKey = clean(details.oldTenantKey) || "—";
  const newTenantKey = clean(details.newTenantKey || details.newGstin) || "—";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="GST tenant migration confirmation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(15, 23, 42, 0.55)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <section
        style={{
          width: "min(760px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
          background: "var(--panel, #fff)",
          color: "var(--text, #0f172a)",
          borderRadius: 18,
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#b45309" }}>IMPORTANT GST CHANGE</div>
            <h3 style={{ margin: "5px 0 5px", fontSize: 21 }}>Move all company data to the new GST tenant?</h3>
            <p style={{ margin: 0, color: "var(--muted, #64748b)", lineHeight: 1.55 }}>
              The GST number has changed. Choose what should happen to the company&apos;s tenant identity and existing data.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 8, padding: 14, borderRadius: 12, background: "rgba(148, 163, 184, 0.10)" }}>
          <div style={rowStyle}><strong>Old GSTIN</strong><span style={{ wordBreak: "break-all" }}>{oldGstin}</span></div>
          <div style={rowStyle}><strong>New GSTIN</strong><span style={{ wordBreak: "break-all" }}>{newGstin}</span></div>
          <div style={rowStyle}><strong>Current tenantKey</strong><span style={{ wordBreak: "break-all" }}>{oldTenantKey}</span></div>
          <div style={rowStyle}><strong>New tenantKey</strong><span style={{ wordBreak: "break-all" }}>{newTenantKey}</span></div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(22, 163, 74, .35)", background: "rgba(22, 163, 74, .07)" }}>
            <strong>YES — Move all related data</strong>
            <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.5, color: "var(--muted, #475569)" }}>
              Change the tenantKey to the new GST number and migrate the company&apos;s MASTER data plus every financial-year database to the new tenantKey.
            </div>
          </div>
          <div style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(37, 99, 235, .30)", background: "rgba(37, 99, 235, .06)" }}>
            <strong>NO — Change GST only</strong>
            <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.5, color: "var(--muted, #475569)" }}>
              Save the new GST number but keep the existing tenantKey and all current data locations unchanged.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 9 }}>
          <button type="button" className="btn ghost" onClick={() => onChoice(null)}>Cancel Save</button>
          <button type="button" className="btn ghost" onClick={() => onChoice(false)}>No — Keep Old Tenant</button>
          <button type="button" className="btn primary" onClick={() => onChoice(true)}>Yes — Move All Data</button>
        </div>
      </section>
    </div>
  );
}

export function useGstTenantMigrationDialog() {
  const [details, setDetails] = useState(null);
  const resolverRef = useRef(null);

  const askGstTenantMigration = useCallback((nextDetails = {}) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setDetails(nextDetails || {});
  }), []);

  const choose = useCallback((value) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDetails(null);
    resolve?.(value);
  }, []);

  return {
    askGstTenantMigration,
    gstTenantMigrationDialog: details ? <GstTenantMigrationDialog details={details} onChoice={choose} /> : null,
  };
}

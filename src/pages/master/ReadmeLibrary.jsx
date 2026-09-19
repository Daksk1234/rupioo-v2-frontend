import React, { useMemo, useState } from "react";

const readmeModules = import.meta.glob("../../docs/readme-history/*.{md,txt}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})__(.+?)__(.+?)\.(md|txt)$/i;

const clean = (value = "") =>
  String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseDoc = ([path, content]) => {
  const fileName = path.split("/").pop() || path;
  const match = fileName.match(DATE_RE);

  const date = match ? `${match[1]}-${match[2]}-${match[3]}` : "";
  const moduleName = match ? clean(match[4]) : "General";
  const titleFromName = match
    ? clean(match[5])
    : clean(fileName.replace(/\.(md|txt)$/i, ""));

  const heading = String(content || "")
    .split(/\r?\n/)
    .find((line) => /^#\s+/.test(line.trim()));

  const title = heading ? heading.replace(/^#\s+/, "").trim() : titleFromName;

  return {
    id: fileName,
    path,
    fileName,
    date,
    moduleName,
    title,
    content: String(content || ""),
  };
};

const formatDate = (value) => {
  if (!value) return "Undated";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const downloadText = (doc) => {
  const blob = new Blob([doc.content], {
    type: doc.fileName.toLowerCase().endsWith(".md")
      ? "text/markdown;charset=utf-8"
      : "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const getHeadings = (content = "") =>
  content
    .split(/\r?\n/)
    .filter((line) => /^#{1,4}\s+/.test(line.trim()))
    .slice(0, 30)
    .map((line, index) => ({
      id: index,
      level: (line.match(/^#+/) || ["#"])[0].length,
      text: line.replace(/^#{1,4}\s+/, "").trim(),
    }));

export default function ReadmeLibrary() {
  const allDocs = useMemo(() => {
    return Object.entries(readmeModules)
      .map(parseDoc)
      .sort((a, b) => {
        if (a.date && b.date) return b.date.localeCompare(a.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return a.title.localeCompare(b.title);
      });
  }, []);

  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(allDocs[0]?.id || "");
  const [copied, setCopied] = useState(false);

  const modules = useMemo(
    () => ["ALL", ...Array.from(new Set(allDocs.map((d) => d.moduleName))).sort()],
    [allDocs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allDocs.filter((doc) => {
      const moduleOk = moduleFilter === "ALL" || doc.moduleName === moduleFilter;
      if (!moduleOk) return false;
      if (!q) return true;
      return `${doc.title} ${doc.moduleName} ${doc.fileName} ${doc.content}`
        .toLowerCase()
        .includes(q);
    });
  }, [allDocs, moduleFilter, query]);

  const selected =
    allDocs.find((doc) => doc.id === selectedId) || filtered[0] || allDocs[0];
  const latestId = allDocs[0]?.id;
  const headings = useMemo(
    () => getHeadings(selected?.content || ""),
    [selected?.content],
  );

  const copyDoc = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>MASTER • DEVELOPMENT RECORDS</div>
          <h1 style={styles.h1}>README & Change History</h1>
          <p style={styles.sub}>
            Permanent reference library for previous Rupio V2 changes, setup notes,
            migrations and implementation instructions.
          </p>
        </div>
        <div style={styles.countBox}>
          <strong style={styles.count}>{allDocs.length}</strong>
          <span style={styles.countLabel}>Archived documents</span>
        </div>
      </div>

      <div style={styles.toolbar}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, module, filename or document text..."
          style={styles.search}
        />
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          style={styles.select}
        >
          {modules.map((m) => (
            <option key={m} value={m}>
              {m === "ALL" ? "All modules" : m}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.grid}>
        <aside style={styles.listPane}>
          <div style={styles.listHeader}>
            <span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
            <span style={styles.muted}>Newest first</span>
          </div>

          <div style={styles.listScroller}>
            {filtered.length === 0 ? (
              <div style={styles.empty}>No README matches your search.</div>
            ) : (
              filtered.map((doc) => {
                const active = selected?.id === doc.id;
                return (
                  <button
                    type="button"
                    key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    style={{
                      ...styles.docButton,
                      ...(active ? styles.docButtonActive : {}),
                    }}
                  >
                    <div style={styles.docTopline}>
                      <span style={styles.moduleBadge}>{doc.moduleName}</span>
                      {doc.id === latestId && <span style={styles.latestBadge}>LATEST</span>}
                    </div>
                    <div style={styles.docTitle}>{doc.title}</div>
                    <div style={styles.docMeta}>{formatDate(doc.date)} • {doc.fileName}</div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section style={styles.viewer}>
          {!selected ? (
            <div style={styles.empty}>No README documents are archived yet.</div>
          ) : (
            <>
              <div style={styles.viewerHead}>
                <div>
                  <div style={styles.docTopline}>
                    <span style={styles.moduleBadge}>{selected.moduleName}</span>
                    {selected.id === latestId && <span style={styles.latestBadge}>LATEST</span>}
                  </div>
                  <h2 style={styles.viewerTitle}>{selected.title}</h2>
                  <div style={styles.docMeta}>
                    {formatDate(selected.date)} • {selected.fileName}
                  </div>
                </div>
                <div style={styles.actions}>
                  <button type="button" onClick={copyDoc} style={styles.secondaryButton}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText(selected)}
                    style={styles.primaryButton}
                  >
                    Download
                  </button>
                </div>
              </div>

              {headings.length > 0 && (
                <details style={styles.outline}>
                  <summary style={styles.outlineSummary}>Document outline</summary>
                  <div style={styles.outlineBody}>
                    {headings.map((h) => (
                      <div
                        key={`${h.id}-${h.text}`}
                        style={{ ...styles.outlineLine, paddingLeft: (h.level - 1) * 14 }}
                      >
                        {h.text}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <pre style={styles.pre}>{selected.content}</pre>
            </>
          )}
        </section>
      </div>

      <div style={styles.footerNote}>
        Archive rule: never overwrite an old README. Add the next README as a new file in
        <code style={styles.inlineCode}> src/docs/readme-history/ </code>
        using the filename format
        <code style={styles.inlineCode}> YYYY-MM-DD__MODULE__TITLE.md</code>. It will appear
        here automatically on the next build.
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: 20,
    maxWidth: 1500,
    margin: "0 auto",
    color: "#172033",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: ".11em",
    color: "#64748b",
  },
  h1: { margin: "5px 0 6px", fontSize: 28, lineHeight: 1.2 },
  sub: { margin: 0, maxWidth: 820, color: "#64748b", fontSize: 14 },
  countBox: {
    minWidth: 150,
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 12,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
  },
  count: { fontSize: 24 },
  countLabel: { fontSize: 12, color: "#64748b" },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) minmax(180px, 260px)",
    gap: 10,
    marginBottom: 12,
  },
  search: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    padding: "10px 12px",
    outline: "none",
    background: "#fff",
  },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    padding: "10px 12px",
    background: "#fff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(270px, 360px) minmax(0, 1fr)",
    gap: 12,
    alignItems: "stretch",
  },
  listPane: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    overflow: "hidden",
    minHeight: 650,
  },
  listHeader: {
    padding: "10px 12px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: 700,
  },
  muted: { color: "#94a3b8", fontWeight: 500 },
  listScroller: { maxHeight: "72vh", overflow: "auto" },
  docButton: {
    width: "100%",
    display: "block",
    textAlign: "left",
    border: 0,
    borderBottom: "1px solid #eef2f7",
    background: "#fff",
    padding: 12,
    cursor: "pointer",
    color: "inherit",
  },
  docButtonActive: { background: "#eff6ff", boxShadow: "inset 3px 0 #2563eb" },
  docTopline: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" },
  moduleBadge: {
    background: "#eef2ff",
    color: "#4338ca",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  latestBadge: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "3px 7px",
    fontSize: 10,
    fontWeight: 900,
  },
  docTitle: { marginTop: 7, fontWeight: 800, lineHeight: 1.25 },
  docMeta: { marginTop: 5, color: "#64748b", fontSize: 11, wordBreak: "break-word" },
  viewer: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fff",
    padding: 16,
    minWidth: 0,
    minHeight: 650,
  },
  viewerHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  viewerTitle: { margin: "8px 0 0", fontSize: 22 },
  actions: { display: "flex", gap: 8 },
  primaryButton: {
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  outline: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    marginBottom: 12,
    background: "#f8fafc",
  },
  outlineSummary: { cursor: "pointer", padding: "8px 10px", fontWeight: 800, fontSize: 12 },
  outlineBody: { padding: "0 10px 10px" },
  outlineLine: { fontSize: 11, color: "#475569", lineHeight: 1.6 },
  pre: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.58,
    color: "#1e293b",
  },
  empty: { padding: 20, color: "#64748b", textAlign: "center" },
  footerNote: {
    marginTop: 12,
    padding: 12,
    border: "1px dashed #cbd5e1",
    borderRadius: 10,
    background: "#f8fafc",
    color: "#475569",
    fontSize: 12,
  },
  inlineCode: { background: "#e2e8f0", padding: "2px 4px", borderRadius: 4 },
};

import React, { useEffect } from "react";
import { Columns3, Eye, EyeOff, RotateCcw, Search, Sparkles } from "lucide-react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import "../column-studio.css";
import { getUser } from "../lib/api.js";

const NORMALIZE = (text) => String(text || "").replace(/\s+/g, " ").trim();
const essential = /(^#|^no\.?$|invoice|voucher|document|^date$|party|customer|supplier|name|status|total|amount|balance|^actions?$|^select$)/i;

function columnDetails(table) {
  const rows = [...table.querySelectorAll(":scope > thead > tr")];
  if (rows.length !== 1) return null; // Never break merged/multi-level headers.
  const headers = [...rows[0].children];
  if (headers.length < 3 || headers.some((th) => th.colSpan > 1 || th.rowSpan > 1)) return null;
  return headers.map((th, index) => ({
    key: `${index}:${NORMALIZE(th.textContent)}`,
    label: NORMALIZE(th.textContent) || (th.querySelector('input[type="checkbox"]') ? "Select" : `Column ${index + 1}`),
    index,
  }));
}

function load(key) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) || "null");
    return Array.isArray(raw) ? new Set(raw) : null;
  } catch { return null; }
}

function save(key, visible) {
  try { window.localStorage.setItem(key, JSON.stringify([...visible])); } catch { /* private browsing */ }
}

function apply(table, columns, visible) {
  if (!table.isConnected) return;
  const rows = table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr");
  for (const row of rows) {
    const cells = [...row.children].filter((node) => node.matches("th,td"));
    // Empty-state or summary rows using a spanning cell must remain readable.
    if (cells.some((cell) => cell.colSpan > 1 || cell.rowSpan > 1)) continue;
    if (cells.length !== columns.length) continue;
    columns.forEach((col) => { cells[col.index].style.display = visible.has(col.key) ? "" : "none"; });
  }
  const colgroup = table.querySelector(":scope > colgroup");
  if (colgroup && colgroup.children.length === columns.length) {
    columns.forEach((col) => { colgroup.children[col.index].style.display = visible.has(col.key) ? "" : "none"; });
  }
}

function Controls({ columns, initial, persistKey, onChange }) {
  // The surrounding page owns the table. This small React island owns only its toolbar.
  const [visible, setVisible] = React.useState(() => new Set(initial));
  const [opened, setOpened] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [position, setPosition] = React.useState({ left: 10, top: 10 });
  const triggerRef = React.useRef(null);
  React.useEffect(() => {
    if (!opened) return undefined;
    const closeOutside = (event) => {
      if (!event.target.closest?.(".v2ColumnStudio,.v2ColumnPanel")) setOpened(false);
    };
    const closeOnScroll = (event) => {
      if (!event.target.closest?.(".v2ColumnOptions")) setOpened(false);
    };
    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("resize", closeOnScroll);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("resize", closeOnScroll);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [opened]);
  const update = (next) => {
    if (!next.size) return; // Never let a user accidentally hide the entire table.
    setVisible(new Set(next));
    save(persistKey, next);
    onChange(next);
  };
  const matched = columns.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="v2ColumnStudio">
    <button ref={triggerRef} type="button" className="v2ColumnTrigger" aria-expanded={opened} onClick={() => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (bounds) setPosition({
        left: Math.max(10, Math.min(bounds.right - 370, window.innerWidth - 380)),
        top: bounds.bottom + 8 + 355 > window.innerHeight ? Math.max(10, bounds.top - 363) : bounds.bottom + 8,
      });
      setOpened((x) => !x);
    }}>
      <Columns3 size={17}/><span>COLUMNS</span><b>{visible.size}/{columns.length}</b>
    </button>
    {opened && createPortal(<div className="v2ColumnPanel" style={{ left: position.left, top: position.top }} role="dialog" aria-label="Choose table columns">
      <div className="v2ColumnPanelTop"><div className="v2ColumnPanelTitle"><Sparkles size={19}/><div><strong>Column Studio</strong><small>Choose your table view. Saved on this device.</small></div></div><button type="button" aria-label="Close column studio" onClick={() => setOpened(false)}>×</button></div>
      <label className="v2ColumnSearch"><Search size={16}/><input value={query} placeholder="Search columns..." onChange={(e) => setQuery(e.target.value)}/></label>
      <div className="v2ColumnActions">
        <button type="button" onClick={() => update(new Set(columns.map((c) => c.key)))}><Eye size={15}/> All</button>
        <button type="button" onClick={() => update(new Set(columns.filter((c) => essential.test(c.label)).map((c) => c.key).concat(columns[0].key)))}><Sparkles size={15}/> Focus</button>
        <button type="button" onClick={() => { try { window.localStorage.removeItem(persistKey); } catch {} update(new Set(columns.map((c) => c.key))); }}><RotateCcw size={15}/> Reset</button>
      </div>
      <div className="v2ColumnOptions">{matched.map((c) => <label key={c.key} className="v2ColumnOption"><input type="checkbox" checked={visible.has(c.key)} onChange={(e) => { const next = new Set(visible); if (e.target.checked) next.add(c.key); else next.delete(c.key); update(next); }}/><span>{c.label}</span>{visible.has(c.key) ? <Eye size={14}/> : <EyeOff size={14}/>}</label>)}</div>
      <small className="v2ColumnFoot">This changes only the displayed columns. Your database, exports and invoice PDFs are unchanged.</small>
    </div>, document.body)}
  </div>;
}

export default function ColumnStudio({ routeKey = "" }) {
  useEffect(() => {
    const host = document.querySelector(".topNavContent");
    if (!host) return undefined;
    const created = new Map();
    const user = getUser();
    const userScope = `${user?.tenantKey || "tenant"}:${user?.id || user?._id || user?.sub || "user"}`;
    const scan = () => {
      for (const table of host.querySelectorAll("table")) {
        const columns = columnDetails(table);
        if (!columns || table.closest("[data-column-studio-skip]")) continue;
        const signature = `${table.className || "table"}:${columns.map((col) => col.label).join("|")}`;
        const persistKey = `rupio:v2:columns:${userScope}:${routeKey}:${signature}`;
        let entry = created.get(table);
        if (entry && entry.signature !== signature) {
          entry.root.unmount(); entry.slot.remove(); created.delete(table); entry = null;
        }
        if (!entry) {
          const slot = document.createElement("div");
          slot.className = "v2ColumnStudioSlot";
          table.parentElement?.insertBefore(slot, table);
          const root = createRoot(slot);
          const saved = load(persistKey);
          const available = new Set(columns.map((col) => col.key));
          const initial = saved ? new Set([...saved].filter((v) => available.has(v))) : new Set(available);
          if (!initial.size) initial.add(columns[0].key);
          entry = { slot, root, signature, columns, visible: initial };
          created.set(table, entry);
          root.render(<Controls columns={columns} initial={initial} persistKey={persistKey} onChange={(next) => { entry.visible = next; apply(table, columns, next); }}/>)
        }
        apply(table, entry.columns, entry.visible);
      }
      for (const [table, entry] of created) {
        if (!table.isConnected) { entry.root.unmount(); entry.slot.remove(); created.delete(table); }
      }
    };
    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const entry of created.values()) { entry.root.unmount(); entry.slot.remove(); }
      created.clear();
    };
  }, [routeKey]);
  return null;
}

import React, { useEffect, useState } from 'react';
import { LAYOUT_GROUPS, cleanLayout, layoutVariables, layoutStorageKey } from '../lib/salesInvoiceLayout.js';
import { getUser } from '../lib/api.js';
import '../sales-invoice-layout.css';

const EVENT = 'rupio-sales-invoice-layout';
function read(key) {
  try { return cleanLayout(JSON.parse(localStorage.getItem(key) || '{}')); } catch { return {}; }
}
export default function SalesInvoiceLayout({ children }) {
  const key = layoutStorageKey(getUser());
  const [saved, setSaved] = useState(() => read(key));
  const [draft, setDraft] = useState(saved);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setSaved(read(key)); setOpen(false);
    const sync = (event) => {
      if ((event.type === 'storage' && event.key === key) || event.detail?.key === key) setSaved(read(key));
    };
    window.addEventListener('storage', sync); window.addEventListener(EVENT, sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(EVENT, sync); };
  }, [key]);
  const active = open ? draft : saved;
  const customFields = LAYOUT_GROUPS.slice(1).some(group => group.fields.some(([id]) => active[id] != null));
  const customFooter = active.detailsBox != null || active.totalsBox != null;
  const invalid = LAYOUT_GROUPS.some(group => group.fields.some(([id]) => active[id] != null && (!Number.isFinite(active[id]) || active[id] < group.min || active[id] > group.max)));
  const save = () => {
    const value = cleanLayout(draft);
    try {
      localStorage.setItem(key, JSON.stringify(value)); setSaved(value); setOpen(false);
      setMessage('Layout saved for this user in this browser.');
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }));
    } catch { setMessage('Could not save. Browser storage is unavailable. Your preview is still open.'); }
  };
  return <div className={`salesInvoiceLayout ${customFields ? 'siCustomFields' : ''} ${customFooter ? 'siCustomFooter' : ''}`} style={layoutVariables(active)}>
    <div className="siLayoutToolbar">
      <button type="button" className="btn ghost" aria-expanded={open} onClick={() => { if (open) setOpen(false); else { setDraft(saved); setMessage(''); setOpen(true); } }}> {open ? 'Cancel layout changes' : 'Arrange boxes / widths'} </button>
      <span role="status">{message}</span>
    </div>
    {open && <section className="siLayoutEditor" aria-label="Invoice layout settings">
      <div><strong>Arrange your Sales Invoice</strong><p>Set main box widths as a percentage of the available space, and field widths in pixels. Leave blank for Auto. Changes preview below; fields wrap when a row is full. Product widths apply to every product row.</p></div>
      {LAYOUT_GROUPS.map(group => <details key={group.title} open={group.unit === '%'}>
        <summary>{group.title} <small>({group.unit})</small></summary>
        <div className="siWidthGrid">{group.fields.map(([id, label]) => <label key={id}><span>{label}</span><div><input type="number" min={group.min} max={group.max} step="1" placeholder="Auto" value={draft[id] ?? ''} aria-label={`${label} width in ${group.unit}`} onChange={event => { const value = event.target.value; setDraft(old => { const next = { ...old }; if (value === '') delete next[id]; else next[id] = Number(value); return next; }); }} /><span>{group.unit}</span><button type="button" title={`Reset ${label} width to Auto`} onClick={() => setDraft(old => { const next = { ...old }; delete next[id]; return next; })}>Auto</button></div></label>)}</div>
      </details>)}
      {invalid && <p role="alert">Enter 25–100% for main boxes and 80–1200 px for fields, or leave blank for Auto.</p>}
      <div className="siLayoutActions"><button type="button" className="btn ghost" onClick={() => setDraft({})}>Reset all to Auto</button><button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn primary" disabled={invalid} onClick={save}>Save layout</button></div>
      <small>Saved separately for this user in this browser. Narrow screens cap widths to fit. Invoice values are not changed.</small>
    </section>}
    {children}
  </div>;
}

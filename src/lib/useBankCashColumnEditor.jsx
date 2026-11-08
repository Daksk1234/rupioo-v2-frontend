import React, {useCallback, useRef, useState} from 'react';
import {api} from './api.js';
import {mayEditPostedVoucher} from './voucherEditPermissions.js';
import {isBookSuperadmin,bookCorrectionSourceKey} from './superadminBookCorrection.js';
import '../transaction-books.css';

// A bank/cash book contains journal projections as well as direct DMS vouchers.
// Only a direct voucher may be changed here, and all changes go through the
// EXISTING audited PUT /transactions/vouchers/:kind/:id/edit endpoint.
export function directVoucherRow(row, channel, user) {
  let kind = '', id = '';
  if (channel === 'bank') {
    const match = /^(RCT|PAY):(.+)$/.exec(String(row?._listId || ''));
    if (match) { kind = match[1] === 'RCT' ? 'receipts' : 'payments'; id = match[2]; }
  } else {
    kind = String(row?.voucherKind || '');
    id = String(row?.voucherId || '');
  }
  if (!id || row?._directVoucherEditable === false || !['receipts', 'payments'].includes(kind) || !mayEditPostedVoucher(user, kind, channel)) return null;
  return {kind, id, key: `${kind}:${id}`};
}

const isoDate = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';
const numericAmount = value => Number(value || 0);
const partyValue = (party) => `${party.type}::${party.id}`;
const partyLabel = party => `${party.name} • ${party.type}${party.identifier ? ` • ${party.identifier}` : ''}`;

export function useBankCashColumnEditor({channel, user, rows, financialYear, onSaved, setError, setMessage}) {
  const isSuperadmin=isBookSuperadmin(user);
  const beginSequence = useRef(0);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [parties, setParties] = useState([]);

  const toggleColumn = useCallback((column) => {
    if (editing || loading) return;
    setSelectedColumns(previous => previous.includes(column)
      ? previous.filter(k => k !== column) : [...previous, column]);
  }, [editing, loading]);

  const cancel = useCallback(() => {
    beginSequence.current++;
    setEditing(false); setSelectedColumns([]); setDrafts({}); setLoading(false);
  }, []);

  const header = (column, label) => (
    <button type="button" className={`bookColumnToggle${selectedColumns.includes(column) ? ' active' : ''}`}
      onClick={() => toggleColumn(column)} disabled={editing || loading}
      aria-pressed={selectedColumns.includes(column)}
      title="Select this column for inline editing (multiple columns can be selected)">
      {selectedColumns.includes(column) ? '✓ ' : ''}{label}
    </button>
  );

  const begin = async (overrideColumns=null) => {
    const chosenColumns=Array.isArray(overrideColumns)?overrideColumns:selectedColumns;
    if (!chosenColumns.length) return setError('Click one or more editable column headings, then select Edit.');
    const editable = isSuperadmin
      ? rows.map(r=>({kind:'superadmin',id:bookCorrectionSourceKey(r,channel),key:bookCorrectionSourceKey(r,channel)})).filter(x=>x.id&&x.id!=='CB::')
      : rows.map(r => directVoucherRow(r,channel,user)).filter(Boolean);
    if (!editable.length) return setError('No editable transaction rows are displayed. Expand a month that contains entries.');
    const request=++beginSequence.current;
    setLoading(true); setError('');
    try {
      if(isSuperadmin){
        // Book-level corrections are available for EVERY posted source row,
        // including cashier OTP receipts, bank-statement lines and contras.
        // The original source is preserved; the backend writes a balanced,
        // audited adjustment to the company/party journal.
        if(chosenColumns.includes('party')){
          const data=await api('/transactions/voucher-party-options');
          if(request!==beginSequence.current)return;
          setParties(Array.isArray(data)?data:(data.items||[]));
        }
        const result=Object.fromEntries(rows.map(r=>{
          const key=bookCorrectionSourceKey(r,channel);
          return [key,{kind:'superadmin',id:key,sourceKey:key,
            date:isoDate(r.date),debit:String(r.debit??0),credit:String(r.credit??0),
            remarks:String(r.remarks||r.particular||''),
            partyName:String(r.partyNameDisplay||r.matchedPartyName||r.partyName||''),
            partyGlobalId:'',partyType:'',partyChangeKey:'__UNCHANGED__',
            original:{date:isoDate(r.date),debit:Number(r.debit||0),credit:Number(r.credit||0),
              remarks:String(r.remarks||r.particular||''),partyName:String(r.partyNameDisplay||r.matchedPartyName||r.partyName||'')},
          }];
        }));
        if(request!==beginSequence.current)return;
        setDrafts(result);setEditing(true);return;
      }
      const unique = [...new Map(editable.map(x => [x.key,x])).values()];
      const result = await Promise.all(unique.map(async x => {
        const d = await api(`/transactions/vouchers/${x.kind}/${encodeURIComponent(x.id)}/edit?financialYear=${encodeURIComponent(financialYear)}`);
        const v = d.voucher;
        return [x.key, {kind:x.kind,id:x.id,voucher:v,
          sourceYear:d.financialYear || financialYear,
          date:isoDate(v.date),amount:String(v.amount ?? ''),
          remarks:String(v.remarks || ''),
          partyGlobalId:String((x.kind === 'receipts' ? v.customerGlobalId : v.partyGlobalId) || ''),
          partyType:String(v.partyType || '')}];
      }));
      if (chosenColumns.includes('party')) {
        const data = await api('/transactions/voucher-party-options');
        setParties(Array.isArray(data) ? data : (data.items || []));
      }
      if(request!==beginSequence.current)return;
      setDrafts(Object.fromEntries(result));
      setEditing(true);
    } catch (e) {
      if(request===beginSequence.current)setError(`Could not start safe inline editing: ${e.message}. No changes have been made.`);
    } finally { if(request===beginSequence.current)setLoading(false); }
  };

  const change = (key,field,value) => setDrafts(previous => ({
    ...previous,[key]: {...previous[key], [field]: value}
  }));

  const cell = (row, field, fallback) => {
    if (!editing || !selectedColumns.includes(field)) return fallback;
    const identity = isSuperadmin
      ? {key:bookCorrectionSourceKey(row,channel)} : directVoucherRow(row,channel,user);
    const item = identity && drafts[identity.key];
    if (!item) return <span>{fallback}</span>;
    if(isSuperadmin){
      if(field==='date')return <input type="date" className="bookInlineInput" value={item.date}
        onChange={e=>change(identity.key,'date',e.target.value)}/>;
      if(field==='remarks')return <input type="text" className="bookInlineInput bookInlineRemarks" value={item.remarks}
        onChange={e=>change(identity.key,'remarks',e.target.value)}/>;
      if(field==='party')return <select className="bookInlineInput" value={item.partyChangeKey||'__UNCHANGED__'}
        title="Select an actual party. Both the account movement and party ledger are corrected in one audited journal."
        onChange={e=>{const value=e.target.value;const selected=parties.find(p=>partyValue(p)===value);
          setDrafts(previous=>({...previous,[identity.key]:{...previous[identity.key],
            partyChangeKey:value,partyGlobalId:selected?String(selected.id):'',
            partyType:selected?String(selected.type):'',
            partyName:selected?String(selected.name):previous[identity.key].original.partyName,
          }}));}}>
        <option value="__UNCHANGED__">{item.original.partyName||'Original party'} (keep original)</option>
        {parties.map(p=><option key={partyValue(p)} value={partyValue(p)}>{partyLabel(p)}</option>)}
      </select>;
      if(field==='debit'||field==='credit')return <input type="number" min="0" step="0.01"
        className="bookInlineInput" value={item[field]} onChange={e=>change(identity.key,field,e.target.value)}/>;
      return fallback;
    }
    if (field === 'debit' && item.kind !== 'payments' || field === 'credit' && item.kind !== 'receipts')
      return <span title="Cannot switch a posted receipt into a payment (or vice versa). Void and re-create it using the correct type.">{fallback}</span>;
    if (field === 'party') {
      const value = `${item.partyType}::${item.partyGlobalId}`;
      return <select className="bookInlineInput" aria-label={`Party for ${row.transactionId}`} value={value}
        onChange={e => {const p=parties.find(x=>partyValue(x)===e.target.value); if(p){change(identity.key,'partyGlobalId',String(p.id));change(identity.key,'partyType',String(p.type));}}}>
        {!parties.some(p=>partyValue(p)===value) && <option value={value}>{item.voucher.partyNameSnapshot || 'Current party'} (current)</option>}
        {parties.map(p=><option key={partyValue(p)} value={partyValue(p)}>{partyLabel(p)}</option>)}
      </select>;
    }
    if (field === 'date') return <input type="date" aria-label={`Date for ${row.transactionId}`}
      className="bookInlineInput" value={item.date} onChange={e=>change(identity.key,'date',e.target.value)}/>;
    if (field === 'remarks') return <input type="text" aria-label={`Particulars for ${row.transactionId}`}
      className="bookInlineInput bookInlineRemarks" value={item.remarks} onChange={e=>change(identity.key,'remarks',e.target.value)}/>;
    if (field === 'debit' || field === 'credit') return <input type="number" min="0.01" step="0.01" aria-label={`${field} amount for ${row.transactionId}`}
      className="bookInlineInput" value={item.amount} onChange={e=>change(identity.key,'amount',e.target.value)}/>;
    return fallback;
  };

  const changed = (item) => {
    if(item.kind==='superadmin'){
      const o=item.original;
      return item.date!==o.date||String(item.remarks)!==o.remarks||item.partyChangeKey!=='__UNCHANGED__'||
        Math.abs(Number(item.debit)-o.debit)>0.000001||Math.abs(Number(item.credit)-o.credit)>0.000001;
    }
    const old = item.voucher;
    const part = item.kind === 'receipts' ? old.customerGlobalId : old.partyGlobalId;
    const amountBefore = numericAmount(old.amount), amountAfter = numericAmount(item.amount);
    return isoDate(old.date) !== item.date || String(old.remarks || '') !== item.remarks
      || String(part || '') !== item.partyGlobalId || String(old.partyType || '') !== item.partyType
      || Math.abs(amountBefore-amountAfter)>0.000001;
  };
  const changedCount = Object.values(drafts).filter(changed).length;

  const save = async () => {
    const updates = Object.entries(drafts).filter(([,d])=>changed(d));
    if (!updates.length) {setMessage('No cell values were changed.');cancel();return;}
    const reason=window.prompt(`Reason for correcting ${updates.length} ${isSuperadmin?'BANK/CASH book entries':'posted vouchers'} (minimum five characters):`);
    if(reason===null)return;
    if(reason.trim().length<5)return setError('A reason of at least five characters is required for the accounting audit.');
    for (const [,d] of updates) {
      if(d.kind==='superadmin'){
        const debit=Number(d.debit),credit=Number(d.credit);
        if(!d.date||!Number.isFinite(debit)||!Number.isFinite(credit)||debit<0||credit<0||
          (debit<=0&&credit<=0)||(debit>0&&credit>0)||
          Math.abs(Math.round(debit*100)-debit*100)>1e-6||Math.abs(Math.round(credit*100)-credit*100)>1e-6)
          return setError('For every edited row, enter one positive Debit OR Credit (up to two decimals).');
        continue;
      }
      if (!d.date) return setError('Enter a valid date for every changed voucher.');
      if (!d.partyGlobalId || !d.partyType) return setError('Select a valid party for every changed voucher.');
      if (!Number.isFinite(Number(d.amount)) || Number(d.amount)<=0 || !/^\d+(?:\.\d{1,2})?$/.test(String(d.amount)))
        return setError('Debit/Credit amount must be positive and have at most two decimals.');
    }
    if (!window.confirm(isSuperadmin
      ?`Save ${updates.length} book corrections? The active BANK/CASH balance and accounting journal will be adjusted, with original invoice/OTP/import evidence retained for audit.`
      :`Save ${updates.length} corrected voucher(s) and their posted journals? Every correction will be audited. Calculated balances will be refreshed.`))return;
    setLoading(true);setError('');
    let saved=0;const failures=[];
    // Existing audited endpoint uses per-voucher optimistic versions and a
    // MongoDB transaction. Never retry a successful voucher if a later one
    // fails: remove it from the local queue as soon as its update succeeds.
    for(const [key,d] of updates){
      try{
        if(d.kind==='superadmin'){
          await api('/transactions/book-corrections',{method:'POST',body:JSON.stringify({
            book:channel.toUpperCase(),financialYear,sourceKey:d.sourceKey,date:d.date,
            debit:Number(d.debit),credit:Number(d.credit),remarks:d.remarks,
            partyName:d.partyName,partyGlobalId:d.partyGlobalId,partyType:d.partyType,
            reason:reason.trim(),deleted:false,
          })});
          saved++;
          setDrafts(previous=>{const next={...previous};delete next[key];return next;});
          continue;
        }
        const v=d.voucher;
        await api(`/transactions/vouchers/${d.kind}/${encodeURIComponent(d.id)}/edit`,{
          method:'PUT',body:JSON.stringify({
            financialYear:d.sourceYear,version:v.updatedAt,
            voucherNo:d.kind==='receipts'?v.receiptNo:v.paymentNo,
            date:d.date,partyGlobalId:d.partyGlobalId,partyType:d.partyType,
            mode:v.mode,bankAccountId:v.mode==='CASH'?'':v.bankAccountId,
            amount:Number(d.amount),reference:v.reference||'',remarks:d.remarks,reason:reason.trim(),
          }),
        });
        saved++;
        setDrafts(previous=>{const next={...previous};delete next[key];return next;});
      }catch(e){failures.push(`${d.kind==='superadmin'?d.sourceKey:(d.kind==='receipts'?vNo(d.voucher,'receiptNo'):vNo(d.voucher,'paymentNo'))}: ${e.message}`);}
    }
    setLoading(false);
    if(saved){setMessage(`${saved} ${isSuperadmin?'book correction(s)':'voucher(s)'} saved and audited. BANK/CASH balances refreshed. ${failures.length ? 'Only failed edits remain; successful edits will not be resubmitted.' : ''}`);await onSaved();}
    if(failures.length)setError(`${failures.length} edit(s) failed: ${failures.join(' | ')}`);
    else cancel();
  };

  const beginAll=()=>{const all=['date','party','remarks','debit','credit'];setSelectedColumns(all);return begin(all);};
  return {selectedColumns,editing,loading,changedCount,header,cell,begin,beginAll,save,cancel};
}
function vNo(v,field){return v?.[field] || 'Voucher';}

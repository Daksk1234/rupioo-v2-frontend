import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ChevronLeft,ChevronRight,RefreshCw,Search,Upload,Plus,Pencil,Trash2} from 'lucide-react';
import {api,getUser} from '../lib/api.js';
import {mayEditPostedVoucher,mayDeletePostedVoucher} from '../lib/voucherEditPermissions.js';
import {isBookSuperadmin,bookCorrectionSourceKey,deleteBookRow} from '../lib/superadminBookCorrection.js';
import {useBankCashColumnEditor} from '../lib/useBankCashColumnEditor.jsx';
import {currentFinancialYear,financialYearOptions} from '../lib/financialYear.js';
import {monthBounds} from '../lib/periodFilters.js';
import {exportTransactionList} from '../lib/transactionExport.js';
import {downloadCashbookTemplate} from './CashbookBulkPage.jsx';
import BookMonthAccordion from '../components/BookMonthAccordion.jsx';
import '../transaction-books.css';
import '../profile-bank.css';

const money=n=>`₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date=v=>v?new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}):'—';
const EMPTY={page:1,pages:1,total:0};
const CASH_CATEGORIES={
 CASH_SALE:'Cash Sales (CASH party only)',
 CASH_RECEIPT:'Cash Receipts · DMS',
 CASHIER_RECEIPT:'Cash Receipts · Cashier Day Close',
 CASH_PAYMENT:'Cash Purchases / Payments',
 CONTRA_IN:'Contra · Bank to Cash',
 CONTRA_OUT:'Contra · Cash to Bank',
 CASH_ADJUSTMENT_IN:'Other Posted Cash Receipts',
 CASH_ADJUSTMENT_OUT:'Other Posted Cash Payments',
};
const CATEGORY_OPTIONS=[['ALL','All Cash Movements'],...Object.entries(CASH_CATEGORIES)];

export default function CashbookPage(){
 const navigate=useNavigate(),user=getUser();
 const superadmin=isBookSuperadmin(user);
 const [detectedYears,setDetectedYears]=useState([]);
 const years=[...new Set([...financialYearOptions(user,{count:15}),...detectedYears])].sort((a,b)=>b.localeCompare(a));
 const summarySequence=useRef(0),detailSequence=useRef(0);
 const [fy,setFy]=useState(currentFinancialYear());
 useEffect(()=>{let live=true;api('/transactions/cashbook/financial-years').then(d=>{if(live)setDetectedYears(d.years||[]);}).catch(()=>{});return()=>{live=false;};},[]);
 const [openMonth,setOpenMonth]=useState(''),[category,setCategory]=useState('ALL'),[query,setQuery]=useState(''),[submittedQuery,setSubmittedQuery]=useState('');
 const [months,setMonths]=useState([]),[rows,setRows]=useState([]),[meta,setMeta]=useState(EMPTY);
 const [opening,setOpening]=useState(0),[closing,setClosing]=useState(0),[fyDebit,setFyDebit]=useState(0),[fyCredit,setFyCredit]=useState(0);
 const [journalClosing,setJournalClosing]=useState(0),[issues,setIssues]=useState(0),[priorIssues,setPriorIssues]=useState(0),[manualConflicts,setManualConflicts]=useState(0),[provisional,setProvisional]=useState(false);
 const [categoryTotals,setCategoryTotals]=useState({}),[openingSource,setOpeningSource]=useState(''),[openingNeedsSetup,setOpeningNeedsSetup]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[detailBusy,setDetailBusy]=useState(false);
 const [selected,setSelected]=useState([]);
 const inline=useBankCashColumnEditor({channel:'cash',user,rows,financialYear:fy,
   onSaved:()=>refresh(),setError,setMessage:setNotice});
 useEffect(()=>{inline.cancel();},[fy,category,submittedQuery]);
 const canBulkDelete=superadmin||mayDeletePostedVoucher(user,'payments','cash')||mayDeletePostedVoucher(user,'receipts','cash');
 const canSelectRow=r=>superadmin?Boolean(r.transactionId&&r.transactionType):Boolean(r.voucherId&&r.voucherKind&&mayDeletePostedVoucher(user,r.voucherKind,'cash'));
 const rowKey=r=>superadmin?bookCorrectionSourceKey(r,'cash'):`${r.voucherKind}:${r.voucherId}`;
 const eligibleRows=rows.filter(canSelectRow);
 const selectedRows=eligibleRows.filter(r=>selected.includes(rowKey(r)));
 const allVisibleSelected=eligibleRows.length>0&&eligibleRows.every(r=>selected.includes(rowKey(r)));
 const toggleSelected=(key,checked)=>setSelected(previous=>checked?[...new Set([...previous,key])]:previous.filter(x=>x!==key));
 const toggleVisible=(checked)=>setSelected(checked?eligibleRows.map(rowKey):[]);

 const path=(month='ALL',p=1,limit=50,kind='detail')=>{
  const {startDate,endDate}=monthBounds(fy,month);
  const filtered=kind==='summary'?{category:'ALL',q:''}:{category,q:submittedQuery};
  const type='ALL';
  const source=filtered.category;
  return `/transactions/cashbook?financialYear=${encodeURIComponent(fy)}&fromDate=${startDate}&toDate=${endDate}&type=${type}&category=${encodeURIComponent(source)}&q=${encodeURIComponent(filtered.q)}&page=${p}&limit=${limit}${kind==='summary'?'&groupByMonth=1':''}`;
 };
 const loadSummary=useCallback(async()=>{
  const seq=++summarySequence.current;
  setBusy(true);setError('');
  try{
   const d=await api(path('ALL',1,1,'summary'));
   if(seq!==summarySequence.current)return;
   setMonths(d.monthlySummaries||[]);
   setOpening(Number(d.openingBalance||0));setClosing(Number(d.closingBalance||0));
   setFyDebit(Number(d.periodDebitTotal||0));setFyCredit(Number(d.periodCreditTotal||0));
   setJournalClosing(Number(d.journalClosingBalance||0));setIssues(Number(d.invalidCashVoucherCount||0));
   setPriorIssues(Number(d.rolloverIssues||0));setManualConflicts((d.manualOpeningConflicts||[]).length);setProvisional(Boolean(d.provisional));
   setCategoryTotals(d.categoryTotals||{});setOpeningSource(d.openingSource||'');setOpeningNeedsSetup(Boolean(d.openingNeedsSetup));
  }catch(e){if(seq===summarySequence.current){setError(e.message);setMonths([]);}}
  finally{if(seq===summarySequence.current)setBusy(false);}
 },[fy]);
 const loadMonth=useCallback(async(month,p=1)=>{
  if(!month)return;
  const seq=++detailSequence.current;
  setDetailBusy(true);setError('');
  try{
   const d=await api(path(month,p));
   if(seq!==detailSequence.current)return;
   setRows(d.items||[]);setMeta(d.meta||EMPTY);setSelected([]);
  }catch(e){if(seq===detailSequence.current){setError(e.message);setRows([]);setMeta(EMPTY);}}
  finally{if(seq===detailSequence.current)setDetailBusy(false);}
 },[fy,category,submittedQuery]);
 useEffect(()=>{detailSequence.current++;setOpenMonth('');setRows([]);setSelected([]);setMeta(EMPTY);loadSummary();},[loadSummary]);
 useEffect(()=>{detailSequence.current++;if(openMonth)loadMonth(openMonth,1);},[openMonth,loadMonth]);
 const refresh=async()=>{await loadSummary();if(openMonth)await loadMonth(openMonth,1);};
 const remove=async(row)=>{
  if(superadmin){
    setBusy(true);setError('');
    try{const result=await deleteBookRow({row,channel:'cash',financialYear:fy});
      if(!result.cancelled){setNotice('Entry removed from active CASH book; balanced correction and audit retained.');await refresh();}}
    catch(e){setError(e.message);}finally{setBusy(false);}return;
  }
  const reason=window.prompt(`Void ${row.transactionId}?\nThe original voucher and journal are retained for audit.\nReason (minimum 5 characters):`);
  if(reason===null)return;
  if(reason.trim().length<5){setError('Enter at least five characters for deletion reason');return;}
  setBusy(true);setError('');
  try{
   await api(`/transactions/vouchers/${row.voucherKind}/${encodeURIComponent(row.voucherId)}/void`,{method:'POST',body:JSON.stringify({financialYear:fy,reason:reason.trim()})});
   await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const bulkDelete=async()=>{
  if(superadmin){
    if(!selectedRows.length)return setError('Select entries to remove');
    const reason=window.prompt(`Remove ${selectedRows.length} active CASH entries? Each correction is audited and original documents are retained.
Reason:`);
    if(reason===null)return;
    if(reason.trim().length<5)return setError('Enter a reason of at least 5 characters');
    setBusy(true);setError('');const failures=[];let completed=0;
    for(const r of selectedRows){
      try{await api('/transactions/book-corrections',{method:'POST',body:JSON.stringify({
        book:'CASH',sourceKey:bookCorrectionSourceKey(r,'cash'),financialYear:fy,
        date:String(r.date||'').slice(0,10),deleted:true,debit:0,credit:0,
        remarks:r.remarks||r.particular||'',partyName:r.partyName||'',reason:reason.trim(),
      })});completed++;}
      catch(e){failures.push(`${r.transactionId}: ${e.message}`);}
    }
    setBusy(false);setSelected([]);setNotice(`${completed} entries removed from active CASH book; originals and audit retained.`);
    if(failures.length)setError(`${failures.length} failed: ${failures.join(' | ')}`);
    await refresh();return;
  }
  const chosen=[...new Map(selectedRows.map(row=>[rowKey(row),{kind:row.voucherKind,id:row.voucherId}])).values()];
  if(!chosen.length){setError('Select at least one eligible Cashbook voucher');return;}
  if(!window.confirm(`Void ${chosen.length} selected cash transaction(s)?\nThis also voids their posted accounting journal entries. Source vouchers remain in the audit trail. Continue?`))return;
  const reason=window.prompt(`Reason for voiding ${chosen.length} cash transaction(s) (minimum 5 characters):`);
  if(reason===null)return;
  if(reason.trim().length<5){setError('Enter at least five characters for the deletion reason');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const result=await api('/transactions/cashbook/bulk-void',{
    method:'POST',body:JSON.stringify({financialYear:fy,reason:reason.trim(),items:chosen})
   });
   setSelected([]);
   setNotice(`${result.voided??chosen.length} Cashbook transaction(s) voided; audit entries retained.`);
   await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const exportRows=async(format,printWindow)=>{
  setError('');try{
   const all=[];let pages=1;
   for(let p=1;p<=pages;p++){
    const d=await api(path('ALL',p,200,'summary'));all.push(...(d.items||[]));pages=Math.max(1,d.meta?.pages||1);
    if(p>100)throw new Error('Export exceeds 20,000 rows. Please contact an administrator.');
   }
   const headers=['Date','Source / Voucher Type','Particulars','Debit (Cash Out)','Credit (Cash In)','Cash in Hand'];
   const records=[['','Opening Balance','FY Opening Cash','','',opening.toFixed(2)],
    ...all.reverse().map(r=>[date(r.date),CASH_CATEGORIES[r.category]||r.category||'',r.particular||r.remarks||'',r.debit?Number(r.debit).toFixed(2):'',r.credit?Number(r.credit).toFixed(2):'',Number(r.runningBalance).toFixed(2)]),
    ['','Closing Balance','FY Cash in Hand',fyDebit.toFixed(2),fyCredit.toFixed(2),closing.toFixed(2)]];
   await exportTransactionList('Cashbook',format,headers,records,`${fy}-Full-FY`,printWindow);
  }catch(e){setError(e.message);}
 };
 const detail=()=> <>
  <div className="transactionLineTableScroll"><table className="transactionLineTable cashbookNewTable">
   <thead><tr><th><input type="checkbox" aria-label="Select all eligible Cashbook vouchers on this page" title="Select all eligible entries on this page" checked={allVisibleSelected} disabled={!eligibleRows.length||busy||detailBusy} onChange={e=>toggleVisible(e.target.checked)}/></th><th>{inline.header('date','Date')}</th><th>Source</th><th>{inline.header('party','Party')}</th><th>{inline.header('remarks','Particulars')}</th><th>{inline.header('debit','Debit (Paid)')}</th><th>{inline.header('credit','Credit (Received)')}</th><th title="Calculated from the cash ledger; not an editable value">Cash in Hand</th><th>Edit</th><th>Delete</th></tr></thead>
   <tbody>{rows.map(r=><tr key={`${r.transactionId}-${r._id}`}>
    <td>{canSelectRow(r)?<input type="checkbox" checked={selected.includes(rowKey(r))} onChange={e=>toggleSelected(rowKey(r),e.target.checked)} disabled={busy||detailBusy} aria-label={`Select cash transaction ${r.transactionId}`} />:'—'}</td>
    <td>{inline.cell(r,'date',date(r.date))}</td>
    <td><small>{CASH_CATEGORIES[r.category]||r.category||'—'}</small></td>
    <td>{inline.cell(r,'party',r.partyName||'—')}</td>
    <td className="cashbookParticular" title={r.transactionId||''}>{inline.cell(r,'remarks',r.particular||r.remarks||r.partyName||'—')}</td>
    <td>{inline.cell(r,'debit',r.debit?money(r.debit):'—')}</td><td>{inline.cell(r,'credit',r.credit?money(r.credit):'—')}</td><td><strong>{money(r.runningBalance)}</strong></td>
    <td>{superadmin?<button type="button" className="btn ghost" title="Edit CASH book entries directly" disabled={inline.editing||inline.loading} onClick={inline.beginAll}><Pencil size={15}/></button>:
    r.voucherId&&r.voucherKind&&mayEditPostedVoucher(user,r.voucherKind,'cash')?<button type="button" className="btn ghost" title="Edit voucher" onClick={()=>navigate(`/dms/transactions/edit/${r.voucherKind}/${encodeURIComponent(r.voucherId)}?fy=${encodeURIComponent(fy)}&back=cash`)}><Pencil size={15}/></button>:'—'}</td>
    <td>{superadmin||r.voucherId&&r.voucherKind&&mayDeletePostedVoucher(user,r.voucherKind,'cash')?<button type="button" className="btn ghost danger transactionBulkDeleteIcon" title="Void voucher" onClick={()=>remove(r)} disabled={busy}><Trash2 size={15}/></button>:'—'}</td>
   </tr>)}{!rows.length&&<tr><td colSpan={10} className="bookMonthEmpty">No matching transactions for this month.</td></tr>}</tbody></table></div>
  <div className="bookMonthPager"><span>{meta.total||0} matching entries · Page {meta.page||1} of {meta.pages||1}</span><div>
   <button type="button" className="btn ghost" disabled={detailBusy||(meta.page||1)<=1} onClick={()=>loadMonth(openMonth,(meta.page||1)-1)}><ChevronLeft size={15}/>Previous</button>
   <button type="button" className="btn ghost" disabled={detailBusy||(meta.page||1)>=(meta.pages||1)} onClick={()=>loadMonth(openMonth,(meta.page||1)+1)}>Next<ChevronRight size={15}/></button>
  </div></div>
 </>;
 return <div className="transactionPage"><section className="panel transactionLedgerPanel">
  <div className="transactionSingleToolbar">
   <select aria-label="Financial Year" value={fy} onChange={e=>{summarySequence.current++;detailSequence.current++;setFy(e.target.value);}}>{years.map(y=><option key={y}>{y}</option>)}</select>
   <select aria-label="Cashbook source" value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORY_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
   <div className="searchBox"><Search size={15}/><input aria-label="Search Cashbook" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search particulars or voucher" onKeyDown={e=>e.key==='Enter'&&setSubmittedQuery(query)}/></div>
   <button type="button" className="btn ghost" onClick={()=>{setSubmittedQuery(query);refresh();}} disabled={busy}><RefreshCw size={15}/>Refresh</button>
   <select aria-label="Download Cashbook" value="" onChange={e=>{const v=e.target.value;e.target.value='';if(v==='template')downloadCashbookTemplate();else if(v)exportRows(v,v==='print'?window.open('','_blank'):null);}}><option value="">Download ▾</option><option value="excel">Excel</option><option value="pdf">PDF</option><option value="print">Print</option><option value="template">Bulk Template</option></select>
   <button type="button" className="btn ghost" onClick={()=>navigate('/dms/cashbook/bulk')}><Upload size={15}/>Bulk Upload</button>
   <button type="button" className="btn primary" onClick={()=>navigate('/dms/cashbook/add')}><Plus size={15}/>Add Entry</button>
   <button type="button" className="btn ghost" onClick={()=>navigate('/dms/transactions/contra')}>Cash / Bank Contra</button>
   {!inline.editing?<button type="button" className="btn ghost" disabled={inline.loading||detailBusy||!rows.length}
     onClick={inline.begin} title="Select headings: Date, Party, Particulars, Debit and/or Credit, then click Edit">{inline.loading?'Loading…':`Edit Columns${inline.selectedColumns.length?` (${inline.selectedColumns.length})`:''}`}</button>
     :<><button type="button" className="btn primary" disabled={inline.loading} onClick={inline.save}>Save All Changes{inline.changedCount?` (${inline.changedCount})`:''}</button>
     <button type="button" className="btn ghost" disabled={inline.loading} onClick={inline.cancel}>Cancel Editing</button></>}
   {canBulkDelete&&<button type="button" className="btn ghost danger transactionBulkDeleteIcon" aria-label={`Bulk delete ${selectedRows.length} selected cash transactions`} title={`Bulk delete selected (${selectedRows.length})`} disabled={busy||detailBusy||!selectedRows.length} onClick={bulkDelete}><Trash2 size={16}/></button>}
  </div>
  {error&&<div className="resultBanner bad" role="alert">{error}</div>}
  {notice&&<div className="resultBanner" role="status">{notice}</div>}
  {openingNeedsSetup&&<div className="resultBanner bad" role="alert">Opening cash has not been confirmed for the earliest year containing records. Superadmin: set the correct first financial year and opening in Profile.</div>}

  <small className="bookInlineHelp">{superadmin?'Select any column headings, choose Edit Columns, then Save All Changes. Superadmin corrections are applied directly to the CASH book with balanced journal adjustments and an audit trail.':'Select column headings to edit authorized DMS vouchers. Original uploaded remarks and running Cash in Hand are displayed.'}</small>
  <div className="cashbookBalanceStrip"><span>Opening Cash <strong>{money(opening)}</strong></span><span>Cash Received (+) <strong>{money(fyCredit)}</strong></span><span>Cash Paid (−) <strong>{money(fyDebit)}</strong></span><span>Cash in Hand <strong>{money(closing)}</strong></span><span>{busy?'Loading year…':openingSource==='SUPERADMIN_PROFILE'?'Opening from Superadmin Profile · April–March':'April–March · Expand any month'}</span></div>
  {closing< -0.005&&<div className="resultBanner bad" role="alert">Negative Cash in Hand: physical cash cannot normally be negative. Check voucher dates, opening cash and missing/duplicate entries.</div>}
  {months.length?<BookMonthAccordion months={months} openMonth={openMonth} onToggle={month=>{inline.cancel();detailSequence.current++;setSelected([]);setRows([]);setMeta(EMPTY);setOpenMonth(month);}} loading={detailBusy} renderDetail={detail} balanceFormat={money}/>:
   <div className="bookMonthEmpty">{busy?'Loading financial-year months…':'No financial-year summary available.'}</div>}
 </section></div>;
}

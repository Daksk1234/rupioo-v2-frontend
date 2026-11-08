import React from 'react';
import {ChevronDown,ChevronRight} from 'lucide-react';

const cash = v => `₹${Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
/** Monthly rows are the first-level ledger rows. Only the opened month fetches its detail. */
export default function BookMonthAccordion({months=[],openMonth='',onToggle,renderDetail,loading=false,balanceFormat=cash,emptyText='No records in this month'}) {
 return <div className="bookMonthsTableWrap"><table className="bookMonthsTable">
  <thead><tr><th>Month</th><th>Opening</th><th>Debit</th><th>Credit</th><th>Closing</th><th>Entries</th></tr></thead>
  <tbody>{months.map(m=>{
   const expanded=openMonth===m.month;
   return <React.Fragment key={m.month}>
    <tr className={`bookMonthRow${expanded?' isExpanded':''}`}>
     <td><button type="button" className="bookMonthToggle" aria-expanded={expanded} aria-label={`${expanded?'Collapse':'Expand'} ${m.label||m.month}`} onClick={()=>onToggle?.(expanded?'':m.month)}>{expanded?<ChevronDown size={17}/>:<ChevronRight size={17}/>}<span>{m.label||m.month}</span>{m.count===0&&<small>Empty</small>}</button></td>
     <td>{balanceFormat(m.openingBalance)}</td>
     <td>{m.debit?cash(m.debit):'—'}</td>
     <td>{m.credit?cash(m.credit):'—'}</td>
     <td><strong>{balanceFormat(m.closingBalance)}</strong></td>
     <td>{Number(m.count||0).toLocaleString('en-IN')}</td>
    </tr>
    {expanded&&<tr className="bookMonthDetailRow"><td colSpan={6}>
     {loading?<div className="bookMonthLoading" role="status">Loading {m.label||m.month} transactions…</div>:
       m.count===0?<div className="bookMonthEmpty">{emptyText} — opening and closing balances are still carried forward.</div>:
       renderDetail?.(m)}
    </td></tr>}
   </React.Fragment>;
  })}</tbody>
 </table></div>;
}

import {api} from './api.js';
export const isBookSuperadmin = user => ['MASTER','SUPERADMIN'].includes(String(user?.role||'').toUpperCase());
export const bookCorrectionSourceKey = (row,channel) => channel === 'cash'
  ? `CB:${String(row?.transactionType||'')}:${String(row?.transactionId||'')}`
  : String(row?._listId||'');
export async function deleteBookRow({row,channel,financialYear}){
 const book=channel.toUpperCase(),sourceKey=bookCorrectionSourceKey(row,channel);
 if(!sourceKey||sourceKey==='CB::')throw new Error('This row has no stable book identifier');
 const reason=window.prompt(`Remove ${row.transactionId||'this entry'} from the active ${book} book? Original evidence and a full correction audit will be retained.\nCorrection reason (at least 5 characters):`);
 if(reason===null)return {cancelled:true};
 if(reason.trim().length<5)throw new Error('Enter a reason of at least five characters');
 const date=String(row.date||'').slice(0,10);
 const result=await api('/transactions/book-corrections',{method:'POST',body:JSON.stringify({
   book,sourceKey,financialYear,date,deleted:true,remarks:row.remarks||row.particular||'',
   partyName:row.partyName||row.matchedPartyName||'',debit:0,credit:0,reason:reason.trim(),
 })});
 return result;
}

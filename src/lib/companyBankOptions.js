import { api } from './api.js';

/** Fetch ALL active company bank accounts, not just the first page of 200. */
export async function fetchCompanyBankAccounts(financialYear = '') {
  let page = 1;
  const collected = [];
  for (;;) {
    const query = `/banks?status=ACTIVE&financialYear=${encodeURIComponent(financialYear)}&page=${page}&limit=200`;
    const result = await api(query);
    collected.push(...(result.items || []));
    const pages = Number(result.meta?.pages || 1);
    if (page >= pages) break;
    if (++page > 100) throw new Error('Bank account list exceeds the supported 20,000 accounts');
  }
  return collected;
}

export const companyBankParty = b => ({
  id: String(b.bankAccountId),
  name: `${b.bankName} • ${b.accountHolderName || ''} • A/C ${b.accountNumber || ''}`,
  type: 'BANK_ACCOUNT',
  subtype: 'Own company bank',
  identifier: String(b.accountNumber || ''),
});

export const newTransferReference = () =>
  `BTR-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

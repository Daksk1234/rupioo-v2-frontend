// Selection is about *physical custody*, not whether a historical receipt was
// previously posted to the ledger. Keep these decisions aligned with the DMS
// cashier/collect-cash and cashier/collect-cheques API preconditions.
const upper = value => String(value ?? '').trim().toUpperCase();
const validId = value => /^[a-f0-9]{24}$/i.test(String(value ?? ''));
const physicalCashPending = new Set(['', 'NOT_APPLICABLE', 'PENDING_TO_DEPOSIT']);
const pendingChequeStatuses = new Set([
  'PENDING_WITH_SALESPERSON', 'PENDING_WITH_COLLECTOR',
  'HANDOVER_REQUESTED', 'HANDOVER_OTP_ISSUED',
  'HANDOVER_VERIFIED', 'PENDING_RECEIVED',
]);

export function cashReceiptSelection(row) {
  if (!validId(row?.id)) return { selectable: false, collectable: false, postable: false, reason: 'Original receipt ID is missing; refresh or check receipt registration.' };
  if (upper(row.disputeStatus) === 'HOLD') return { selectable: false, collectable: false, postable: false, reason: 'Disputed receipt: resolve HOLD first.' };
  if (row.stage === 'AWAITING HANDOVER') {
    if (!physicalCashPending.has(upper(row.physicalStatus))) return {
      selectable: false, collectable: false, postable: false,
      reason: 'Cash handover is already reserved or in progress. Finish its existing OTP handover.',
    };
    // A ledgerPostedAt value is NOT a physical-deposit flag. Older receipts
    // with legacy ledger postings still need to be physically collected.
    return { selectable: true, collectable: true, postable: false, reason: '' };
  }
  if (row.stage === 'RECEIVED BY CASHIER') {
    if (row.posted) return { selectable: false, collectable: false, postable: false, reason: 'Cash already received and ledger posted.' };
    return { selectable: true, collectable: false, postable: true, reason: '' };
  }
  return { selectable: false, collectable: false, postable: false,
    reason: 'This receipt belongs to an existing handover. Complete that handover first.' };
}

export function chequeReceiptSelection(row) {
  if (upper(row?.disputeStatus) === 'HOLD') return { selectable: false, reason: 'Disputed cheque: resolve HOLD first.' };
  if (row?.chequeApprovalBatchId) return { selectable: false, reason: 'Already in a pending or approved cheque bundle.' };
  if (row?.ledgerPostedAt) return { selectable: false, reason: 'Cheque receipt already posted to ledger.' };
  if (!validId(row?.id) || !validId(row?.receiptId) || !row?.linkedReceiptNo) return {
    selectable: false, reason: row?.registrationIssue || 'Cheque must be linked to its verified receipt. Complete cheque registration first.',
  };
  if (!pendingChequeStatuses.has(upper(row.status))) return {
    selectable: false, reason: 'Cheque is not in collector custody or is already company received.',
  };
  return { selectable: true, reason: '' };
}

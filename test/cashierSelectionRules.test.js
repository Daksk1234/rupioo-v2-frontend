import test from 'node:test';
import assert from 'node:assert/strict';
import {cashReceiptSelection,chequeReceiptSelection} from '../src/pages/cashierSelectionRules.js';
const id='507f1f77bcf86cd799439011';
const id2='507f191e810c19729de860ea';
const pending = {id,stage:'AWAITING HANDOVER',physicalStatus:'PENDING_TO_DEPOSIT',disputeStatus:'NONE',posted:false};

test('cash pending: unposted receipt is selectable for physical collection',()=>{
 assert.deepEqual(cashReceiptSelection(pending),{selectable:true,collectable:true,postable:false,reason:''});
});
test('cash pending: previously ledger-posted receipt is STILL selectable for physical custody',()=>{
 const state=cashReceiptSelection({...pending,posted:true});
 assert.equal(state.collectable,true); assert.equal(state.selectable,true);
});
test('cash pending: NOT_APPLICABLE legacy physical status can still be handed over',()=>{
 assert.equal(cashReceiptSelection({...pending,physicalStatus:'NOT_APPLICABLE'}).collectable,true);
});
test('cash pending: reserved batch is blocked',()=>{
 assert.equal(cashReceiptSelection({...pending,physicalStatus:'HANDOVER_PENDING'}).selectable,false);
});
test('cash: dispute blocks all actions',()=>{
 assert.equal(cashReceiptSelection({...pending,disputeStatus:'HOLD'}).selectable,false);
});
test('cash: received but not posted may be selected for post to ledger only',()=>{
 const state=cashReceiptSelection({...pending,stage:'RECEIVED BY CASHIER',physicalStatus:'DEPOSITED_TO_CASHIER'});
 assert.equal(state.selectable,true); assert.equal(state.collectable,false); assert.equal(state.postable,true);
});
test('cash: received and ledger-posted cannot be re-posted',()=>{
 assert.equal(cashReceiptSelection({...pending,stage:'RECEIVED BY CASHIER',posted:true}).selectable,false);
});
test('cash: existing handover must be completed rather than collected twice',()=>{
 assert.equal(cashReceiptSelection({...pending,stage:'OTP HANDOVER'}).selectable,false);
});
test('cash: missing source id cannot be handed over',()=>{
 assert.equal(cashReceiptSelection({...pending,id:'not-an-id'}).selectable,false);
});
test('cheque: registered pending cheque can be bundled',()=>{
 assert.equal(chequeReceiptSelection({id,receiptId:id2,linkedReceiptNo:'REC-1',status:'PENDING_WITH_COLLECTOR'}).selectable,true);
});
test('cheque: pending received cheque may be bundled',()=>{
 assert.equal(chequeReceiptSelection({id,receiptId:id2,linkedReceiptNo:'REC-1',status:'PENDING_RECEIVED'}).selectable,true);
});
test('cheque: missing registration shows actionable message',()=>{
 const state=chequeReceiptSelection({id:`unlinked:${id2}`,receiptId:id2,status:'NEEDS_REGISTRATION',registrationIssue:'IFSC missing'});
 assert.equal(state.selectable,false);assert.match(state.reason,/IFSC missing/);
});
test('cheque: disputed, approved, posted, company received cannot be bundled',()=>{
 const row={id,receiptId:id2,linkedReceiptNo:'REC-1',status:'PENDING_WITH_COLLECTOR'};
 for(const variant of [{disputeStatus:'HOLD'},{chequeApprovalBatchId:id2},{ledgerPostedAt:new Date()},{status:'RECEIVED'}])
  assert.equal(chequeReceiptSelection({...row,...variant}).selectable,false);
});

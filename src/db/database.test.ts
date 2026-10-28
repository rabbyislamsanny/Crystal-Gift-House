import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './database';

test('runAcceptanceTests executes all 10 acceptance criteria and passes', () => {
  const results = db.runAcceptanceTests();
  assert.equal(results.length, 10, 'Must have 10 acceptance tests');

  for (const r of results) {
    assert.equal(r.passed, true, `Test ${r.id} (${r.name}) failed: ${r.message}`);
  }
});

test('Supplier CRUD (add, edit, delete) and Cash In / Cash Out accounting with balance reconciliation', () => {
  db.resetToDemo();

  // 1. Add Supplier
  const createdSup = db.saveSupplier({
    name: 'Dhaka Crystal Imports',
    phone: '01799887766',
    company: 'DCI Wholesale',
    address: 'Mitford, Dhaka',
    currentBalance: 20000,
    notes: 'Crystal blanks supplier',
  });
  assert.ok(createdSup.id);
  assert.equal(createdSup.name, 'Dhaka Crystal Imports');
  assert.equal(createdSup.currentBalance, 20000);

  // 2. Edit Supplier
  const updatedSup = db.saveSupplier({
    id: createdSup.id,
    name: 'Dhaka Crystal Imports Ltd',
    phone: '01799887766',
    company: 'DCI Wholesale',
    address: 'Mitford Road, Old Dhaka',
    currentBalance: 25000,
  });
  assert.equal(updatedSup.name, 'Dhaka Crystal Imports Ltd');
  assert.equal(updatedSup.currentBalance, 25000);

  // 3. Record Cash In and verify account balance increases
  const accBefore = db.getBankAccounts().find((a) => a.id === 'acc-1')!;
  const initialBal = accBefore.balance;

  const cashInRes = db.saveCashTransaction({
    date: '2026-10-28',
    type: 'cash_in',
    category: 'Order Advance / Sales Collection',
    amount: 5500,
    accountId: 'acc-1',
    partyName: 'Corporate Client',
    reference: 'BKASH-5500',
    notes: 'Advance for corporate trophy order',
  });
  assert.equal(cashInRes.success, true);
  assert.equal(cashInRes.transaction?.balanceBefore, initialBal);
  assert.equal(cashInRes.transaction?.balanceAfter, initialBal + 5500);

  const accAfterIn = db.getBankAccounts().find((a) => a.id === 'acc-1')!;
  assert.equal(accAfterIn.balance, initialBal + 5500);

  // 4. Record Cash Out (Supplier Payment) and verify both account balance and supplier payable decrease
  const cashOutRes = db.saveCashTransaction({
    date: '2026-10-28',
    type: 'cash_out',
    category: 'Supplier Payment',
    amount: 10000,
    accountId: 'acc-1',
    partyName: updatedSup.name,
    supplierId: updatedSup.id,
    reference: 'SUP-PAY-10K',
  });
  assert.equal(cashOutRes.success, true);

  const accAfterOut = db.getBankAccounts().find((a) => a.id === 'acc-1')!;
  assert.equal(accAfterOut.balance, initialBal + 5500 - 10000);

  const supAfterPay = db.getSuppliers().find((s) => s.id === updatedSup.id)!;
  assert.equal(supAfterPay.currentBalance, 15000);

  // 5. Edit Cash In transaction and verify balance adjusts accurately
  const editTxRes = db.saveCashTransaction({
    id: cashInRes.transaction!.id,
    date: '2026-10-28',
    type: 'cash_in',
    category: 'Order Advance / Sales Collection',
    amount: 8000,
    accountId: 'acc-1',
    partyName: 'Corporate Client',
    reference: 'BKASH-8000',
  });
  assert.equal(editTxRes.success, true);
  const accAfterEdit = db.getBankAccounts().find((a) => a.id === 'acc-1')!;
  assert.equal(accAfterEdit.balance, initialBal + 8000 - 10000);

  // 6. Delete Cash Out transaction and verify balance is reversed
  const delTxRes = db.deleteCashTransaction(cashOutRes.transaction!.id);
  assert.equal(delTxRes.success, true);
  const accAfterDel = db.getBankAccounts().find((a) => a.id === 'acc-1')!;
  assert.equal(accAfterDel.balance, initialBal + 8000);

  // 7. Delete Supplier
  const delSupRes = db.deleteSupplier(updatedSup.id);
  assert.equal(delSupRes.success, true);
  assert.equal(db.getSuppliers().some((s) => s.id === updatedSup.id), false);
});


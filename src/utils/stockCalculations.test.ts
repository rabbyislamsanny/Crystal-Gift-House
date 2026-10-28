import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAvailableStock,
  calculateWeightedAverageCost,
  reserveStockForOrder,
  dispatchStock,
  cancelPreDispatchReservation,
  inspectAndProcessReturn,
} from './stockCalculations';

test('calculateAvailableStock computes onHand minus reserved', () => {
  assert.equal(calculateAvailableStock(10, 2), 8);
  assert.equal(calculateAvailableStock(10, 10), 0);
  assert.equal(calculateAvailableStock(5, 7), 0); // clamped to 0
});

test('calculateWeightedAverageCost applies AVCO properly', () => {
  // Initial 10 units at BDT 300 = 3000
  // Received 10 units at BDT 400 = 4000
  // Total 20 units at (7000 / 20) = 350
  const wac = calculateWeightedAverageCost(10, 300, 10, 400);
  assert.equal(wac, 350);

  // When initial onHand is 0, new WAC is the landed unit cost
  const initialWac = calculateWeightedAverageCost(0, 0, 5, 250);
  assert.equal(initialWac, 250);
});

test('reserveStockForOrder enforces stock limits unless backorder allowed', () => {
  const initial = { onHand: 10, reserved: 0, purchaseCost: 300, damagedStock: 0 };
  const res1 = reserveStockForOrder(initial, 2);
  assert.equal(res1.success, true);
  assert.equal(res1.newState.reserved, 2);
  assert.equal(res1.newState.onHand, 10);

  // Attempting to reserve more than available should fail
  const res2 = reserveStockForOrder(res1.newState, 9);
  assert.equal(res2.success, false);
  assert.match(res2.error || '', /Insufficient available stock/);
});

test('dispatchStock deducts physical onHand and clears reservation', () => {
  const reservedState = { onHand: 10, reserved: 2, purchaseCost: 300, damagedStock: 0 };
  const dispatchRes = dispatchStock(reservedState, 2);
  assert.equal(dispatchRes.success, true);
  assert.equal(dispatchRes.newState.onHand, 8);
  assert.equal(dispatchRes.newState.reserved, 0);
});

test('cancelPreDispatchReservation releases reserved quantity without touching onHand', () => {
  const reservedState = { onHand: 10, reserved: 2, purchaseCost: 300, damagedStock: 0 };
  const cancelledState = cancelPreDispatchReservation(reservedState, 2);
  assert.equal(cancelledState.onHand, 10);
  assert.equal(cancelledState.reserved, 0);
});

test('inspectAndProcessReturn handles restock and damaged inspection correctly', () => {
  const dispatchedState = { onHand: 8, reserved: 0, purchaseCost: 300, damagedStock: 0 };

  // Case 1: Restocked item adds back to on-hand
  const restockOutcome = inspectAndProcessReturn(dispatchedState, 1, 'restock');
  assert.equal(restockOutcome.newState.onHand, 9);
  assert.equal(restockOutcome.newState.damagedStock, 0);

  // Case 2: Damaged item does NOT add to sellable on-hand, adds to damagedStock
  const damageOutcome = inspectAndProcessReturn(dispatchedState, 1, 'damaged');
  assert.equal(damageOutcome.newState.onHand, 8); // onHand unchanged!
  assert.equal(damageOutcome.newState.damagedStock, 1);
});

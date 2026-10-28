import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateAdExpenseEvenly,
  calculateProfitAndLoss,
  OrderAccountingData,
  ParcelAccountingData,
  AdExpenseData,
} from './accountingCalculations';

test('allocateAdExpenseEvenly preserves exact total sum across 3 days without duplicate or lost cents', () => {
  // $100 converted to BDT 12,250 over 3 days (e.g. 2026-10-01 to 2026-10-03)
  const totalBdt = 12250;
  const allocations = allocateAdExpenseEvenly('2026-10-01', '2026-10-03', totalBdt);

  assert.equal(allocations.length, 3);
  assert.equal(allocations[0].date, '2026-10-01');
  assert.equal(allocations[1].date, '2026-10-02');
  assert.equal(allocations[2].date, '2026-10-03');

  const sum = allocations.reduce((acc, a) => acc + a.bdtAmount, 0);
  assert.equal(Math.round(sum * 100) / 100, totalBdt);
});

test('calculateProfitAndLoss strictly distinguishes realized sales from pending orders', () => {
  const sampleOrders: OrderAccountingData[] = [
    // Delivered order: 2 units at 500 BDT, cost 300 BDT each
    {
      id: 'ord-1',
      orderNumber: 'CGH-001',
      status: 'delivered',
      orderDate: '2026-10-15',
      deliveryDate: '2026-10-18',
      items: [{ quantity: 2, unitPrice: 500, unitCost: 300 }],
      itemTotal: 1000,
      discount: 0,
      deliveryFeeCharged: 100,
      advancePaid: 0,
      codAmount: 1100,
      refundAmount: 0,
    },
    // Pending order: 1 unit at 800 BDT, cost 450 BDT
    {
      id: 'ord-2',
      orderNumber: 'CGH-002',
      status: 'pending',
      orderDate: '2026-10-20',
      items: [{ quantity: 1, unitPrice: 800, unitCost: 450 }],
      itemTotal: 800,
      discount: 50,
      deliveryFeeCharged: 100,
      advancePaid: 0,
      codAmount: 850,
      refundAmount: 0,
    },
  ];

  const sampleParcels: ParcelAccountingData[] = [
    {
      id: 'pcl-1',
      orderId: 'ord-1',
      courierName: 'Steadfast',
      consignmentId: 'ST-1001',
      codAmount: 1100,
      deliveryCharge: 70,
      returnCharge: 0,
      collectedAmount: 1100,
      settledAmount: 0,
      isSettled: false, // NOT yet settled to bank
      status: 'delivered',
    },
  ];

  const pnl = calculateProfitAndLoss({
    orders: sampleOrders,
    parcels: sampleParcels,
    adExpenses: [],
    operatingExpenses: [],
    damagedStockLoss: 0,
  });

  // Realized Net Sales = 1000 (item) + 100 (delivery fee charged) = 1100
  assert.equal(pnl.realizedNetSales, 1100);
  // Realized COGS = 2 * 300 = 600
  assert.equal(pnl.realizedCogs, 600);
  // Gross Profit = 1100 - 600 = 500
  assert.equal(pnl.realizedGrossProfit, 500);
  // Courier delivery expense = 70
  assert.equal(pnl.totalCourierDeliveryExpense, 70);
  // Realized Net Profit = 500 - 70 = 430
  assert.equal(pnl.realizedNetProfit, 430);

  // COD pending settlement = 1100 COD - 70 courier fee = 1030
  assert.equal(pnl.codReceivablesPending, 1030);

  // Pending order is kept in pipeline and NOT counted in realized profit
  assert.equal(pnl.pendingEstimatedSales, 750); // 800 - 50 discount
  assert.equal(pnl.pendingEstimatedCogs, 450);
});

test('calculateProfitAndLoss does not double count courier fees from operating expenses', () => {
  const pnl = calculateProfitAndLoss({
    orders: [],
    parcels: [
      {
        id: 'pcl-1',
        orderId: 'ord-1',
        courierName: 'Pathao',
        consignmentId: 'PTH-99',
        codAmount: 500,
        deliveryCharge: 60,
        returnCharge: 0,
        collectedAmount: 500,
        settledAmount: 440,
        isSettled: true,
        status: 'settled',
      },
    ],
    adExpenses: [],
    operatingExpenses: [
      // Courier fee entry that should be flagged and ignored because parcel already counted 60 BDT
      {
        id: 'exp-1',
        category: 'Courier',
        date: '2026-10-20',
        amount: 60,
        paymentStatus: 'paid',
        isCourierFee: true,
      },
      // Normal operating expense: packaging material
      {
        id: 'exp-2',
        category: 'Packaging',
        date: '2026-10-20',
        amount: 150,
        paymentStatus: 'paid',
      },
    ],
    damagedStockLoss: 0,
  });

  // Courier delivery expense is 60 from parcel
  assert.equal(pnl.totalCourierDeliveryExpense, 60);
  // Operating expense only takes 150 (ignoring the 60 BDT flagged courier fee)
  assert.equal(pnl.nonCourierOperatingExpense, 150);
  // Total costs = 60 + 150 = 210
  assert.equal(pnl.totalOperatingCosts, 210);
});

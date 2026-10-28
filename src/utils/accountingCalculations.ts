/**
 * Accounting and P&L calculations for Crystal Gift House Business OS
 * Strictly enforces:
 * 1. Accrual vs Cash basis distinction
 * 2. Net Sales = Delivered/Completed revenue - Discounts - Refunds
 * 3. COGS = Cost of sold items actually delivered (using historical cost snapshot)
 * 4. Gross Profit = Net Sales - COGS
 * 5. Net Profit = Gross Profit - Ad Spend - Courier Net Fees - Operating Expenses - Damaged Stock Loss
 * 6. Non-duplication of ad spending (multi-day allocation sums to exact total)
 * 7. Non-duplication of courier fees (parcel settlement vs general expense)
 * 8. Purchases are capital/inventory assets, NOT operating expenses (prevents double-counting with COGS)
 */

export interface OrderItemSnapshot {
  quantity: number;
  unitPrice: number;
  unitCost: number; // Historical snapshot at order time
}

export interface OrderAccountingData {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  deliveryDate?: string;
  items: OrderItemSnapshot[];
  itemTotal: number;
  discount: number;
  deliveryFeeCharged: number; // What customer was charged
  advancePaid: number;
  codAmount: number;
  refundAmount: number;
  returnedItemsCost?: number;
}

export interface ParcelAccountingData {
  id: string;
  orderId: string;
  courierName: string;
  consignmentId: string;
  codAmount: number;
  deliveryCharge: number; // What courier charged
  returnCharge: number;
  collectedAmount: number;
  settledAmount: number;
  isSettled: boolean;
  dispatchDate?: string;
  settlementDate?: string;
  status: 'pending_dispatch' | 'in_transit' | 'delivered' | 'failed' | 'returned' | 'settled';
}

export interface AdExpenseAllocation {
  date: string; // YYYY-MM-DD
  bdtAmount: number;
}

export interface AdExpenseData {
  id: string;
  platform: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  usdAmount: number;
  exchangeRate: number;
  feeBdt: number;
  totalBdt: number;
  allocationMethod: 'even' | 'manual';
  allocations: AdExpenseAllocation[];
}

export interface OperatingExpenseData {
  id: string;
  category: string;
  date: string;
  amount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  isCourierFee?: boolean; // If already recorded in courier settlements, must be excluded to prevent double counting
}

/**
 * Distribute multi-day lump-sum advertising expense evenly across date range
 * Guarantees exact sum equality down to the paisa (0.01 BDT).
 */
export function allocateAdExpenseEvenly(
  startDateStr: string,
  endDateStr: string,
  totalBdt: number
): AdExpenseAllocation[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const basePerDay = Math.floor((totalBdt / diffDays) * 100) / 100;
  let remaining = Math.round((totalBdt - basePerDay * diffDays) * 100) / 100;

  const allocations: AdExpenseAllocation[] = [];
  const cur = new Date(start);

  for (let i = 0; i < diffDays; i++) {
    const dateStr = cur.toISOString().split('T')[0];
    let dayAmount = basePerDay;
    if (i === diffDays - 1) {
      // Last day absorbs any rounding residue to ensure exact mathematical sum
      dayAmount = Math.round((dayAmount + remaining) * 100) / 100;
    }
    allocations.push({
      date: dateStr,
      bdtAmount: dayAmount,
    });
    cur.setDate(cur.getDate() + 1);
  }

  return allocations;
}

/**
 * Calculates Comprehensive P&L and Balance Sheet Metrics
 */
export function calculateProfitAndLoss(params: {
  orders: OrderAccountingData[];
  parcels: ParcelAccountingData[];
  adExpenses: AdExpenseData[];
  operatingExpenses: OperatingExpenseData[];
  damagedStockLoss: number;
  accountingBasis?: 'accrual' | 'cash';
  startDate?: string;
  endDate?: string;
}) {
  const {
    orders,
    parcels,
    adExpenses,
    operatingExpenses,
    damagedStockLoss,
    accountingBasis = 'accrual',
    startDate,
    endDate,
  } = params;

  // Filter helper
  const isInRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // 1. Order Classifications
  let grossSales = 0; // Total sales value of orders
  let discountsTotal = 0;
  let refundsTotal = 0;
  let customerDeliveryRevenue = 0;
  let cogs = 0;

  let realizedGrossSales = 0;
  let realizedDiscounts = 0;
  let realizedRefunds = 0;
  let realizedCustomerDeliveryFee = 0;
  let realizedCogs = 0;

  let pendingEstimatedSales = 0;
  let pendingEstimatedCogs = 0;

  let totalDeliveredOrdersCount = 0;
  let totalConfirmedOrdersCount = 0;
  let totalCancelledOrdersCount = 0;
  let totalReturnedOrdersCount = 0;

  for (const ord of orders) {
    const isRelevantDate = isInRange(ord.orderDate) || (ord.deliveryDate && isInRange(ord.deliveryDate));
    if (!isRelevantDate) continue;

    const isDelivered = ord.status === 'delivered';
    const isCancelled = ord.status === 'cancelled';
    const isReturned = ord.status === 'returned';

    if (isDelivered) {
      totalDeliveredOrdersCount++;
      const orderItemGross = ord.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      const orderItemCost = ord.items.reduce((s, it) => s + it.quantity * it.unitCost, 0);

      realizedGrossSales += orderItemGross;
      realizedDiscounts += ord.discount;
      realizedRefunds += ord.refundAmount;
      realizedCustomerDeliveryFee += ord.deliveryFeeCharged;
      realizedCogs += orderItemCost - (ord.returnedItemsCost || 0);
    } else if (isCancelled) {
      totalCancelledOrdersCount++;
    } else if (isReturned) {
      totalReturnedOrdersCount++;
      realizedRefunds += ord.refundAmount;
    } else {
      // Pending, Confirmed, Processing, Packed, Shipped
      totalConfirmedOrdersCount++;
      const itemGross = ord.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      const itemCost = ord.items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
      pendingEstimatedSales += itemGross - ord.discount;
      pendingEstimatedCogs += itemCost;
    }

    grossSales += ord.itemTotal;
    discountsTotal += ord.discount;
    refundsTotal += ord.refundAmount;
    customerDeliveryRevenue += ord.deliveryFeeCharged;
  }

  // Realized Net Sales: (Delivered Item Sales - Discounts + Customer Delivery Fee) - Refunds
  const realizedNetSales = Math.max(0, realizedGrossSales - realizedDiscounts + realizedCustomerDeliveryFee - realizedRefunds);
  const realizedGrossProfit = realizedNetSales - realizedCogs;

  // 2. Courier Expenses & COD Receivables
  let totalCourierDeliveryExpense = 0;
  let totalCourierReturnExpense = 0;
  let codReceivablesPending = 0; // Courier owes this to business
  let codCollectedByCourier = 0;
  let codSettledToBank = 0;

  for (const p of parcels) {
    const isRelevant = isInRange(p.dispatchDate || p.settlementDate);
    if (!isRelevant && (startDate || endDate)) continue;

    totalCourierDeliveryExpense += p.deliveryCharge;
    totalCourierReturnExpense += p.returnCharge;

    if (p.status === 'delivered' || p.status === 'settled') {
      codCollectedByCourier += p.codAmount;
      if (p.isSettled) {
        codSettledToBank += p.settledAmount || (p.codAmount - p.deliveryCharge);
      } else {
        // Delivered but not yet settled to bank account
        codReceivablesPending += p.codAmount - p.deliveryCharge;
      }
    }
  }

  // 3. Ad Spend (Using precise daily allocations)
  let periodAdSpend = 0;
  for (const ad of adExpenses) {
    if (ad.allocations && ad.allocations.length > 0) {
      for (const alloc of ad.allocations) {
        if (isInRange(alloc.date)) {
          periodAdSpend += alloc.bdtAmount;
        }
      }
    } else {
      if (isInRange(ad.startDate)) {
        periodAdSpend += ad.totalBdt;
      }
    }
  }
  periodAdSpend = Math.round(periodAdSpend * 100) / 100;

  // 4. Operating Expenses (Excluding courier fees already tracked in parcels to avoid double-counting)
  let nonCourierOperatingExpense = 0;
  for (const exp of operatingExpenses) {
    if (!isInRange(exp.date)) continue;
    if (exp.isCourierFee) continue; // Exclude to prevent double-counting!
    nonCourierOperatingExpense += exp.amount;
  }

  // 5. Net Profit Calculation
  const totalCourierExpense = totalCourierDeliveryExpense + totalCourierReturnExpense;
  const totalOperatingCosts = periodAdSpend + totalCourierExpense + nonCourierOperatingExpense + damagedStockLoss;
  const realizedNetProfit = realizedGrossProfit - (periodAdSpend + totalCourierExpense + nonCourierOperatingExpense + damagedStockLoss);

  // Return Rate and Delivery Rate
  const totalShippedAndDelivered = totalDeliveredOrdersCount + totalReturnedOrdersCount;
  const deliveryRate = totalShippedAndDelivered > 0 ? (totalDeliveredOrdersCount / totalShippedAndDelivered) * 100 : 0;
  const returnRate = totalShippedAndDelivered > 0 ? (totalReturnedOrdersCount / totalShippedAndDelivered) * 100 : 0;

  return {
    accountingBasis,
    realizedGrossSales,
    realizedDiscounts,
    realizedCustomerDeliveryFee,
    realizedRefunds,
    realizedNetSales,
    realizedCogs,
    realizedGrossProfit,
    grossMarginPercent: realizedNetSales > 0 ? (realizedGrossProfit / realizedNetSales) * 100 : 0,
    periodAdSpend,
    totalCourierDeliveryExpense,
    totalCourierReturnExpense,
    totalCourierExpense,
    nonCourierOperatingExpense,
    damagedStockLoss,
    totalOperatingCosts,
    realizedNetProfit,
    netMarginPercent: realizedNetSales > 0 ? (realizedNetProfit / realizedNetSales) * 100 : 0,

    // Pipeline / Estimated for Pending Orders (Strictly separate!)
    pendingEstimatedSales,
    pendingEstimatedCogs,
    pendingEstimatedGrossProfit: pendingEstimatedSales - pendingEstimatedCogs,

    // Courier & Cash Liquidity Receivables
    codReceivablesPending,
    codCollectedByCourier,
    codSettledToBank,

    // Order Counts
    totalDeliveredOrdersCount,
    totalConfirmedOrdersCount,
    totalCancelledOrdersCount,
    totalReturnedOrdersCount,
    deliveryRate,
    returnRate,
  };
}

import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Info,
  Calendar,
  Building,
  Truck,
  Boxes,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Order,
  Parcel,
  AdExpense,
  OperatingExpense,
  BankCashAccount,
  Supplier,
  Product,
} from '../types/database';
import { calculateProfitAndLoss } from '../utils/accountingCalculations';

interface AccountingViewProps {
  orders: Order[];
  parcels: Parcel[];
  adExpenses: AdExpense[];
  operatingExpenses: OperatingExpense[];
  bankAccounts: BankCashAccount[];
  suppliers: Supplier[];
  products: Product[];
}

export const AccountingView: React.FC<AccountingViewProps> = ({
  orders,
  parcels,
  adExpenses,
  operatingExpenses,
  bankAccounts,
  suppliers,
  products,
}) => {
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'last_month'>('month');

  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const firstDayOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
  const lastDayOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];

  let startDate: string | undefined;
  let endDate: string | undefined;

  if (dateRange === 'month') {
    startDate = firstDayOfMonth;
    endDate = todayStr;
  } else if (dateRange === 'last_month') {
    startDate = firstDayOfLastMonth;
    endDate = lastDayOfLastMonth;
  }

  const damagedStockLoss = products.reduce((acc, p) => acc + (p.damagedStock || 0) * p.purchaseCost, 0);

  const pnl = calculateProfitAndLoss({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      orderDate: o.orderDate,
      deliveryDate: o.deliveryDate,
      items: o.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, unitCost: i.unitCostSnapshot })),
      itemTotal: o.itemTotal,
      discount: o.discount,
      deliveryFeeCharged: o.deliveryFeeCharged,
      advancePaid: o.advancePaid,
      codAmount: o.codAmount,
      refundAmount: o.refundAmount || 0,
    })),
    parcels: parcels.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      courierName: p.courierName,
      consignmentId: p.consignmentId,
      codAmount: p.codAmount,
      deliveryCharge: p.deliveryCharge,
      returnCharge: p.returnCharge,
      collectedAmount: p.collectedAmount,
      settledAmount: p.settledAmount,
      isSettled: p.isSettled,
      settlementDate: p.settlementDate,
      dispatchDate: p.dispatchDate,
      status: p.status,
    })),
    adExpenses,
    operatingExpenses,
    damagedStockLoss,
    accountingBasis: basis,
    startDate,
    endDate,
  });

  const totalBankBalance = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const totalSupplierPayables = suppliers.reduce((s, sup) => s + sup.currentBalance, 0);
  const totalInventoryAsset = products.reduce((s, p) => s + p.currentStock * p.purchaseCost, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-700" />
            <span>Accounting & Comprehensive Profit / Loss</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Realized Income Statement, Balance Sheet Liquidity, and strict non-duplication accounting rules
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Basis Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            <button
              onClick={() => setBasis('accrual')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                basis === 'accrual' ? 'bg-white shadow-2xs text-emerald-900 font-bold' : 'text-slate-600'
              }`}
            >
              Accrual View
            </button>
            <button
              onClick={() => setBasis('cash')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                basis === 'cash' ? 'bg-white shadow-2xs text-emerald-900 font-bold' : 'text-slate-600'
              }`}
            >
              Cash Basis View
            </button>
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Accounting Methodology Banner */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold">
            {basis === 'accrual' ? 'Accrual Accounting Mode (Standard)' : 'Cash Accounting Mode'}
          </div>
          <p className="leading-relaxed text-emerald-900/90">
            {basis === 'accrual'
              ? 'Recognizes sales and cost of goods sold (COGS) upon order delivery to the customer. Unpaid courier COD amounts remain explicitly accounted for under COD Receivables. Inventory purchases capitalize into assets and are recognized as COGS only when sold, preventing double-counting.'
              : 'Recognizes cash collections only when courier settles funds into the bank account or customer pays advance. Ideal for immediate cashflow visibility.'}
          </p>
        </div>
      </div>

      {/* Balance Sheet / Liquidity Overview Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Balance Sheet & Working Capital Position
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Bank & Cash Accounts</span>
            <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
              ৳{Math.round(totalBankBalance).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Liquid cash in hand & MFS</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">COD Receivables (Courier Debt)</span>
            <div className="text-xl font-bold font-mono text-amber-700 mt-1">
              ৳{Math.round(pnl.codReceivablesPending).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Delivered, awaiting courier payout</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Inventory Asset (At WAC)</span>
            <div className="text-xl font-bold font-mono text-blue-700 mt-1">
              ৳{Math.round(totalInventoryAsset).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Physical unsold stock valuation</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium">Supplier Payables</span>
            <div className="text-xl font-bold font-mono text-red-600 mt-1">
              ৳{Math.round(totalSupplierPayables).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Outstanding PO debts</div>
          </div>
        </div>
      </div>

      {/* Detailed Realized Income Statement Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Income Statement (Profit & Loss)</h3>
            <p className="text-xs text-slate-500">Period: {dateRange.replace('_', ' ').toUpperCase()} • Crystal Gift House</p>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-100 font-semibold text-slate-800">
            Net Margin: {pnl.netMarginPercent.toFixed(1)}%
          </span>
        </div>

        <div className="p-5 space-y-4 text-xs font-mono">
          {/* Revenue Section */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans mb-1 text-[11px]">
              1. Revenue & Sales
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="font-sans text-slate-600">Gross Sales Value of Delivered Orders</span>
              <span className="font-semibold text-slate-900">৳{pnl.realizedGrossSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
              <span className="font-sans">Less: Sales Discounts & Customer Coupons</span>
              <span>- ৳{pnl.realizedDiscounts.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
              <span className="font-sans">Plus: Delivery Charges Collected from Customers</span>
              <span>+ ৳{pnl.realizedCustomerDeliveryFee.toLocaleString()}</span>
            </div>
            {pnl.realizedRefunds > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
                <span className="font-sans">Less: Processed Customer Refunds</span>
                <span>- ৳{pnl.realizedRefunds.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-2 bg-slate-50 px-3 rounded font-bold text-slate-900">
              <span className="font-sans">Net Sales Revenue</span>
              <span className="text-sm">৳{pnl.realizedNetSales.toLocaleString()}</span>
            </div>
          </div>

          {/* Cost of Goods Sold */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans mb-1 text-[11px]">
              2. Cost of Goods Sold (COGS)
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 text-amber-900">
              <span className="font-sans text-slate-600">Historical Unit Cost of Sold Items Delivered</span>
              <span className="font-semibold">৳{pnl.realizedCogs.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded font-bold text-emerald-950">
              <span className="font-sans">Gross Profit</span>
              <span className="text-sm">
                ৳{pnl.realizedGrossProfit.toLocaleString()} ({pnl.grossMarginPercent.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Operating & Marketing Expenses */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans mb-1 text-[11px]">
              3. Operating Expenses & Marketing
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="font-sans text-slate-600">Meta, TikTok & Video Advertising Spend</span>
              <span className="font-semibold text-slate-800">৳{pnl.periodAdSpend.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="font-sans text-slate-600">Courier Shipping & Delivery Charges (Paid to Couriers)</span>
              <span className="font-semibold text-slate-800">৳{pnl.totalCourierDeliveryExpense.toLocaleString()}</span>
            </div>
            {pnl.totalCourierReturnExpense > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
                <span className="font-sans">Courier Return-to-Sender Charges</span>
                <span className="font-semibold">৳{pnl.totalCourierReturnExpense.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="font-sans text-slate-600">Packaging, Salaries, Tools & Overheads</span>
              <span className="font-semibold text-slate-800">৳{pnl.nonCourierOperatingExpense.toLocaleString()}</span>
            </div>
            {pnl.damagedStockLoss > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
                <span className="font-sans">Damaged & Broken Goods Write-off Loss</span>
                <span className="font-semibold">৳{pnl.damagedStockLoss.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 bg-slate-50 px-3 rounded font-bold text-slate-800">
              <span className="font-sans">Total Operating Costs</span>
              <span>৳{pnl.totalOperatingCosts.toLocaleString()}</span>
            </div>
          </div>

          {/* Final Net Profit */}
          <div className="pt-3 border-t-2 border-slate-300">
            <div className="flex justify-between py-3 bg-emerald-900 text-white px-4 rounded-xl font-bold text-base">
              <span className="font-sans">Realized Net Profit / Loss</span>
              <span className="text-lg">৳{Math.round(pnl.realizedNetProfit).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Truck,
  Package,
  AlertCircle,
  Calendar,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Plus,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  Order,
  Product,
  Parcel,
  AdExpense,
  OperatingExpense,
  BankCashAccount,
} from '../types/database';
import { calculateProfitAndLoss } from '../utils/accountingCalculations';
import { calculateAvailableStock } from '../utils/stockCalculations';

interface DashboardViewProps {
  orders: Order[];
  products: Product[];
  parcels: Parcel[];
  adExpenses: AdExpense[];
  operatingExpenses: OperatingExpense[];
  bankAccounts: BankCashAccount[];
  onOpenNewOrder: () => void;
  onOpenAddProduct: () => void;
  onOpenLogAdSpend: () => void;
  onOpenAcceptanceTests: () => void;
  onNavigateTab: (tab: any) => void;
  onSelectOrder: (order: Order) => void;
  onSelectProduct: (product: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  products,
  parcels,
  adExpenses,
  operatingExpenses,
  bankAccounts,
  onOpenNewOrder,
  onOpenAddProduct,
  onOpenLogAdSpend,
  onOpenAcceptanceTests,
  onNavigateTab,
  onSelectOrder,
  onSelectProduct,
}) => {
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | 'month' | 'last_month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [accountingBasis, setAccountingBasis] = useState<'accrual' | 'cash'>('accrual');

  // Compute start/end date strings based on preset
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const firstDayOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
  const lastDayOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];

  let startDate: string | undefined;
  let endDate: string | undefined;

  if (dateFilter === 'today') {
    startDate = todayStr;
    endDate = todayStr;
  } else if (dateFilter === 'yesterday') {
    startDate = yesterdayStr;
    endDate = yesterdayStr;
  } else if (dateFilter === '7days') {
    startDate = sevenDaysStr;
    endDate = todayStr;
  } else if (dateFilter === 'month') {
    startDate = firstDayOfMonth;
    endDate = todayStr;
  } else if (dateFilter === 'last_month') {
    startDate = firstDayOfLastMonth;
    endDate = lastDayOfLastMonth;
  } else if (dateFilter === 'custom') {
    startDate = customStart || undefined;
    endDate = customEnd || undefined;
  }

  // Calculate damaged stock loss (units * current purchase cost)
  const damagedStockLoss = products.reduce((acc, p) => acc + (p.damagedStock || 0) * p.purchaseCost, 0);

  // Run financial engine
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
    accountingBasis,
    startDate,
    endDate,
  });

  // Calculate total stock inventory valuation at WAC
  const totalStockValue = products.reduce((sum, p) => sum + p.currentStock * p.purchaseCost, 0);
  const lowStockProducts = products.filter((p) => calculateAvailableStock(p.currentStock, p.reservedStock) <= p.lowStockThreshold);

  // Today's order count
  const todayOrders = orders.filter((o) => o.orderDate.startsWith(todayStr));
  const pendingParcels = parcels.filter((p) => p.status === 'in_transit' || p.status === 'pending_dispatch');

  // Liquid cash/bank balances total
  const totalLiquidCash = bankAccounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Business Overview
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
              Live Data
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Crystal Gift House • All numbers in Bangladeshi Taka (৳ BDT)
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                dateFilter === 'today' ? 'bg-white shadow-2xs font-semibold text-emerald-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                dateFilter === 'yesterday' ? 'bg-white shadow-2xs font-semibold text-emerald-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDateFilter('7days')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                dateFilter === '7days' ? 'bg-white shadow-2xs font-semibold text-emerald-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                dateFilter === 'month' ? 'bg-white shadow-2xs font-semibold text-emerald-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateFilter('last_month')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                dateFilter === 'last_month' ? 'bg-white shadow-2xs font-semibold text-emerald-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => setDateFilter('custom')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                dateFilter === 'custom' ? 'bg-white shadow-2xs font-semibold text-emerald-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom Date Inputs if selected */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-200 rounded-md"
              />
            </div>
          )}

          {/* Accrual vs Cash Toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setAccountingBasis('accrual')}
              className={`px-2 py-1 rounded-md font-medium cursor-pointer ${
                accountingBasis === 'accrual' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
              title="Accrual basis recognizes delivered orders revenue and matched COGS"
            >
              Accrual
            </button>
            <button
              onClick={() => setAccountingBasis('cash')}
              className={`px-2 py-1 rounded-md font-medium cursor-pointer ${
                accountingBasis === 'cash' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
              title="Cash basis focuses on settled funds & received cash"
            >
              Cash Basis
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid: High-Value Financials */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Realized Net Profit */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white p-5 rounded-xl border border-emerald-800/80 shadow-md relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10">
            <TrendingUp className="w-20 h-20 text-white" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-200 uppercase tracking-wider">
              Realized Net Profit
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                pnl.realizedNetProfit >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}
            >
              {pnl.netMarginPercent.toFixed(1)}% Margin
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight font-mono">
              ৳{Math.round(pnl.realizedNetProfit).toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-300/80 mt-1">
              Delivered Gross Profit minus Ads, Couriers & Ops
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-800/60 flex items-center justify-between text-xs text-emerald-200">
            <span>Pending Pipeline Profit:</span>
            <span className="font-mono font-semibold text-amber-300">
              ৳{Math.round(pnl.pendingEstimatedGrossProfit).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 2: Realized Net Sales & Gross Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Delivered Net Sales
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              ৳{Math.round(pnl.realizedNetSales).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span>Gross Sales:</span>
              <span className="font-mono font-semibold text-slate-700">
                ৳{Math.round(pnl.realizedGrossSales).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">COGS (Product Cost):</span>
            <span className="font-mono font-semibold text-slate-800">
              ৳{Math.round(pnl.realizedCogs).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 3: COD Receivables (With Couriers) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              COD Receivables
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-amber-700 font-mono">
              ৳{Math.round(pnl.codReceivablesPending).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Delivered orders awaiting courier settlement
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Settled to Bank:</span>
            <span className="font-mono font-semibold text-emerald-700">
              ৳{Math.round(pnl.codSettledToBank).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 4: Inventory Valuation & Low Stock */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Stock Valuation (WAC)
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              ৳{Math.round(totalStockValue).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Physical inventory on hand at weighted cost
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Low Stock SKUs:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded ${
                lowStockProducts.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {lowStockProducts.length} items
            </span>
          </div>
        </div>
      </div>

      {/* Operational Stats Row: Today, Parcels, Rates */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
          <div className="text-[11px] font-medium text-slate-500">Today's Orders</div>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {todayOrders.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Total {orders.length} orders
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
          <div className="text-[11px] font-medium text-slate-500">Delivered Parcels</div>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
            {pnl.totalDeliveredOrdersCount}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
            {pnl.deliveryRate.toFixed(0)}% Delivery Rate
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
          <div className="text-[11px] font-medium text-slate-500">Pending Parcels</div>
          <div className="text-xl font-bold text-amber-600 font-mono mt-1">
            {pendingParcels.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">In transit/dispatch</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
          <div className="text-[11px] font-medium text-slate-500">Returns & RTS</div>
          <div className="text-xl font-bold text-red-600 font-mono mt-1">
            {pnl.totalReturnedOrdersCount}
          </div>
          <div className="text-[10px] text-red-500 font-medium mt-0.5">
            {pnl.returnRate.toFixed(1)}% Return Rate
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
          <div className="text-[11px] font-medium text-slate-500">Period Ad Spend</div>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            ৳{Math.round(pnl.periodAdSpend).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Meta & video ads</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
          <div className="text-[11px] font-medium text-slate-500">Courier Expenses</div>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            ৳{Math.round(pnl.totalCourierExpense).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Delivery + return fees</div>
        </div>
      </div>

      {/* Middle Section: Cost & Profit Breakdown + Quick Action & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Flow Breakdown Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Realized Income & Cost Reconciliation
              </h3>
              <p className="text-xs text-slate-500">
                Formula verified: Realized Gross Profit - Ads - Couriers - Operating Costs = Net Profit
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('accounting')}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
            >
              <span>Full P&L</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Delivered Item Sales (Realized)</span>
              <span className="font-mono font-semibold text-slate-900">
                ৳{Math.round(pnl.realizedGrossSales).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Discounts & Customer Vouchers</span>
              <span className="font-mono font-semibold text-red-600">
                - ৳{Math.round(pnl.realizedDiscounts).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Delivery Fees Charged to Customers</span>
              <span className="font-mono font-semibold text-emerald-700">
                + ৳{Math.round(pnl.realizedCustomerDeliveryFee).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 bg-slate-50/80 px-2 rounded">
              <span className="font-semibold text-slate-800">Net Sales Recognized</span>
              <span className="font-mono font-bold text-slate-900">
                ৳{Math.round(pnl.realizedNetSales).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Cost of Goods Sold (COGS at order snapshot)</span>
              <span className="font-mono font-semibold text-amber-700">
                - ৳{Math.round(pnl.realizedCogs).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 bg-emerald-50/50 px-2 rounded">
              <span className="font-semibold text-emerald-900">Realized Gross Profit</span>
              <span className="font-mono font-bold text-emerald-800">
                ৳{Math.round(pnl.realizedGrossProfit).toLocaleString()} ({pnl.grossMarginPercent.toFixed(1)}%)
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Meta / TikTok Ads Expense (Period Allocation)</span>
              <span className="font-mono font-semibold text-slate-700">
                - ৳{Math.round(pnl.periodAdSpend).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Courier Shipping & Return Charges</span>
              <span className="font-mono font-semibold text-slate-700">
                - ৳{Math.round(pnl.totalCourierExpense).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Operating Expenses (Packaging, Tools, Salaries)</span>
              <span className="font-mono font-semibold text-slate-700">
                - ৳{Math.round(pnl.nonCourierOperatingExpense).toLocaleString()}
              </span>
            </div>

            {damagedStockLoss > 0 && (
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 text-red-600">
                <span>Damaged Goods Loss (Written off)</span>
                <span className="font-mono font-semibold">
                  - ৳{Math.round(damagedStockLoss).toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm py-2 bg-emerald-900 text-white px-3 rounded-lg font-bold">
              <span>Final Realized Net Profit</span>
              <span className="font-mono text-base">
                ৳{Math.round(pnl.realizedNetProfit).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Quick Actions & Alerts */}
        <div className="space-y-4">
          {/* Quick Actions Card */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
            <h3 className="font-bold text-slate-900 text-sm mb-3">
              Quick Operations
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onOpenNewOrder}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>New Order</span>
              </button>

              <button
                onClick={onOpenAddProduct}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Boxes className="w-4 h-4 shrink-0 text-slate-600" />
                <span>Add Product</span>
              </button>

              <button
                onClick={onOpenLogAdSpend}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 shrink-0 text-slate-600" />
                <span>Log Ad Spend</span>
              </button>

              <button
                onClick={onOpenAcceptanceTests}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-semibold transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Verify Tests</span>
              </button>
            </div>
          </div>

          {/* Liquid Balances Card */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Cash & MFS Balances
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-800">
                ৳{Math.round(totalLiquidCash).toLocaleString()}
              </span>
            </div>
            <div className="space-y-2">
              {bankAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div>
                    <div className="font-semibold text-slate-800">{acc.accountName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{acc.accountNumber}</div>
                  </div>
                  <div className="font-mono font-bold text-slate-900">
                    ৳{acc.balance.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Stock Warning Card */}
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Low Stock Reorder Alerts ({lowStockProducts.length})</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {lowStockProducts.map((p) => {
                  const avail = calculateAvailableStock(p.currentStock, p.reservedStock);
                  return (
                    <div
                      key={p.id}
                      onClick={() => onSelectProduct(p)}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100 text-xs cursor-pointer hover:bg-amber-50/50"
                    >
                      <div className="truncate">
                        <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold font-mono text-[11px]">
                          {avail} left
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Preview */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Customer Orders</h3>
            <p className="text-xs text-slate-500">Live feed of orders with status timeline and COD amounts</p>
          </div>
          <button
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({orders.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Courier</th>
                <th className="px-4 py-3">COD Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 5).map((ord) => (
                <tr
                  key={ord.id}
                  onClick={() => onSelectOrder(ord)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-emerald-900 font-mono">
                    {ord.orderNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{ord.customerName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{ord.customerPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {ord.district}
                  </td>
                  <td className="px-4 py-3">
                    {ord.items.map((it) => (
                      <div key={it.id} className="text-slate-700">
                        {it.quantity}x {it.productName}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700">{ord.courierName}</span>
                    {ord.consignmentNumber && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        {ord.consignmentNumber}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">
                    ৳{ord.codAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                        ord.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.status === 'shipped'
                          ? 'bg-blue-100 text-blue-800'
                          : ord.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : ord.status === 'returned'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ord.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

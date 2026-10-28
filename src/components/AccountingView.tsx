import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Info,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building2,
  Smartphone,
  Banknote,
  Plus,
  Search,
  Download,
  Edit3,
  Trash2,
  X,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRightLeft,
} from 'lucide-react';
import {
  Order,
  Parcel,
  AdExpense,
  OperatingExpense,
  BankCashAccount,
  Supplier,
  Product,
  CashTransaction,
  CashTransactionType,
} from '../types/database';
import { calculateProfitAndLoss } from '../utils/accountingCalculations';

interface AccountingViewProps {
  orders: Order[];
  parcels: Parcel[];
  adExpenses: AdExpense[];
  operatingExpenses: OperatingExpense[];
  bankAccounts: BankCashAccount[];
  cashTransactions?: CashTransaction[];
  suppliers: Supplier[];
  products: Product[];
  onSaveCashTransaction?: (input: {
    id?: string;
    date: string;
    type: CashTransactionType;
    category: string;
    amount: number;
    accountId: string;
    reference?: string;
    partyName?: string;
    supplierId?: string;
    notes?: string;
  }) => { success: boolean; transaction?: CashTransaction; error?: string };
  onDeleteCashTransaction?: (txId: string) => { success: boolean; error?: string };
  onSaveBankAccount?: (input: {
    id?: string;
    accountName: string;
    accountNumber: string;
    balance: number;
    accountType: 'bank' | 'mfs' | 'cash';
  }) => BankCashAccount;
  onDeleteBankAccount?: (accountId: string) => { success: boolean; error?: string };
}

const CASH_IN_CATEGORIES = [
  'Order Advance / Sales Collection',
  'Courier COD Settlement',
  'Capital / Owner Deposit',
  'Wholesale / Bulk Order Receipt',
  'Supplier Refund Received',
  'Other Cash In',
];

const CASH_OUT_CATEGORIES = [
  'Supplier Payment',
  'Owner Withdrawal / Drawings',
  'Advertising & Marketing Payment',
  'Courier & Delivery Payout',
  'Packaging & Box Purchase',
  'Office Rent & Utilities',
  'Staff Salary & Wages',
  'Customer Refund Paid',
  'Other Cash Out',
];

export const AccountingView: React.FC<AccountingViewProps> = ({
  orders,
  parcels,
  adExpenses,
  operatingExpenses,
  bankAccounts,
  cashTransactions = [],
  suppliers,
  products,
  onSaveCashTransaction,
  onDeleteCashTransaction,
  onSaveBankAccount,
  onDeleteBankAccount,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'cashbook' | 'pnl'>('cashbook');
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'last_month' | 'today'>('all');

  // Cashbook Filters
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'cash_in' | 'cash_out'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cash In / Cash Out Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txType, setTxType] = useState<CashTransactionType>('cash_in');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txCategory, setTxCategory] = useState<string>(CASH_IN_CATEGORIES[0]);
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txAccountId, setTxAccountId] = useState<string>(bankAccounts[0]?.id || '');
  const [txPartyName, setTxPartyName] = useState<string>('');
  const [txSupplierId, setTxSupplierId] = useState<string>('');
  const [txReference, setTxReference] = useState<string>('');
  const [txNotes, setTxNotes] = useState<string>('');

  // Bank / Cash Account Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accName, setAccName] = useState<string>('');
  const [accNumber, setAccNumber] = useState<string>('');
  const [accBalance, setAccBalance] = useState<number>(0);
  const [accType, setAccType] = useState<'bank' | 'mfs' | 'cash'>('mfs');

  // Confirmation Dialog
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setBannerNotice({ type, text });
    setTimeout(() => setBannerNotice(null), 4000);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const firstDayOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
  const lastDayOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];

  let startDate: string | undefined;
  let endDate: string | undefined;

  if (dateRange === 'today') {
    startDate = todayStr;
    endDate = todayStr;
  } else if (dateRange === 'month') {
    startDate = firstDayOfMonth;
    endDate = todayStr;
  } else if (dateRange === 'last_month') {
    startDate = firstDayOfLastMonth;
    endDate = lastDayOfLastMonth;
  }

  // Filtered Cash Transactions
  const filteredTransactions = useMemo(() => {
    return cashTransactions.filter((tx) => {
      if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
      if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          tx.transactionNumber.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.accountName.toLowerCase().includes(q) ||
          (tx.partyName || '').toLowerCase().includes(q) ||
          (tx.reference || '').toLowerCase().includes(q) ||
          (tx.notes || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [cashTransactions, txTypeFilter, accountFilter, startDate, endDate, searchQuery]);

  // Cashbook Totals
  const cashSummary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let inCount = 0;
    let outCount = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'cash_in') {
        totalIn += tx.amount;
        inCount++;
      } else {
        totalOut += tx.amount;
        outCount++;
      }
    }
    return {
      totalIn,
      totalOut,
      netFlow: totalIn - totalOut,
      inCount,
      outCount,
    };
  }, [filteredTransactions]);

  // Per-account Cash In / Cash Out stats
  const accountStatsMap = useMemo(() => {
    const map: Record<string, { cashIn: number; cashOut: number; count: number }> = {};
    for (const acc of bankAccounts) {
      map[acc.id] = { cashIn: 0, cashOut: 0, count: 0 };
    }
    for (const tx of cashTransactions) {
      if (!map[tx.accountId]) {
        map[tx.accountId] = { cashIn: 0, cashOut: 0, count: 0 };
      }
      if (tx.type === 'cash_in') {
        map[tx.accountId].cashIn += tx.amount;
      } else {
        map[tx.accountId].cashOut += tx.amount;
      }
      map[tx.accountId].count++;
    }
    return map;
  }, [bankAccounts, cashTransactions]);

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

  // Open Cash In / Cash Out Modal
  const openNewTxModal = (type: CashTransactionType, preselectedAccountId?: string) => {
    setEditingTxId(null);
    setTxType(type);
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxCategory(type === 'cash_in' ? CASH_IN_CATEGORIES[0] : CASH_OUT_CATEGORIES[0]);
    setTxAmount(0);
    setTxAccountId(preselectedAccountId || bankAccounts[0]?.id || '');
    setTxPartyName('');
    setTxSupplierId('');
    setTxReference('');
    setTxNotes('');
    setIsTxModalOpen(true);
  };

  const openEditTxModal = (tx: CashTransaction) => {
    setEditingTxId(tx.id);
    setTxType(tx.type);
    setTxDate(tx.date);
    setTxCategory(tx.category);
    setTxAmount(tx.amount);
    setTxAccountId(tx.accountId);
    setTxPartyName(tx.partyName || '');
    setTxSupplierId('');
    setTxReference(tx.reference || '');
    setTxNotes(tx.notes || '');
    setIsTxModalOpen(true);
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveCashTransaction) return;
    const res = onSaveCashTransaction({
      id: editingTxId || undefined,
      date: txDate,
      type: txType,
      category: txCategory,
      amount: txAmount,
      accountId: txAccountId,
      reference: txReference,
      partyName: txPartyName,
      supplierId: txSupplierId || undefined,
      notes: txNotes,
    });
    if (!res.success) {
      showNotice('error', res.error || 'Failed to save transaction.');
      return;
    }
    setIsTxModalOpen(false);
    showNotice(
      'success',
      editingTxId
        ? `Updated ${txType === 'cash_in' ? 'Cash In' : 'Cash Out'} transaction.`
        : `Recorded ${txType === 'cash_in' ? 'Cash In (+৳' : 'Cash Out (-৳'}${txAmount.toLocaleString()}) in Cashbook.`
    );
  };

  const handleDeleteTxClick = (tx: CashTransaction) => {
    setConfirmDelete({
      title: 'Delete Cash Transaction',
      message: `Are you sure you want to delete ${tx.transactionNumber} (${
        tx.type === 'cash_in' ? 'Cash In +৳' : 'Cash Out -৳'
      }${tx.amount.toLocaleString()} • ${tx.category})? This will automatically reverse the ৳${tx.amount.toLocaleString()} balance impact on "${
        tx.accountName
      }".`,
      onConfirm: () => {
        if (onDeleteCashTransaction) {
          onDeleteCashTransaction(tx.id);
          showNotice('success', `Deleted ${tx.transactionNumber} and reconciled ${tx.accountName} balance.`);
        }
        setConfirmDelete(null);
      },
    });
  };

  // Bank Account Modal Helpers
  const openAddAccountModal = () => {
    setEditingAccountId(null);
    setAccName('');
    setAccNumber('');
    setAccBalance(0);
    setAccType('mfs');
    setIsAccountModalOpen(true);
  };

  const openEditAccountModal = (acc: BankCashAccount) => {
    setEditingAccountId(acc.id);
    setAccName(acc.accountName);
    setAccNumber(acc.accountNumber);
    setAccBalance(acc.balance);
    setAccType(acc.accountType);
    setIsAccountModalOpen(true);
  };

  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveBankAccount || !accName.trim()) return;
    onSaveBankAccount({
      id: editingAccountId || undefined,
      accountName: accName.trim(),
      accountNumber: accNumber.trim(),
      balance: accBalance,
      accountType: accType,
    });
    setIsAccountModalOpen(false);
    showNotice('success', editingAccountId ? `Updated account "${accName}".` : `Added account "${accName}".`);
  };

  const handleExportCashbookCSV = () => {
    const headers = [
      'Transaction Number',
      'Date',
      'Type',
      'Category',
      'Account Name',
      'Party / Payee / Payer',
      'Reference',
      'Amount (BDT)',
      'Balance Before (BDT)',
      'Balance After (BDT)',
      'Notes',
    ];
    const rows = filteredTransactions.map((tx) => [
      tx.transactionNumber,
      tx.date,
      tx.type === 'cash_in' ? 'CASH IN' : 'CASH OUT',
      `"${(tx.category || '').replace(/"/g, '""')}"`,
      `"${(tx.accountName || '').replace(/"/g, '""')}"`,
      `"${(tx.partyName || '').replace(/"/g, '""')}"`,
      `"${(tx.reference || '').replace(/"/g, '""')}"`,
      tx.type === 'cash_in' ? tx.amount : -tx.amount,
      tx.balanceBefore,
      tx.balanceAfter,
      `"${(tx.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cgh_cashbook_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {bannerNotice && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{bannerNotice.text}</span>
          <button onClick={() => setBannerNotice(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-700" />
            <span>Accounting, Cash In / Cash Out & Profit / Loss</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track every Cash In receipt & Cash Out withdrawal across bKash, Nagad, Bank, and Counter Cash with full P&L
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sub-Tab Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('cashbook')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'cashbook' ? 'bg-white shadow-2xs text-emerald-900 font-bold' : 'text-slate-600'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-700" />
              <span>Cash In & Cash Out ({cashTransactions.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('pnl')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'pnl' ? 'bg-white shadow-2xs text-emerald-900 font-bold' : 'text-slate-600'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Income Statement (P&L)</span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <button
            onClick={() => openNewTxModal('cash_in')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Cash In (Receive)</span>
          </button>

          <button
            onClick={() => openNewTxModal('cash_out')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>- Cash Out (Withdraw)</span>
          </button>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>
        </div>
      </div>

      {activeSubTab === 'cashbook' ? (
        <div className="space-y-6">
          {/* Cashflow Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Liquid Cash & Bank
                </span>
                <Wallet className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                ৳{Math.round(totalBankBalance).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Across {bankAccounts.length} active accounts
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Total Cash In (Received)
                </span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                +৳{Math.round(cashSummary.totalIn).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {cashSummary.inCount} cash-in receipt{cashSummary.inCount === 1 ? '' : 's'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-red-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                  Total Cash Out (Withdrawn)
                </span>
                <ArrowUpRight className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-xl font-bold font-mono text-red-600 mt-1">
                -৳{Math.round(cashSummary.totalOut).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {cashSummary.outCount} cash-out payout{cashSummary.outCount === 1 ? '' : 's'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Net Cash Movement
                </span>
                <ArrowRightLeft className="w-4 h-4 text-slate-500" />
              </div>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  cashSummary.netFlow >= 0 ? 'text-emerald-800' : 'text-red-600'
                }`}
              >
                {cashSummary.netFlow >= 0 ? '+' : '-'}৳{Math.abs(Math.round(cashSummary.netFlow)).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Cash In minus Cash Out in selected period
              </div>
            </div>
          </div>

          {/* Accounts & Balances Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Cash, MFS & Bank Account Balances ({bankAccounts.length})
              </h3>
              {onSaveBankAccount && (
                <button
                  onClick={openAddAccountModal}
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Cash / Bank Account</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {bankAccounts.map((acc) => {
                const stats = accountStatsMap[acc.id] || { cashIn: 0, cashOut: 0, count: 0 };
                return (
                  <div
                    key={acc.id}
                    className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-700">
                            {acc.accountType === 'mfs'
                              ? 'Mobile Banking'
                              : acc.accountType === 'bank'
                              ? 'Bank Account'
                              : 'Physical Cash'}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm mt-1.5">{acc.accountName}</h4>
                          <p className="text-[11px] font-mono text-slate-400">{acc.accountNumber}</p>
                        </div>
                        {onSaveBankAccount && (
                          <button
                            onClick={() => openEditAccountModal(acc)}
                            title="Edit Account Details"
                            className="p-1 text-slate-400 hover:text-emerald-700 rounded cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Available Balance</div>
                        <div
                          className={`text-lg font-bold font-mono ${
                            acc.balance >= 0 ? 'text-emerald-900' : 'text-red-600'
                          }`}
                        >
                          ৳{Math.round(acc.balance).toLocaleString()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] font-mono bg-slate-50 p-2 rounded-lg">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-sans">Cash In</span>
                          <span className="text-emerald-700 font-semibold">+৳{stats.cashIn.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-sans">Cash Out</span>
                          <span className="text-red-600 font-semibold">-৳{stats.cashOut.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={() => openNewTxModal('cash_in', acc.id)}
                        className="px-2 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ArrowDownLeft className="w-3 h-3" />
                        <span>Cash In</span>
                      </button>
                      <button
                        onClick={() => openNewTxModal('cash_out', acc.id)}
                        className="px-2 py-1 text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        <span>Cash Out</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cash In / Cash Out Transaction History Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Cash In & Cash Out Transaction History</h3>
                <p className="text-xs text-slate-500">
                  Complete audit trail of all cash received, deposited, withdrawn, or paid out
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Type Filter */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                  <button
                    onClick={() => setTxTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                      txTypeFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    All ({cashTransactions.length})
                  </button>
                  <button
                    onClick={() => setTxTypeFilter('cash_in')}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                      txTypeFilter === 'cash_in' ? 'bg-emerald-700 text-white' : 'text-emerald-700'
                    }`}
                  >
                    Cash In
                  </button>
                  <button
                    onClick={() => setTxTypeFilter('cash_out')}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                      txTypeFilter === 'cash_out' ? 'bg-red-600 text-white' : 'text-red-600'
                    }`}
                  >
                    Cash Out
                  </button>
                </div>

                {/* Account Filter */}
                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="all">All Accounts</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName}
                    </option>
                  ))}
                </select>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search TXN, category, party..."
                    className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-600 w-48"
                  />
                </div>

                <button
                  onClick={handleExportCashbookCSV}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">TXN #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Party / Reference</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Balance Impact</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No cash transactions found matching your filters. Use "+ Cash In" or "- Cash Out" to record a transaction.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{tx.transactionNumber}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{tx.date}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tx.type === 'cash_in'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {tx.type === 'cash_in' ? (
                              <>
                                <ArrowDownLeft className="w-3 h-3" />
                                <span>CASH IN</span>
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="w-3 h-3" />
                                <span>CASH OUT</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{tx.category}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{tx.partyName || '—'}</div>
                          {tx.reference && (
                            <div className="text-[10px] font-mono text-slate-400">Ref: {tx.reference}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">{tx.accountName}</td>
                        <td
                          className={`px-4 py-3 text-right font-mono font-bold ${
                            tx.type === 'cash_in' ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {tx.type === 'cash_in' ? '+' : '-'}৳{tx.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">
                          ৳{Math.round(tx.balanceBefore).toLocaleString()} →{' '}
                          <strong className="text-slate-800">৳{Math.round(tx.balanceAfter).toLocaleString()}</strong>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={tx.notes}>
                          {tx.notes || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditTxModal(tx)}
                              title="Edit Transaction"
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTxClick(tx)}
                              title="Delete Transaction"
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* P&L and Balance Sheet View */
        <div className="space-y-6">
          {/* Basis Toggle Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">
                  {basis === 'accrual' ? 'Accrual Accounting Mode (Standard)' : 'Cash Accounting Mode'}
                </div>
                <p className="leading-relaxed text-emerald-900/90">
                  {basis === 'accrual'
                    ? 'Recognizes sales and cost of goods sold (COGS) upon order delivery to the customer. Unpaid courier COD amounts remain explicitly accounted for under COD Receivables.'
                    : 'Recognizes cash collections only when courier settles funds into the bank account or customer pays advance.'}
                </p>
              </div>
            </div>

            <div className="inline-flex rounded-lg border border-emerald-300 bg-white p-1 text-xs font-semibold shrink-0">
              <button
                onClick={() => setBasis('accrual')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  basis === 'accrual' ? 'bg-emerald-800 text-white font-bold' : 'text-slate-600'
                }`}
              >
                Accrual View
              </button>
              <button
                onClick={() => setBasis('cash')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  basis === 'cash' ? 'bg-emerald-800 text-white font-bold' : 'text-slate-600'
                }`}
              >
                Cash Basis View
              </button>
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
                <p className="text-xs text-slate-500">
                  Period: {dateRange.replace('_', ' ').toUpperCase()} • Crystal Gift House
                </p>
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
      )}

      {/* Cash In / Cash Out Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div
              className={`px-5 py-4 text-white flex items-center justify-between ${
                txType === 'cash_in' ? 'bg-emerald-950' : 'bg-red-950'
              }`}
            >
              <div className="flex items-center gap-2">
                {txType === 'cash_in' ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-red-400" />
                )}
                <h3 className="font-bold text-sm">
                  {editingTxId
                    ? `Edit ${txType === 'cash_in' ? 'Cash In' : 'Cash Out'} Transaction`
                    : txType === 'cash_in'
                    ? 'Record Cash In (Money Received)'
                    : 'Record Cash Out (Money Withdrawn / Paid)'}
                </h3>
              </div>
              <button onClick={() => setIsTxModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTxSubmit} className="p-5 space-y-3.5 text-xs">
              {/* Transaction Type Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTxType('cash_in');
                    setTxCategory(CASH_IN_CATEGORIES[0]);
                  }}
                  className={`py-2 rounded-md font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    txType === 'cash_in' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>+ Cash In (Receive)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('cash_out');
                    setTxCategory(CASH_OUT_CATEGORIES[0]);
                  }}
                  className={`py-2 rounded-md font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    txType === 'cash_out' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>- Cash Out (Withdraw)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Amount (৳ BDT) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={txAmount || ''}
                    onChange={(e) => setTxAmount(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold text-sm text-slate-900 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {txType === 'cash_in' ? 'Deposit To Account *' : 'Withdraw From Account *'}
                  </label>
                  <select
                    value={txAccountId}
                    onChange={(e) => setTxAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  >
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} (৳{acc.balance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category *</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  >
                    {(txType === 'cash_in' ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Supplier Link when Supplier Payment is chosen */}
              {txType === 'cash_out' && txCategory === 'Supplier Payment' && !editingTxId && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                  <label className="block font-bold text-amber-950 mb-1">
                    Link to Supplier (Automatically deducts from Supplier Payable Balance)
                  </label>
                  <select
                    value={txSupplierId}
                    onChange={(e) => {
                      setTxSupplierId(e.target.value);
                      const sup = suppliers.find((s) => s.id === e.target.value);
                      if (sup) setTxPartyName(sup.name);
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg outline-none"
                  >
                    <option value="">-- Optional: Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — Current Payable: ৳{s.currentBalance.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {txType === 'cash_in' ? 'Received From (Payer / Customer)' : 'Paid To (Payee / Recipient)'}
                  </label>
                  <input
                    type="text"
                    value={txPartyName}
                    onChange={(e) => setTxPartyName(e.target.value)}
                    placeholder={txType === 'cash_in' ? 'e.g. Steadfast / Customer Name' : 'e.g. Supplier / Owner'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Reference / TrxID / Voucher #</label>
                  <input
                    type="text"
                    value={txReference}
                    onChange={(e) => setTxReference(e.target.value)}
                    placeholder="e.g. bKash TrxID or Invoice #"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Additional details for audit history..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white font-bold rounded-lg cursor-pointer ${
                    txType === 'cash_in' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {editingTxId
                    ? 'Save Changes'
                    : txType === 'cash_in'
                    ? `Record Cash In (+৳${(txAmount || 0).toLocaleString()})`
                    : `Record Cash Out (-৳${(txAmount || 0).toLocaleString()})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Bank or Cash Account Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingAccountId ? 'Edit Cash / Bank Account' : 'Add Cash / Bank Account'}
              </h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="e.g. Dutch-Bangla Bank / Rocket Personal"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Account Type *</label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                >
                  <option value="mfs">Mobile Financial Service (bKash / Nagad / Rocket)</option>
                  <option value="bank">Commercial Bank Account</option>
                  <option value="cash">Physical Cash / Drawer</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Account Number / Identifier *</label>
                <input
                  type="text"
                  required
                  value={accNumber}
                  onChange={(e) => setAccNumber(e.target.value)}
                  placeholder="e.g. 018XXXXXXXX or A/C Number"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Current Balance (৳ BDT) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={accBalance}
                  onChange={(e) => setAccBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  {editingAccountId ? 'Update Account' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{confirmDelete.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{confirmDelete.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete.onConfirm}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Delete & Reverse Balance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

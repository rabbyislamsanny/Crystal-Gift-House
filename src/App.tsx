import React, { useState, useEffect } from 'react';
import { db } from './db/database';
import {
  DatabaseState,
  Order,
  Product,
  OrderStatus,
  ReturnDisposition,
} from './types/database';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { NewOrderModal } from './components/NewOrderModal';
import { OrderDetailModal } from './components/OrderDetailModal';
import { PrintInvoiceModal } from './components/PrintInvoiceModal';
import { InventoryView } from './components/InventoryView';
import { PurchasesView } from './components/PurchasesView';
import { ParcelsView } from './components/ParcelsView';
import { AdvertisingView } from './components/AdvertisingView';
import { ExpensesView } from './components/ExpensesView';
import { AccountingView } from './components/AccountingView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { AcceptanceTestsModal } from './components/AcceptanceTestsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { calculateAvailableStock } from './utils/stockCalculations';

export default function App() {
  const [dbState, setDbState] = useState<DatabaseState>(() => db.getState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [isAcceptanceModalOpen, setIsAcceptanceModalOpen] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    onConfirm: () => {},
  });

  const refreshState = () => {
    const updated = db.getState();
    setDbState(updated);
    if (selectedOrder) {
      const refreshedOrder = updated.orders.find((o) => o.id === selectedOrder.id);
      setSelectedOrder(refreshedOrder || null);
    }
  };

  // Handlers
  const handleCreateOrder = (orderData: any) => {
    const res = db.createOrder(orderData);
    refreshState();
    return res;
  };

  const handleUpdateOrderStatus = (params: {
    orderId: string;
    newStatus: OrderStatus;
    note?: string;
    returnDisposition?: ReturnDisposition;
    cancelReason?: string;
  }) => {
    const res = db.updateOrderStatus(params);
    refreshState();
    return res;
  };

  const handleBulkUpdateStatus = (orderIds: string[], newStatus: OrderStatus) => {
    for (const id of orderIds) {
      db.updateOrderStatus({ orderId: id, newStatus });
    }
    refreshState();
  };

  const handleSaveProduct = (productData: any) => {
    const saved = db.saveProduct(productData);
    refreshState();
    return saved;
  };

  const handleDeleteProduct = (productId: string) => {
    const res = db.deleteProduct(productId);
    refreshState();
    return res;
  };

  const handleUpdateOrder = (orderId: string, updates: any) => {
    const res = db.updateOrder(orderId, updates);
    refreshState();
    return res;
  };

  const handleDeleteOrder = (orderId: string) => {
    const res = db.deleteOrder(orderId);
    refreshState();
    return res;
  };

  const handleAdjustStock = (params: { productId: string; newOnHand: number; reason: string }) => {
    const res = db.adjustStock(params);
    refreshState();
    return res;
  };

  const handleCreatePO = (poData: any) => {
    const res = db.createPurchaseOrder(poData);
    refreshState();
    return res;
  };

  const handleDeletePO = (poId: string) => {
    const res = db.deletePurchaseOrder(poId);
    refreshState();
    return res;
  };

  const handleReceiveGoods = (poId: string) => {
    const res = db.receivePurchaseOrderGoods(poId);
    refreshState();
    return res;
  };

  const handleSaveSupplier = (supData: any) => {
    const res = db.saveSupplier(supData);
    refreshState();
    return res;
  };

  const handleDeleteSupplier = (supId: string) => {
    const res = db.deleteSupplier(supId);
    refreshState();
    return res;
  };

  const handleRecordSupplierPayment = (input: {
    supplierId: string;
    supplierName: string;
    amount: number;
    accountId: string;
    date: string;
    reference?: string;
    notes?: string;
  }) => {
    const res = db.saveCashTransaction({
      date: input.date,
      type: 'cash_out',
      category: 'Supplier Payment',
      amount: input.amount,
      accountId: input.accountId,
      reference: input.reference,
      partyName: input.supplierName,
      supplierId: input.supplierId,
      notes: input.notes,
    });
    refreshState();
    return res;
  };

  const handleSaveCashTransaction = (txData: any) => {
    const res = db.saveCashTransaction(txData);
    refreshState();
    return res;
  };

  const handleDeleteCashTransaction = (txId: string) => {
    const res = db.deleteCashTransaction(txId);
    refreshState();
    return res;
  };

  const handleSaveBankAccount = (accData: any) => {
    const res = db.saveBankAccount(accData);
    refreshState();
    return res;
  };

  const handleDeleteBankAccount = (accId: string) => {
    const res = db.deleteBankAccount(accId);
    refreshState();
    return res;
  };

  const handleSettleParcels = (parcelIds: string[], bankAccountId: string, notes?: string) => {
    const res = db.settleParcels(parcelIds, bankAccountId, notes);
    refreshState();
    return res;
  };

  const handleSaveAdExpense = (adData: any) => {
    const res = db.saveAdExpense(adData);
    refreshState();
    return res;
  };

  const handleDeleteAdExpense = (adId: string) => {
    const res = db.deleteAdExpense(adId);
    refreshState();
    return res;
  };

  const handleSaveOperatingExpense = (expData: any) => {
    const res = db.saveOperatingExpense(expData);
    refreshState();
    return res;
  };

  const handleDeleteOperatingExpense = (expId: string) => {
    const res = db.deleteOperatingExpense(expId);
    refreshState();
    return res;
  };

  const handleUpdateSettings = (newSettings: any) => {
    db.updateSettings(newSettings);
    refreshState();
  };

  const handleExportBackup = () => {
    const jsonStr = db.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crystal_gift_house_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = (jsonString: string) => {
    const res = db.restoreBackup(jsonString);
    if (res.success) {
      refreshState();
    }
    return res;
  };

  const handleResetToDemo = () => {
    db.resetToDemo();
    refreshState();
    alert('System reset to verified demo database.');
  };

  // Counts for sidebar badges
  const lowStockCount = dbState.products.filter(
    (p) => calculateAvailableStock(p.currentStock, p.reservedStock) <= p.lowStockThreshold
  ).length;

  const pendingOrdersCount = dbState.orders.filter((o) =>
    ['pending', 'confirmed', 'processing', 'packed'].includes(o.status)
  ).length;

  const pendingParcelsCount = dbState.parcels.filter(
    (p) => p.status === 'in_transit' || p.status === 'pending_dispatch'
  ).length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        lowStockCount={lowStockCount}
        pendingOrdersCount={pendingOrdersCount}
        pendingParcelsCount={pendingParcelsCount}
        onOpenAcceptanceTests={() => setIsAcceptanceModalOpen(true)}
      />

      {/* Main View Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
          onOpenAcceptanceTests={() => setIsAcceptanceModalOpen(true)}
          onOpenSettings={() => setActiveTab('settings')}
          onSelectOrder={(ord) => setSelectedOrder(ord)}
          onSelectProduct={() => setActiveTab('inventory')}
          products={dbState.products}
          orders={dbState.orders}
          parcels={dbState.parcels}
          dateRangeLabel="This Month (Oct 2026)"
        />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              orders={dbState.orders}
              products={dbState.products}
              parcels={dbState.parcels}
              adExpenses={dbState.adExpenses}
              operatingExpenses={dbState.operatingExpenses}
              bankAccounts={dbState.bankAccounts}
              onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
              onOpenAddProduct={() => setActiveTab('inventory')}
              onOpenLogAdSpend={() => setActiveTab('advertising')}
              onOpenAcceptanceTests={() => setIsAcceptanceModalOpen(true)}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSelectOrder={(ord) => setSelectedOrder(ord)}
              onSelectProduct={() => setActiveTab('inventory')}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={dbState.orders}
              onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
              onSelectOrder={(ord) => setSelectedOrder(ord)}
              onDeleteOrder={handleDeleteOrder}
              onBulkUpdateStatus={handleBulkUpdateStatus}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              products={dbState.products}
              stockMovements={dbState.stockMovements}
              suppliers={dbState.suppliers}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onAdjustStock={handleAdjustStock}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchasesView
              purchases={dbState.purchaseOrders}
              suppliers={dbState.suppliers}
              products={dbState.products}
              bankAccounts={dbState.bankAccounts}
              onCreatePO={handleCreatePO}
              onDeletePO={handleDeletePO}
              onReceiveGoods={handleReceiveGoods}
              onSaveSupplier={handleSaveSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onRecordSupplierPayment={handleRecordSupplierPayment}
            />
          )}

          {activeTab === 'parcels' && (
            <ParcelsView
              parcels={dbState.parcels}
              bankAccounts={dbState.bankAccounts}
              onSettleParcels={handleSettleParcels}
              onUpdateParcelStatus={() => {}}
            />
          )}

          {activeTab === 'advertising' && (
            <AdvertisingView
              adExpenses={dbState.adExpenses}
              defaultExchangeRate={dbState.settings.defaultExchangeRate}
              onSaveAdExpense={handleSaveAdExpense}
              onDeleteAdExpense={handleDeleteAdExpense}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={dbState.operatingExpenses}
              onSaveExpense={handleSaveOperatingExpense}
              onDeleteExpense={handleDeleteOperatingExpense}
            />
          )}

          {activeTab === 'accounting' && (
            <AccountingView
              orders={dbState.orders}
              parcels={dbState.parcels}
              adExpenses={dbState.adExpenses}
              operatingExpenses={dbState.operatingExpenses}
              bankAccounts={dbState.bankAccounts}
              cashTransactions={dbState.cashTransactions}
              suppliers={dbState.suppliers}
              products={dbState.products}
              onSaveCashTransaction={handleSaveCashTransaction}
              onDeleteCashTransaction={handleDeleteCashTransaction}
              onSaveBankAccount={handleSaveBankAccount}
              onDeleteBankAccount={handleDeleteBankAccount}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              orders={dbState.orders}
              products={dbState.products}
              parcels={dbState.parcels}
              adExpenses={dbState.adExpenses}
              operatingExpenses={dbState.operatingExpenses}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={dbState.settings}
              auditLogs={dbState.auditLogs}
              onUpdateSettings={handleUpdateSettings}
              onExportBackup={handleExportBackup}
              onRestoreBackup={handleRestoreBackup}
              onResetToDemo={handleResetToDemo}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        products={dbState.products}
        onSubmitOrder={handleCreateOrder}
      />

      <OrderDetailModal
        order={selectedOrder}
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={handleUpdateOrderStatus}
        onUpdateOrder={handleUpdateOrder}
        onDeleteOrder={handleDeleteOrder}
        onPrintInvoice={(ord) => {
          setOrderToPrint(ord);
        }}
      />

      <PrintInvoiceModal
        order={orderToPrint}
        settings={dbState.settings}
        isOpen={orderToPrint !== null}
        onClose={() => setOrderToPrint(null)}
      />

      <AcceptanceTestsModal
        isOpen={isAcceptanceModalOpen}
        onClose={() => setIsAcceptanceModalOpen(false)}
        onRunTests={() => db.runAcceptanceTests()}
        onRefreshData={refreshState}
      />

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}

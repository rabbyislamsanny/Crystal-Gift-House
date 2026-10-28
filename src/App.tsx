import React, { useState } from 'react';
import { db } from './db/database';
import {
  DatabaseState,
  Order,
  OrderStatus,
  ReturnDisposition,
  UserAccount,
  UserRole,
  AppModule,
  PermissionAction,
} from './types/database';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { AIOrderEntryView } from './components/AIOrderEntryView';
import { UserManagementView } from './components/UserManagementView';
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
import { hasPermission } from './utils/authSecurity';

export default function App() {
  const [dbState, setDbState] = useState<DatabaseState>(() => db.getState());
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => db.getCurrentUser());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [loginEmailInput, setLoginEmailInput] = useState('mdrabbyislamsanny1@gmail.com');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

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
    setCurrentUser(db.getCurrentUser());
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
    const res = db.updateOrderStatus({
      ...params,
      performedBy: currentUser.fullName,
    });
    refreshState();
    return res;
  };

  const handleBulkUpdateStatus = (orderIds: string[], newStatus: OrderStatus) => {
    for (const id of orderIds) {
      db.updateOrderStatus({ orderId: id, newStatus, performedBy: currentUser.fullName });
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
    const res = db.adjustStock({ ...params, performedBy: currentUser.fullName });
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
  };

  // User & RBAC Handlers
  const handleCreateUser = (input: {
    username: string;
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    passwordPlain: string;
  }) => {
    const res = db.createUser(input);
    refreshState();
    return res;
  };

  const handleUpdateUser = (
    userId: string,
    updates: {
      fullName?: string;
      email?: string;
      phone?: string;
      role?: UserRole;
      isActive?: boolean;
    }
  ) => {
    const res = db.updateUser(userId, updates);
    refreshState();
    return res;
  };

  const handleResetPassword = (userId: string, newPasswordPlain: string) => {
    const res = db.resetUserPassword(userId, newPasswordPlain);
    refreshState();
    return res;
  };

  const handleRevokeAccess = (userId: string, reason?: string) => {
    const res = db.revokeUserAccess(userId, reason);
    refreshState();
    return res;
  };

  const handleDeleteUser = (userId: string, reason?: string) => {
    const res = db.deleteUser(userId, reason);
    refreshState();
    return res;
  };

  const handleUpdateRolePermissions = (
    role: UserRole,
    modulePermissions: Record<AppModule, PermissionAction[]>
  ) => {
    const res = db.updateRolePermissions(role, modulePermissions);
    refreshState();
    return res;
  };

  const handleSwitchUser = (userId: string) => {
    const res = db.setCurrentUser(userId);
    refreshState();
    return res;
  };

  const handleAuthenticateUser = (username: string, passwordPlain: string) => {
    const res = db.authenticateUser(username, passwordPlain);
    refreshState();
    return res;
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

  if (isSessionLocked) {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4 font-sans antialiased">
        <div className="w-full max-w-md bg-white rounded-2xl border border-emerald-800/20 shadow-2xl overflow-hidden">
          <div className="bg-emerald-900 p-6 text-white border-b border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-800 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-lg">
                CG
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Crystal Gift House</h1>
                <p className="text-xs text-emerald-200">Business OS • Secure Multi-User Login</p>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLoginError(null);
              const res = handleAuthenticateUser(loginEmailInput, loginPasswordInput);
              if (!res.success) {
                setLoginError(res.error || 'Invalid login credentials.');
                return;
              }
              setIsSessionLocked(false);
              setLoginPasswordInput('');
            }}
            className="p-6 space-y-4 text-xs"
          >
            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 font-medium">
                {loginError}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Admin Email or Username
              </label>
              <input
                type="text"
                required
                value={loginEmailInput}
                onChange={(e) => setLoginEmailInput(e.target.value)}
                placeholder="mdrabbyislamsanny1@gmail.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={loginPasswordInput}
                onChange={(e) => setLoginPasswordInput(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Sign In to Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

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
        currentUser={currentUser}
        rolePermissions={dbState.rolePermissions}
      />

      {/* Main View Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
          onOpenAIOrderEntry={() => setActiveTab('ai_order_entry')}
          onOpenAcceptanceTests={() => setIsAcceptanceModalOpen(true)}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenUserManagement={() => setActiveTab('users')}
          onSelectOrder={(ord) => setSelectedOrder(ord)}
          onSelectProduct={() => setActiveTab('inventory')}
          products={dbState.products}
          orders={dbState.orders}
          parcels={dbState.parcels}
          dateRangeLabel="This Month (Oct 2026)"
          currentUser={currentUser}
          users={dbState.users}
          onSwitchUser={(uid) => handleSwitchUser(uid)}
          onLockSession={() => {
            setLoginEmailInput(currentUser.email || currentUser.username);
            setLoginPasswordInput('');
            setLoginError(null);
            setIsSessionLocked(true);
          }}
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

          {activeTab === 'ai_order_entry' && (
            <AIOrderEntryView
              products={dbState.products}
              existingOrders={dbState.orders}
              settings={dbState.settings}
              currentUser={currentUser}
              rolePermissions={dbState.rolePermissions}
              onCreateOrder={handleCreateOrder}
              onSelectOrder={(ord) => setSelectedOrder(ord)}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={dbState.orders}
              users={dbState.users}
              onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
              onOpenAIOrderEntry={() => setActiveTab('ai_order_entry')}
              onSelectOrder={(ord) => setSelectedOrder(ord)}
              onDeleteOrder={handleDeleteOrder}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              canDeleteOrders={hasPermission(
                currentUser,
                dbState.rolePermissions,
                'orders',
                'delete'
              )}
              canExportOrders={hasPermission(
                currentUser,
                dbState.rolePermissions,
                'orders',
                'export'
              )}
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

          {activeTab === 'users' && (
            <UserManagementView
              users={dbState.users}
              currentUser={currentUser}
              rolePermissions={dbState.rolePermissions}
              auditLogs={dbState.auditLogs}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onResetPassword={handleResetPassword}
              onRevokeAccess={handleRevokeAccess}
              onDeleteUser={handleDeleteUser}
              onUpdateRolePermissions={handleUpdateRolePermissions}
              onSwitchUser={handleSwitchUser}
              onAuthenticateUser={handleAuthenticateUser}
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

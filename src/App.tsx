import React, { useState, useEffect, useCallback } from 'react';
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
import { LoginPage } from './components/LoginPage';
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
import { hasPermission, ROLE_LABELS } from './utils/authSecurity';
import {
  checkAuthSessionStatus,
  clearActiveSessionTokens,
  createUserOnServer,
  deleteUserOnServer,
  fetchAuthoritativeState,
  loginWithAuthServer,
  logoutFromAuthServer,
  resetPasswordOnServer,
  revokeUserOnServer,
  syncStateWithServer,
  updateRolePermissionsOnServer,
  updateUserOnServer,
} from './utils/authClient';
import { ShieldAlert, Lock } from 'lucide-react';

const TAB_TO_MODULE: Record<ActiveTab, AppModule> = {
  dashboard: 'dashboard',
  ai_order_entry: 'ai_order_entry',
  orders: 'orders',
  inventory: 'inventory',
  purchases: 'purchases',
  parcels: 'couriers',
  advertising: 'expenses',
  expenses: 'expenses',
  accounting: 'accounting',
  reports: 'reports',
  users: 'users',
  settings: 'settings',
};

export default function App() {
  // Authentication & Server Session State
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [dbState, setDbState] = useState<DatabaseState | null>(null);

  // Navigation & UI State
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

  const handleUnauthorizedSession = useCallback((notice?: string) => {
    clearActiveSessionTokens();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setDbState(null);
    setCsrfToken('');
    setSelectedOrder(null);
    setOrderToPrint(null);
    setIsNewOrderModalOpen(false);
    if (notice) {
      setSessionNotice(notice);
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.replaceState(null, '', '/login');
    }
  }, []);

  const loadAuthenticatedState = useCallback(
    async (fallbackUser?: UserAccount, fallbackCsrf?: string) => {
      try {
        const result = await fetchAuthoritativeState(fallbackCsrf);
        if (!result.authenticated || !result.state) {
          handleUnauthorizedSession('Please sign in to access Crystal Gift House Business OS.');
          return false;
        }
        const resolvedUser: UserAccount =
          result.currentUser || fallbackUser || result.state.users[0];
        const resolvedCsrf: string = result.csrfToken || fallbackCsrf || '';
        db.hydrateFromServer(result.state, resolvedUser);
        setDbState(result.state);
        setCurrentUser(resolvedUser);
        setCsrfToken(resolvedCsrf);
        setIsAuthenticated(true);
        setSetupRequired(false);
        if (typeof window !== 'undefined' && window.location.pathname === '/login') {
          window.history.replaceState(null, '', '/');
        }
        return true;
      } catch (err) {
        console.error('Error loading authenticated state:', err);
      }
      return false;
    },
    [handleUnauthorizedSession]
  );

  // Verify server session on initial load
  useEffect(() => {
    let mounted = true;
    async function verifySession() {
      try {
        const status = await checkAuthSessionStatus();
        if (!mounted) return;

        if (status.authenticated && status.user) {
          if (status.state) {
            db.hydrateFromServer(status.state, status.user);
            setDbState(status.state);
            setCurrentUser(status.user);
            setCsrfToken(status.csrfToken || '');
            setIsAuthenticated(true);
            setSetupRequired(false);
            if (typeof window !== 'undefined' && window.location.pathname === '/login') {
              window.history.replaceState(null, '', '/');
            }
          } else {
            await loadAuthenticatedState(status.user, status.csrfToken);
          }
        } else {
          clearActiveSessionTokens();
          setIsAuthenticated(false);
          setSetupRequired(Boolean(status.setupRequired));
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.history.replaceState(null, '', '/login');
          }
        }
      } catch {
        if (mounted) {
          clearActiveSessionTokens();
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    }
    verifySession();
    return () => {
      mounted = false;
    };
  }, [loadAuthenticatedState]);

  // Synchronize state changes to protected server database
  const syncStateToServer = useCallback(
    async (updatedState: DatabaseState) => {
      try {
        const res = await syncStateWithServer(updatedState, csrfToken);
        if (!res.authenticated) {
          handleUnauthorizedSession(
            'Your session has expired or access was revoked. Please sign in again.'
          );
        }
      } catch (err) {
        console.error('Failed to sync state to server:', err);
      }
    },
    [csrfToken, handleUnauthorizedSession]
  );

  const refreshState = useCallback(
    (shouldSyncServer: boolean = true) => {
      const updated = db.getState();
      setDbState({ ...updated });
      if (selectedOrder) {
        const refreshedOrder = updated.orders.find((o) => o.id === selectedOrder.id);
        setSelectedOrder(refreshedOrder || null);
      }
      if (shouldSyncServer) {
        syncStateToServer(updated);
      }
    },
    [selectedOrder, syncStateToServer]
  );

  const handleLogout = async () => {
    try {
      await logoutFromAuthServer(csrfToken);
    } catch {
      // proceed with client cleanup even if network fails
    }
    handleUnauthorizedSession('You have been securely logged out.');
  };

  // Operational Handlers
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
      performedBy: currentUser?.fullName || 'Admin',
    });
    refreshState();
    return res;
  };

  const handleBulkUpdateStatus = (orderIds: string[], newStatus: OrderStatus) => {
    for (const id of orderIds) {
      db.updateOrderStatus({
        orderId: id,
        newStatus,
        performedBy: currentUser?.fullName || 'Admin',
      });
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
    const res = db.adjustStock({
      ...params,
      performedBy: currentUser?.fullName || 'Admin',
    });
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

  // Server-Authoritative User & RBAC Handlers
  const handleCreateUser = async (input: {
    username: string;
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    passwordPlain: string;
  }) => {
    const res = await createUserOnServer(input, csrfToken);
    if (res.unauthenticated) {
      handleUnauthorizedSession('Session expired. Please log in again.');
      return { success: false, error: 'Session expired.' };
    }
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to create user.' };
    }
    if (res.state && currentUser) {
      db.hydrateFromServer(res.state, currentUser);
      setDbState(res.state);
    }
    return { success: true, user: res.user };
  };

  const handleUpdateUser = async (
    userId: string,
    updates: {
      fullName?: string;
      email?: string;
      phone?: string;
      role?: UserRole;
      isActive?: boolean;
    }
  ) => {
    const res = await updateUserOnServer(userId, updates, csrfToken);
    if (res.unauthenticated) {
      handleUnauthorizedSession('Session expired. Please log in again.');
      return { success: false, error: 'Session expired.' };
    }
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to update user.' };
    }
    if (res.state && currentUser) {
      const updatedSelf =
        userId === currentUser.id ? res.user || currentUser : currentUser;
      db.hydrateFromServer(res.state, updatedSelf);
      setDbState(res.state);
      setCurrentUser(updatedSelf);
    }
    return { success: true, user: res.user };
  };

  const handleResetPassword = async (userId: string, newPasswordPlain: string) => {
    const res = await resetPasswordOnServer(userId, newPasswordPlain, csrfToken);
    if (res.unauthenticated) {
      handleUnauthorizedSession('Session expired. Please log in again.');
      return { success: false, error: 'Session expired.' };
    }
    if (!res.success) {
      return { success: false, error: res.error || 'Password reset failed.' };
    }
    if (res.csrfToken) {
      setCsrfToken(res.csrfToken);
    }
    if (res.state && currentUser) {
      db.hydrateFromServer(res.state, currentUser);
      setDbState(res.state);
    }
    return { success: true };
  };

  const handleRevokeAccess = async (userId: string, reason?: string) => {
    const res = await revokeUserOnServer(userId, reason, csrfToken);
    if (res.unauthenticated) {
      handleUnauthorizedSession('Session expired. Please log in again.');
      return { success: false, error: 'Session expired.' };
    }
    if (!res.success) {
      return { success: false, error: res.error || 'Cannot revoke access.' };
    }
    if (res.state && currentUser) {
      db.hydrateFromServer(res.state, currentUser);
      setDbState(res.state);
    }
    return { success: true };
  };

  const handleDeleteUser = async (userId: string, reason?: string) => {
    const res = await deleteUserOnServer(userId, reason, csrfToken);
    if (res.unauthenticated) {
      handleUnauthorizedSession('Session expired. Please log in again.');
      return { success: false, error: 'Session expired.' };
    }
    if (!res.success) {
      return { success: false, error: res.error || 'Cannot delete user.' };
    }
    if (res.state && currentUser) {
      db.hydrateFromServer(res.state, currentUser);
      setDbState(res.state);
    }
    return { success: true };
  };

  const handleUpdateRolePermissions = async (
    role: UserRole,
    modulePermissions: Record<AppModule, PermissionAction[]>
  ) => {
    const res = await updateRolePermissionsOnServer(role, modulePermissions, csrfToken);
    if (res.unauthenticated) {
      handleUnauthorizedSession('Session expired. Please log in again.');
      return { success: false, error: 'Session expired.' };
    }
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to update role permissions.' };
    }
    if (res.state && currentUser) {
      db.hydrateFromServer(res.state, currentUser);
      setDbState(res.state);
    }
    return { success: true };
  };

  const handleAuthenticateUser = async (username: string, passwordPlain: string) => {
    const res = await loginWithAuthServer(username, passwordPlain);
    if (!res.success || !res.user) {
      return { success: false, error: res.error || 'Invalid login credentials.' };
    }
    await loadAuthenticatedState(res.user, res.csrfToken);
    return { success: true, user: res.user };
  };

  // 1. Loading spinner while verifying session cookie with backend
  if (authChecking) {
    return (
      <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="w-11 h-11 rounded-xl bg-emerald-900 border border-amber-400/40 flex items-center justify-center text-amber-300 mb-3 animate-pulse">
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-sm font-bold tracking-tight">Crystal Gift House Business OS</div>
        <div className="text-xs text-emerald-300 mt-1">Verifying encrypted session...</div>
      </div>
    );
  }

  // 2. Strict Authentication Gate: Unauthenticated visitors NEVER see any dashboard UI or data
  if (!isAuthenticated || !dbState || !currentUser) {
    return (
      <LoginPage
        setupRequired={setupRequired}
        sessionNotice={sessionNotice}
        onLoginSuccess={({ user, csrfToken: newCsrf }) => {
          setSessionNotice(null);
          loadAuthenticatedState(user, newCsrf);
        }}
      />
    );
  }

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

  const currentModule = TAB_TO_MODULE[activeTab];
  const canViewActiveTab = hasPermission(
    currentUser,
    dbState.rolePermissions,
    currentModule,
    'view'
  );

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
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
          onOpenAIOrderEntry={
            hasPermission(currentUser, dbState.rolePermissions, 'ai_order_entry', 'view')
              ? () => setActiveTab('ai_order_entry')
              : undefined
          }
          onOpenAcceptanceTests={() => setIsAcceptanceModalOpen(true)}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenUserManagement={
            hasPermission(currentUser, dbState.rolePermissions, 'users', 'view')
              ? () => setActiveTab('users')
              : undefined
          }
          onSelectOrder={(ord) => setSelectedOrder(ord)}
          onSelectProduct={() => setActiveTab('inventory')}
          products={dbState.products}
          orders={dbState.orders}
          parcels={dbState.parcels}
          dateRangeLabel="This Month (Oct 2026)"
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {!canViewActiveTab ? (
            <div className="max-w-lg mx-auto my-12 bg-white rounded-2xl border border-red-200 p-6 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Access Restricted by Role Policy
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your current account (<strong>{currentUser.fullName}</strong> •{' '}
                <span className="font-semibold text-emerald-800">
                  {ROLE_LABELS[currentUser.role].name}
                </span>
                ) does not have permission to view the <strong>{activeTab}</strong> module.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
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
                  csrfToken={csrfToken}
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
            </>
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

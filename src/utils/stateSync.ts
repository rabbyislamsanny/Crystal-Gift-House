import {
  AdExpense,
  AuditLog,
  BankCashAccount,
  CashTransaction,
  CourierSettlement,
  Customer,
  DatabaseState,
  OperatingExpense,
  Order,
  Parcel,
  Product,
  PurchaseOrder,
  StockMovement,
  Supplier,
  TrashItem,
} from '../types/database';

export interface ReconcileOptions {
  mode?: 'authoritative_client' | 'safe_merge';
  deletedIds?: string[];
}

function getEntityTimestamp(item: {
  updatedAt?: string;
  createdAt?: string;
  date?: string;
  orderDate?: string;
  timestamp?: string;
  deletedAt?: string;
}): number {
  const raw =
    item.updatedAt ||
    item.createdAt ||
    item.orderDate ||
    item.timestamp ||
    item.deletedAt ||
    item.date ||
    '';
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Extracts all entity IDs that have been explicitly deleted (present in trash or explicit tombstones).
 */
export function extractDeletedEntityIds(
  state?: Partial<DatabaseState>,
  explicitDeletedIds?: string[]
): Set<string> {
  const deleted = new Set<string>(explicitDeletedIds || []);
  if (state?.trash && Array.isArray(state.trash)) {
    for (const item of state.trash) {
      if (item && item.entityId) {
        deleted.add(item.entityId);
      }
    }
  }
  return deleted;
}

/**
 * Reconciles an entity collection by `id` between the central server state and an incoming client state.
 * - Never resurrects items whose IDs are in `deletedIds`.
 * - In `safe_merge` mode (concurrent tabs or local recovery), preserves server items missing from incoming
 *   unless they were explicitly deleted, and picks the newer record when both exist.
 * - In `authoritative_client` mode (when the client is at the latest revision), applies client updates
 *   while still respecting `deletedIds`.
 */
export function reconcileCollectionById<
  T extends {
    id: string;
    updatedAt?: string;
    createdAt?: string;
    date?: string;
    orderDate?: string;
    timestamp?: string;
    deletedAt?: string;
  }
>(
  serverItems: T[],
  incomingItems: T[] | undefined,
  deletedIds: Set<string>,
  mode: 'authoritative_client' | 'safe_merge' = 'safe_merge'
): T[] {
  if (!Array.isArray(incomingItems)) {
    return serverItems.filter((item) => !deletedIds.has(item.id));
  }

  if (mode === 'authoritative_client') {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of incomingItems) {
      if (!item || !item.id || deletedIds.has(item.id) || seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
    return result;
  }

  // safe_merge mode: combine incoming and server items without losing concurrent server additions
  const serverMap = new Map<string, T>();
  for (const sItem of serverItems) {
    if (sItem && sItem.id && !deletedIds.has(sItem.id)) {
      serverMap.set(sItem.id, sItem);
    }
  }

  const incomingMap = new Map<string, T>();
  for (const cItem of incomingItems) {
    if (cItem && cItem.id && !deletedIds.has(cItem.id)) {
      incomingMap.set(cItem.id, cItem);
    }
  }

  const mergedResult: T[] = [];
  const processedIds = new Set<string>();

  // 1. Walk incoming items in order (preserves new prepended items like orders/expenses)
  for (const [id, cItem] of incomingMap.entries()) {
    const sItem = serverMap.get(id);
    if (!sItem) {
      mergedResult.push(cItem);
    } else {
      const sTime = getEntityTimestamp(sItem);
      const cTime = getEntityTimestamp(cItem);
      // If client item is newer or equal (or neither has timestamps), prefer client item
      if (cTime >= sTime) {
        mergedResult.push(cItem);
      } else {
        mergedResult.push(sItem);
      }
    }
    processedIds.add(id);
  }

  // 2. Preserve any server items that the client didn't know about (created by another browser/tab)
  for (const [id, sItem] of serverMap.entries()) {
    if (!processedIds.has(id) && !deletedIds.has(id)) {
      mergedResult.push(sItem);
      processedIds.add(id);
    }
  }

  return mergedResult;
}

/**
 * Reconciles product reservedStock against active confirmed/processing/packed orders
 * so stock reservations are always 100% consistent after any state merge.
 */
export function reconcileProductsReservedStock(
  products: Product[],
  orders: Order[]
): Product[] {
  const reservedMap: Record<string, number> = {};
  for (const ord of orders) {
    if (['confirmed', 'processing', 'packed'].includes(ord.status)) {
      for (const it of ord.items || []) {
        reservedMap[it.productId] = (reservedMap[it.productId] || 0) + it.quantity;
      }
    }
  }
  return products.map((prod) => ({
    ...prod,
    reservedStock: reservedMap[prod.id] || 0,
  }));
}

/**
 * Merges incoming client state into the central server state safely.
 */
export function mergeDatabaseStates(
  serverState: DatabaseState,
  incoming: Partial<DatabaseState>,
  options?: ReconcileOptions
): DatabaseState {
  const mode = options?.mode || 'safe_merge';

  // Combine trash first so all deleted entity IDs from both server and client are respected
  const mergedTrash = reconcileCollectionById<TrashItem>(
    serverState.trash || [],
    incoming.trash,
    new Set<string>(),
    'safe_merge'
  );

  // Build tombstone set of deleted entityIds:
  // If an item is currently in mergedTrash AND not explicitly restored in authoritative mode,
  // treat its entityId as deleted.
  const activeRestoredIds = new Set<string>();
  if (mode === 'authoritative_client' && Array.isArray(incoming.trash)) {
    const incomingTrashEntityIds = new Set(incoming.trash.map((t) => t.entityId));
    for (const sTrash of serverState.trash || []) {
      if (!incomingTrashEntityIds.has(sTrash.entityId)) {
        activeRestoredIds.add(sTrash.entityId);
      }
    }
  }

  const finalTrash =
    mode === 'authoritative_client' && Array.isArray(incoming.trash)
      ? incoming.trash
      : mergedTrash.filter((t) => !activeRestoredIds.has(t.entityId));

  const deletedIds = extractDeletedEntityIds(
    { trash: finalTrash },
    options?.deletedIds
  );

  const mergedOrders = reconcileCollectionById<Order>(
    serverState.orders,
    incoming.orders,
    deletedIds,
    mode
  );

  const rawProducts = reconcileCollectionById<Product>(
    serverState.products,
    incoming.products,
    deletedIds,
    mode
  );

  const mergedProducts = reconcileProductsReservedStock(rawProducts, mergedOrders);

  const mergedSuppliers = reconcileCollectionById<Supplier>(
    serverState.suppliers,
    incoming.suppliers,
    deletedIds,
    mode
  );

  const mergedPurchaseOrders = reconcileCollectionById<PurchaseOrder>(
    serverState.purchaseOrders,
    incoming.purchaseOrders,
    deletedIds,
    mode
  );

  const mergedStockMovements = reconcileCollectionById<StockMovement>(
    serverState.stockMovements,
    incoming.stockMovements,
    deletedIds,
    mode
  );

  const mergedCustomers = reconcileCollectionById<Customer>(
    serverState.customers,
    incoming.customers,
    deletedIds,
    mode
  );

  // If an order was deleted, its linked parcels should also be excluded
  const activeOrderIds = new Set(mergedOrders.map((o) => o.id));
  const rawParcels = reconcileCollectionById<Parcel>(
    serverState.parcels,
    incoming.parcels,
    deletedIds,
    mode
  );
  const mergedParcels = rawParcels.filter(
    (p) => !deletedIds.has(p.orderId) && activeOrderIds.has(p.orderId)
  );

  const mergedAdExpenses = reconcileCollectionById<AdExpense>(
    serverState.adExpenses,
    incoming.adExpenses,
    deletedIds,
    mode
  );

  const mergedOperatingExpenses = reconcileCollectionById<OperatingExpense>(
    serverState.operatingExpenses,
    incoming.operatingExpenses,
    deletedIds,
    mode
  );

  const mergedCourierSettlements = reconcileCollectionById<CourierSettlement>(
    serverState.courierSettlements,
    incoming.courierSettlements,
    deletedIds,
    mode
  );

  const mergedBankAccounts = reconcileCollectionById<BankCashAccount>(
    serverState.bankAccounts,
    incoming.bankAccounts,
    deletedIds,
    mode
  );

  const mergedCashTransactions = reconcileCollectionById<CashTransaction>(
    serverState.cashTransactions || [],
    incoming.cashTransactions,
    deletedIds,
    mode
  );

  const mergedAuditLogs = reconcileCollectionById<AuditLog>(
    serverState.auditLogs || [],
    incoming.auditLogs,
    new Set<string>(),
    'safe_merge'
  )
    .sort((a, b) => Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''))
    .slice(0, 500);

  return {
    ...serverState,
    products: mergedProducts,
    suppliers: mergedSuppliers,
    purchaseOrders: mergedPurchaseOrders,
    stockMovements: mergedStockMovements,
    customers: mergedCustomers,
    orders: mergedOrders,
    parcels: mergedParcels,
    adExpenses: mergedAdExpenses,
    operatingExpenses: mergedOperatingExpenses,
    courierSettlements: mergedCourierSettlements,
    bankAccounts: mergedBankAccounts,
    cashTransactions: mergedCashTransactions,
    auditLogs: mergedAuditLogs,
    trash: finalTrash,
    // Users and rolePermissions remain strictly controlled by dedicated user/RBAC server endpoints
    users: serverState.users,
    rolePermissions: serverState.rolePermissions,
    settings: incoming.settings
      ? {
          ...serverState.settings,
          ...incoming.settings,
          ownerPin:
            incoming.settings.ownerPin &&
            incoming.settings.ownerPin !== '[PROTECTED]'
              ? incoming.settings.ownerPin
              : serverState.settings.ownerPin,
        }
      : serverState.settings,
  };
}

/**
 * Checks whether a browser's local state contains any unsynced records that are missing on the server
 * (and were not deleted into the server's trash).
 */
export function findUnsyncedLocalRecords(
  localState: Partial<DatabaseState> | null | undefined,
  serverState: DatabaseState
): { hasUnsynced: boolean; unsyncedCount: number } {
  if (!localState) return { hasUnsynced: false, unsyncedCount: 0 };

  const serverTrashIds = extractDeletedEntityIds(serverState);
  let unsyncedCount = 0;

  const checkCollection = <T extends { id: string; updatedAt?: string }>(
    localArr: T[] | undefined,
    serverArr: T[] | undefined
  ) => {
    if (!Array.isArray(localArr)) return;
    const sMap = new Map<string, T>();
    for (const s of serverArr || []) {
      if (s?.id) sMap.set(s.id, s);
    }
    for (const l of localArr) {
      if (!l?.id || serverTrashIds.has(l.id)) continue;
      const sItem = sMap.get(l.id);
      if (!sItem) {
        unsyncedCount++;
      } else if (l.updatedAt && sItem.updatedAt) {
        if (Date.parse(l.updatedAt) > Date.parse(sItem.updatedAt)) {
          unsyncedCount++;
        }
      }
    }
  };

  checkCollection(localState.products, serverState.products);
  checkCollection(localState.orders, serverState.orders);
  checkCollection(localState.suppliers, serverState.suppliers);
  checkCollection(localState.purchaseOrders, serverState.purchaseOrders);
  checkCollection(localState.customers, serverState.customers);
  checkCollection(localState.parcels, serverState.parcels);
  checkCollection(localState.adExpenses, serverState.adExpenses);
  checkCollection(localState.operatingExpenses, serverState.operatingExpenses);
  checkCollection(localState.cashTransactions, serverState.cashTransactions);
  checkCollection(localState.bankAccounts, serverState.bankAccounts);

  return {
    hasUnsynced: unsyncedCount > 0,
    unsyncedCount,
  };
}

/**
 * Computes a fast, deterministic signature of the operational state so clients can detect changes.
 */
export function computeStateSignature(state: DatabaseState): string {
  const parts = [
    `p:${state.products.map((p) => `${p.id}:${p.name}:${p.sellingPrice}:${p.currentStock}:${p.reservedStock}:${p.updatedAt || ''}`).join(',')}`,
    `o:${state.orders.map((o) => `${o.id}:${o.status}:${o.itemTotal}:${o.codAmount}:${o.updatedAt || ''}`).join(',')}`,
    `s:${state.suppliers.map((s) => `${s.id}:${s.name}:${s.currentBalance}`).join(',')}`,
    `po:${state.purchaseOrders.map((po) => `${po.id}:${po.status}:${po.totalAmount}`).join(',')}`,
    `pcl:${state.parcels.map((p) => `${p.id}:${p.status}:${p.isSettled}:${p.settledAmount}`).join(',')}`,
    `ad:${state.adExpenses.map((a) => `${a.id}:${a.totalBdt}`).join(',')}`,
    `exp:${state.operatingExpenses.map((e) => `${e.id}:${e.amount}:${e.category}`).join(',')}`,
    `bank:${state.bankAccounts.map((b) => `${b.id}:${b.balance}`).join(',')}`,
    `ctx:${(state.cashTransactions || []).map((c) => `${c.id}:${c.amount}:${c.type}`).join(',')}`,
    `u:${state.users.map((u) => `${u.id}:${u.role}:${u.isActive}:${u.sessionVersion}`).join(',')}`,
    `cfg:${state.settings.businessName}:${state.settings.defaultInsideDhakaFee}:${state.settings.defaultOutsideDhakaFee}`,
  ];
  return parts.join('|');
}

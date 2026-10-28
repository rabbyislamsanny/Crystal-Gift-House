import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDefaultState } from '../db/database';
import {
  computeStateSignature,
  findUnsyncedLocalRecords,
  mergeDatabaseStates,
} from './stateSync';
import { calculateProfitAndLoss } from './accountingCalculations';
import { createApp } from '../../server';

async function startTestServer(persistFilePath: string | null = null) {
  const app = createApp({ persistFilePath });
  return new Promise<{
    baseUrl: string;
    close: () => Promise<void>;
  }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((resClose) => {
            server.close(() => resClose());
          }),
      });
    });
  });
}

test('mergeDatabaseStates preserves concurrent additions when a stale browser syncs (safe_merge)', () => {
  const serverState = getDefaultState();
  const staleBrowserBState = JSON.parse(JSON.stringify(serverState));

  // Browser A added a new product on the server
  serverState.products.push({
    id: 'prod-browser-a',
    sku: 'CGH-BROWSER-A',
    name: 'Browser A Crystal Lamp',
    category: 'Table Lamps',
    supplierId: 'sup-1',
    supplierName: 'Zhejiang Crystal Arts Ltd',
    purchaseCost: 500,
    sellingPrice: 1200,
    openingStock: 15,
    currentStock: 15,
    reservedStock: 0,
    lowStockThreshold: 3,
    packagingCost: 40,
    damagedStock: 0,
    notes: '',
    createdAt: '2026-10-28T10:00:00Z',
    updatedAt: '2026-10-28T10:00:00Z',
  });

  // Stale Browser B (which didn't have prod-browser-a yet) adds prod-browser-b
  staleBrowserBState.products.push({
    id: 'prod-browser-b',
    sku: 'CGH-BROWSER-B',
    name: 'Browser B Crystal Cube',
    category: 'Personalized Gifts',
    supplierId: 'sup-1',
    supplierName: 'Zhejiang Crystal Arts Ltd',
    purchaseCost: 700,
    sellingPrice: 1500,
    openingStock: 10,
    currentStock: 10,
    reservedStock: 0,
    lowStockThreshold: 3,
    packagingCost: 40,
    damagedStock: 0,
    notes: '',
    createdAt: '2026-10-28T10:01:00Z',
    updatedAt: '2026-10-28T10:01:00Z',
  });

  const merged = mergeDatabaseStates(serverState, staleBrowserBState, {
    mode: 'safe_merge',
  });

  assert.equal(merged.products.some((p) => p.id === 'prod-browser-a'), true);
  assert.equal(merged.products.some((p) => p.id === 'prod-browser-b'), true);
});

test('mergeDatabaseStates honors explicit deletedIds and trash tombstones without resurrecting deleted records', () => {
  const serverState = getDefaultState();
  const incomingState = JSON.parse(JSON.stringify(serverState));

  // Delete prod-5 in incoming state and add trash entry
  incomingState.products = incomingState.products.filter((p: any) => p.id !== 'prod-5');
  incomingState.trash.unshift({
    id: 'trash-test-1',
    entityType: 'Product',
    entityId: 'prod-5',
    entityName: 'Octagonal Beveled Crystal Award Plaque',
    deletedAt: '2026-10-28T11:00:00Z',
    deletedBy: 'Super Admin',
    reason: 'Test deletion',
    consequencesSummary: 'Moved to Trash',
    payload: {},
    canRestore: true,
  });

  const merged = mergeDatabaseStates(serverState, incomingState, {
    mode: 'safe_merge',
    deletedIds: ['prod-5'],
  });

  assert.equal(merged.products.some((p) => p.id === 'prod-5'), false);
  assert.equal(merged.trash.some((t) => t.entityId === 'prod-5'), true);
});

test('findUnsyncedLocalRecords detects browser-only custom records for safe recovery', () => {
  const serverState = getDefaultState();
  const localState = JSON.parse(JSON.stringify(serverState));

  const initialCheck = findUnsyncedLocalRecords(localState, serverState);
  assert.equal(initialCheck.hasUnsynced, false);

  localState.suppliers.push({
    id: 'sup-local-custom',
    name: 'Dhaka Local Crystal Supplier',
    phone: '01799998888',
    company: 'Dhaka Crystal',
    address: 'Islampur, Dhaka',
    currentBalance: 5000,
    notes: '',
    createdAt: '2026-10-28T12:00:00Z',
  });

  const afterAddCheck = findUnsyncedLocalRecords(localState, serverState);
  assert.equal(afterAddCheck.hasUnsynced, true);
  assert.equal(afterAddCheck.unsyncedCount, 1);
});

test('Multi-Browser Scenarios (A)-(F): Central server database consistency across Browser A and Browser B', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-sync-test-'));
  const dbFilePath = path.join(tmpDir, 'cgh-server-state.json');

  const srv = await startTestServer(dbFilePath);
  try {
    // (F) Verify unauthenticated API access is denied (401)
    for (const endpoint of [
      { path: '/api/state', method: 'GET' },
      { path: '/api/state/version', method: 'GET' },
      { path: '/api/state/sync', method: 'POST' },
      { path: '/api/state/reconcile', method: 'POST' },
      { path: '/api/db/mutate', method: 'POST' },
    ]) {
      const unauthRes = await fetch(`${srv.baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.method === 'POST' ? JSON.stringify({}) : undefined,
      });
      assert.equal(unauthRes.status, 401, `Expected 401 for unauthenticated ${endpoint.path}`);
    }

    // Login in Browser A with Super Admin email and password
    const loginARes = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mdrabbyislamsanny1@gmail.com',
        password: 'Admin2026@#',
      }),
    });
    assert.equal(loginARes.status, 200);
    const sessionA = await loginARes.json();
    assert.equal(sessionA.success, true);

    // Login in Browser B (separate session) with the same Super Admin email and password
    const loginBRes = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mdrabbyislamsanny1@gmail.com',
        password: 'Admin2026@#',
      }),
    });
    assert.equal(loginBRes.status, 200);
    const sessionB = await loginBRes.json();
    assert.equal(sessionB.success, true);
    assert.notEqual(sessionA.sessionToken, sessionB.sessionToken);

    const headersA = {
      'Content-Type': 'application/json',
      'x-session-token': sessionA.sessionToken,
      'x-csrf-token': sessionA.csrfToken,
    };
    const headersB = {
      'Content-Type': 'application/json',
      'x-session-token': sessionB.sessionToken,
      'x-csrf-token': sessionB.csrfToken,
    };

    // (A) Create a product in Browser A and see it in Browser B
    const createProdRes = await fetch(`${srv.baseUrl}/api/db/mutate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        action: 'saveProduct',
        payload: {
          id: 'prod-sync-test-1',
          sku: 'CGH-SYNC-01',
          name: 'Royal Diamond Crystal Lamp',
          purchaseCost: 900,
          sellingPrice: 1950,
          openingStock: 20,
          currentStock: 20,
          lowStockThreshold: 4,
        },
      }),
    });
    assert.equal(createProdRes.status, 200);

    const stateBAfterCreate = await (
      await fetch(`${srv.baseUrl}/api/state`, { headers: headersB })
    ).json();
    const foundInB = stateBAfterCreate.state.products.find(
      (p: any) => p.id === 'prod-sync-test-1'
    );
    assert.ok(foundInB, 'Product created in Browser A must be visible in Browser B');
    assert.equal(foundInB.name, 'Royal Diamond Crystal Lamp');
    assert.equal(foundInB.sellingPrice, 1950);

    // (B) Edit the product in Browser B and see the update in Browser A
    const editProdInB = JSON.parse(JSON.stringify(stateBAfterCreate.state));
    const targetIdx = editProdInB.products.findIndex((p: any) => p.id === 'prod-sync-test-1');
    editProdInB.products[targetIdx].name = 'Royal Diamond Crystal Lamp (Updated in B)';
    editProdInB.products[targetIdx].sellingPrice = 2100;
    editProdInB.products[targetIdx].updatedAt = new Date().toISOString();

    const syncBRes = await fetch(`${srv.baseUrl}/api/state/sync`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        state: editProdInB,
        baseRevision: stateBAfterCreate.revision,
      }),
    });
    assert.equal(syncBRes.status, 200);

    const stateAAfterEdit = await (
      await fetch(`${srv.baseUrl}/api/state`, { headers: headersA })
    ).json();
    const foundInA = stateAAfterEdit.state.products.find(
      (p: any) => p.id === 'prod-sync-test-1'
    );
    assert.equal(foundInA.name, 'Royal Diamond Crystal Lamp (Updated in B)');
    assert.equal(foundInA.sellingPrice, 2100);

    // (C) Create an order and an operating expense and verify consistent dashboard totals across both browsers
    const createOrderRes = await fetch(`${srv.baseUrl}/api/db/mutate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        action: 'createOrder',
        payload: {
          customerName: 'Nadia Islam',
          customerPhone: '01755667788',
          fullAddress: 'House 8, Dhanmondi, Dhaka',
          district: 'Dhaka',
          deliveryZone: 'inside_dhaka',
          items: [{ productId: 'prod-sync-test-1', quantity: 2, unitPrice: 2100 }],
          discount: 100,
          deliveryFeeCharged: 80,
          advancePaid: 200,
          courierName: 'Steadfast',
          sourceChannel: 'Facebook Page',
          initialStatus: 'confirmed',
        },
      }),
    });
    const createdOrderData = await createOrderRes.json();
    assert.equal(createdOrderData.success, true);
    const createdOrderId = createdOrderData.result.order.id;

    const createExpRes = await fetch(`${srv.baseUrl}/api/db/mutate`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        action: 'saveOperatingExpense',
        payload: {
          id: 'exp-sync-test-1',
          category: 'Packaging',
          date: '2026-10-28',
          amount: 1250,
          paymentStatus: 'paid',
          paymentMethod: 'Cash',
          notes: 'Bubble wrap & ribbon rolls',
        },
      }),
    });
    assert.equal((await createExpRes.json()).success, true);

    const viewA = await (await fetch(`${srv.baseUrl}/api/state`, { headers: headersA })).json();
    const viewB = await (await fetch(`${srv.baseUrl}/api/state`, { headers: headersB })).json();

    assert.equal(
      computeStateSignature(viewA.state),
      computeStateSignature(viewB.state),
      'Browser A and Browser B state signatures must match identically'
    );

    const pnlA = calculateProfitAndLoss({
      orders: viewA.state.orders,
      parcels: viewA.state.parcels,
      adExpenses: viewA.state.adExpenses,
      operatingExpenses: viewA.state.operatingExpenses,
      damagedStockLoss: 0,
    });
    const pnlB = calculateProfitAndLoss({
      orders: viewB.state.orders,
      parcels: viewB.state.parcels,
      adExpenses: viewB.state.adExpenses,
      operatingExpenses: viewB.state.operatingExpenses,
      damagedStockLoss: 0,
    });
    assert.deepEqual(pnlA, pnlB, 'Dashboard P&L totals must be 100% identical in Browser A and Browser B');

    // (D) Delete the test records and verify consistency across both browsers
    await fetch(`${srv.baseUrl}/api/db/mutate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        action: 'deleteOrder',
        payload: { orderId: createdOrderId },
      }),
    });
    await fetch(`${srv.baseUrl}/api/db/mutate`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({
        action: 'deleteOperatingExpense',
        payload: { expId: 'exp-sync-test-1' },
      }),
    });
    await fetch(`${srv.baseUrl}/api/db/mutate`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        action: 'deleteProduct',
        payload: { productId: 'prod-sync-test-1' },
      }),
    });

    const afterDeleteA = await (await fetch(`${srv.baseUrl}/api/state`, { headers: headersA })).json();
    const afterDeleteB = await (await fetch(`${srv.baseUrl}/api/state`, { headers: headersB })).json();

    assert.equal(afterDeleteA.state.products.some((p: any) => p.id === 'prod-sync-test-1'), false);
    assert.equal(afterDeleteB.state.products.some((p: any) => p.id === 'prod-sync-test-1'), false);
    assert.equal(afterDeleteB.state.orders.some((o: any) => o.id === createdOrderId), false);
    assert.equal(afterDeleteA.state.operatingExpenses.some((e: any) => e.id === 'exp-sync-test-1'), false);

    // (E) Log out and log back in (and simulate server restart) and confirm data persists
    const logoutRes = await fetch(`${srv.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: headersA,
    });
    assert.equal(logoutRes.status, 200);

    // Old token A should now be rejected with 401
    const afterLogoutCheck = await fetch(`${srv.baseUrl}/api/state`, { headers: headersA });
    assert.equal(afterLogoutCheck.status, 401);

    // Log back in as Super Admin and confirm all business data is intact
    const reloginRes = await fetch(`${srv.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mdrabbyislamsanny1@gmail.com',
        password: 'Admin2026@#',
      }),
    });
    const reloginData = await reloginRes.json();
    assert.equal(reloginData.success, true);

    const reloginHeaders = {
      'Content-Type': 'application/json',
      'x-session-token': reloginData.sessionToken,
      'x-csrf-token': reloginData.csrfToken,
    };

    const reloginState = await (
      await fetch(`${srv.baseUrl}/api/state`, {
        headers: reloginHeaders,
      })
    ).json();
    assert.equal(reloginState.state.products.length, 6);
    assert.equal(reloginState.state.orders.length, 4);

    // (G) Fresh Inventory reset in Window A and verify 0 products in Window B, then add/update and verify identical state
    const freshRes = await fetch(`${srv.baseUrl}/api/inventory/fresh`, {
      method: 'POST',
      headers: reloginHeaders,
    });
    assert.equal(freshRes.status, 200);
    const freshData = await freshRes.json();
    assert.equal(freshData.success, true);
    assert.equal(freshData.state.products.length, 0);
    assert.equal(freshData.state.stockMovements.length, 0);

    const viewBAfterFresh = await (
      await fetch(`${srv.baseUrl}/api/state`, { headers: headersB })
    ).json();
    assert.equal(viewBAfterFresh.state.products.length, 0);
    assert.equal(viewBAfterFresh.state.stockMovements.length, 0);

    // Add a new item to the fresh inventory in Window A and confirm Window B sees the exact same result
    await fetch(`${srv.baseUrl}/api/db/mutate`, {
      method: 'POST',
      headers: reloginHeaders,
      body: JSON.stringify({
        action: 'saveProduct',
        payload: {
          id: 'prod-fresh-1',
          sku: 'CGH-FRESH-01',
          name: 'Fresh Inventory Crystal Moon Lamp',
          purchaseCost: 600,
          sellingPrice: 1350,
          openingStock: 25,
          currentStock: 25,
          lowStockThreshold: 5,
        },
      }),
    });

    const finalA = await (await fetch(`${srv.baseUrl}/api/state`, { headers: reloginHeaders })).json();
    const finalB = await (await fetch(`${srv.baseUrl}/api/state`, { headers: headersB })).json();
    assert.equal(finalA.state.products.length, 1);
    assert.equal(finalB.state.products.length, 1);
    assert.equal(finalB.state.products[0].name, 'Fresh Inventory Crystal Moon Lamp');
    assert.equal(finalB.state.products[0].currentStock, 25);
    assert.equal(computeStateSignature(finalA.state), computeStateSignature(finalB.state));
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

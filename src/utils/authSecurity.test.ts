import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  generateSalt,
  getDefaultRolePermissions,
  hashPasswordSync,
  hasPermission,
  isLastActiveSuperAdmin,
  LoginRateLimiter,
  parseCookies,
  sanitizeAuditDetails,
  sanitizeUserForClient,
  ServerSessionStore,
  validateInitialSuperAdminSetup,
  validateUserModification,
  verifyPasswordSync,
} from './authSecurity';
import { UserAccount } from '../types/database';
import { createApp } from '../../server';

test('Password hashing never stores plain-text and verifies accurately with salt', () => {
  const salt1 = generateSalt();
  const salt2 = generateSalt();
  const plain = 'Admin@123';

  const hash1 = hashPasswordSync(plain, salt1);
  const hash2 = hashPasswordSync(plain, salt2);

  assert.equal(hash1.includes(plain), false, 'Hash must never contain plain-text password');
  assert.ok(hash1.startsWith('pbkdf2_cgh$'), 'Hash must use pbkdf2_cgh prefix');
  assert.notEqual(hash1, hash2, 'Different salts must yield different hashes');

  assert.equal(verifyPasswordSync(plain, salt1, hash1), true);
  assert.equal(verifyPasswordSync('WrongPass', salt1, hash1), false);
});

test('Role-Based Access Control (RBAC) enforces module & action permissions per role', () => {
  const perms = getDefaultRolePermissions();

  const superAdmin = { role: 'super_admin' as const, isActive: true };
  const orderManager = { role: 'order_manager' as const, isActive: true };
  const inventoryManager = { role: 'inventory_manager' as const, isActive: true };
  const accountant = { role: 'accountant' as const, isActive: true };
  const staff = { role: 'staff' as const, isActive: true };
  const inactiveAdmin = { role: 'super_admin' as const, isActive: false };

  // Super Admin has full access
  assert.equal(hasPermission(superAdmin, perms, 'users', 'delete'), true);
  assert.equal(hasPermission(superAdmin, perms, 'accounting', 'approve'), true);

  // Deactivated user has zero access even if Super Admin
  assert.equal(hasPermission(inactiveAdmin, perms, 'dashboard', 'view'), false);

  // Order Manager can create/approve orders and AI order entry, but cannot delete users or edit accounting
  assert.equal(hasPermission(orderManager, perms, 'orders', 'create'), true);
  assert.equal(hasPermission(orderManager, perms, 'ai_order_entry', 'create'), true);
  assert.equal(hasPermission(orderManager, perms, 'users', 'create'), false);
  assert.equal(hasPermission(orderManager, perms, 'accounting', 'edit'), false);

  // Inventory Manager can edit inventory & purchases, but cannot create orders
  assert.equal(hasPermission(inventoryManager, perms, 'inventory', 'edit'), true);
  assert.equal(hasPermission(inventoryManager, perms, 'purchases', 'create'), true);
  assert.equal(hasPermission(inventoryManager, perms, 'orders', 'create'), false);

  // Accountant can manage accounting & expenses, but cannot manage users
  assert.equal(hasPermission(accountant, perms, 'accounting', 'create'), true);
  assert.equal(hasPermission(accountant, perms, 'expenses', 'approve'), true);
  assert.equal(hasPermission(accountant, perms, 'users', 'edit'), false);

  // Staff can create orders and use AI Order Entry, but cannot delete orders or view accounting
  assert.equal(hasPermission(staff, perms, 'ai_order_entry', 'create'), true);
  assert.equal(hasPermission(staff, perms, 'orders', 'delete'), false);
  assert.equal(hasPermission(staff, perms, 'accounting', 'view'), false);
});

test('Prevents disabling, demoting, or deleting the last active Super Admin', () => {
  const perms = getDefaultRolePermissions();
  const super1: Pick<UserAccount, 'id' | 'username' | 'role' | 'isActive'> = {
    id: 'u-1',
    username: 'admin',
    role: 'super_admin',
    isActive: true,
  };
  const adminUser: Pick<UserAccount, 'id' | 'username' | 'role' | 'isActive'> = {
    id: 'u-2',
    username: 'rafiq',
    role: 'admin',
    isActive: true,
  };

  assert.equal(isLastActiveSuperAdmin('u-1', [super1, adminUser]), true);

  const delCheck = validateUserModification({
    actor: super1,
    rolePermissions: perms,
    targetUser: super1,
    allUsers: [super1, adminUser],
    operation: 'delete',
  });
  assert.equal(delCheck.allowed, false);
  assert.ok(delCheck.error?.includes('last active Super Admin'));

  const deactCheck = validateUserModification({
    actor: super1,
    rolePermissions: perms,
    targetUser: super1,
    allUsers: [super1, adminUser],
    operation: 'deactivate',
  });
  assert.equal(deactCheck.allowed, false);

  const demoteCheck = validateUserModification({
    actor: super1,
    rolePermissions: perms,
    targetUser: super1,
    allUsers: [super1, adminUser],
    operation: 'change_role',
    newRole: 'admin',
  });
  assert.equal(demoteCheck.allowed, false);

  const super2: Pick<UserAccount, 'id' | 'username' | 'role' | 'isActive'> = {
    id: 'u-3',
    username: 'super2',
    role: 'super_admin',
    isActive: true,
  };
  const allowedWhenTwo = validateUserModification({
    actor: super1,
    rolePermissions: perms,
    targetUser: super2,
    allUsers: [super1, super2, adminUser],
    operation: 'deactivate',
  });
  assert.equal(allowedWhenTwo.allowed, true);
});

test('Audit log sanitizer and user client sanitizer redact passwords, salts, and hashes', () => {
  const raw = 'User login with password: MySecretPassword123 and token=abc999 hash pbkdf2_cgh$1234567890abcdef';
  const clean = sanitizeAuditDetails(raw);
  assert.equal(clean.includes('MySecretPassword123'), false);
  assert.equal(clean.includes('abc999'), false);
  assert.ok(clean.includes('[REDACTED]'));

  const mockUser: UserAccount = {
    id: 'u-1',
    username: 'admin',
    fullName: 'Owner',
    email: 'owner@cgh.com.bd',
    phone: '01800000000',
    role: 'super_admin',
    passwordSalt: 'secret_salt_999',
    passwordHash: 'pbkdf2_cgh$abcdef1234567890abcdef1234567890',
    isActive: true,
    sessionVersion: 1,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
  const sanitized = sanitizeUserForClient(mockUser);
  assert.equal(sanitized.passwordSalt, '[REDACTED]');
  assert.ok(sanitized.passwordHash.endsWith('...[PROTECTED]'));
});

test('LoginRateLimiter locks out after max failed attempts and resets on success or window expiry', () => {
  const limiter = new LoginRateLimiter({ maxAttempts: 3, windowMs: 60_000, lockoutMs: 120_000 });
  const key = '127.0.0.1:admin';
  const t0 = 1_000_000;

  assert.equal(limiter.check(key, t0).allowed, true);
  assert.equal(limiter.recordFailure(key, t0).locked, false);
  assert.equal(limiter.recordFailure(key, t0 + 1000).locked, false);

  const third = limiter.recordFailure(key, t0 + 2000);
  assert.equal(third.locked, true);
  assert.equal(third.remainingAttempts, 0);

  const blockedCheck = limiter.check(key, t0 + 5000);
  assert.equal(blockedCheck.allowed, false);
  assert.ok(blockedCheck.retryAfterSeconds > 100);

  // After lockout duration expires, login is allowed again
  const afterExpiry = limiter.check(key, t0 + 125_000);
  assert.equal(afterExpiry.allowed, true);
});

test('ServerSessionStore enforces TTL expiration, user deactivation, and sessionVersion rotation', () => {
  const store = new ServerSessionStore(10_000); // 10s TTL
  const baseUser: UserAccount = {
    id: 'user-1',
    username: 'admin',
    fullName: 'Md. Rabby Islam Sanny',
    email: 'mdrabbyislamsanny1@gmail.com',
    phone: '01819234567',
    role: 'super_admin',
    passwordSalt: 's1',
    passwordHash: 'h1',
    isActive: true,
    sessionVersion: 1,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  const t0 = 5_000_000;
  const sess = store.createSession(baseUser, 10_000, t0);
  assert.ok(sess.token.startsWith('cgh_sess_'));
  assert.ok(sess.csrfToken.startsWith('cgh_csrf_'));

  // Valid within TTL
  const validRes = store.validateSession(sess.token, [baseUser], t0 + 5000);
  assert.equal(validRes.valid, true);

  // Invalid when sessionVersion increments (e.g. password reset)
  const rotatedUser = { ...baseUser, sessionVersion: 2 };
  const rotatedRes = store.validateSession(sess.token, [rotatedUser], t0 + 6000);
  assert.equal(rotatedRes.valid, false);

  // Create another session and test TTL expiration
  const sess2 = store.createSession(baseUser, 10_000, t0);
  const expiredRes = store.validateSession(sess2.token, [baseUser], t0 + 15_000);
  assert.equal(expiredRes.valid, false);
  assert.ok(expiredRes.reason?.includes('expired'));
});

test('One-time initial Super Admin setup succeeds once and is permanently disabled thereafter', () => {
  const firstSetup = validateInitialSuperAdminSetup([], {
    username: 'admin',
    fullName: 'Md. Rabby Islam Sanny',
    email: 'mdrabbyislamsanny1@gmail.com',
    phone: '01819234567',
    passwordPlain: 'Admin2026@#',
  });
  assert.equal(firstSetup.allowed, true);
  assert.equal(firstSetup.status, 201);
  assert.ok(firstSetup.user);

  // Second attempt when Super Admin exists must be rejected with 403
  const secondSetup = validateInitialSuperAdminSetup([firstSetup.user!], {
    username: 'attacker',
    fullName: 'Attacker',
    email: 'attacker@example.com',
    passwordPlain: 'AttackerPass123!',
  });
  assert.equal(secondSetup.allowed, false);
  assert.equal(secondSetup.status, 403);
});

test('End-to-End Backend API Security: unauthenticated 401s, one-time setup locking, rate limiting, CSRF, RBAC, and logout', async () => {
  // 1. Test One-Time Initial Super Admin Setup on fresh uninitialized server
  const emptyApp = createApp({ initialEmptySetup: true, persistFilePath: null });
  const emptyServer = http.createServer(emptyApp);
  await new Promise<void>((resolve) => emptyServer.listen(0, '127.0.0.1', resolve));
  const emptyPort = (emptyServer.address() as any).port;
  const emptyBase = `http://127.0.0.1:${emptyPort}`;

  try {
    const statusBefore = await fetch(`${emptyBase}/api/auth/status`).then((r) => r.json());
    assert.equal(statusBefore.authenticated, false);
    assert.equal(statusBefore.setupRequired, true);

    // Setup first Super Admin
    const setupRes = await fetch(`${emptyBase}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Md. Rabby Islam Sanny',
        username: 'admin',
        email: 'mdrabbyislamsanny1@gmail.com',
        phone: '01819234567',
        password: 'Admin2026@#',
      }),
    });
    assert.equal(setupRes.status, 201);

    // Attempting setup a second time must be permanently forbidden (403)
    const secondSetupRes = await fetch(`${emptyBase}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Hacker',
        username: 'hacker',
        email: 'hacker@example.com',
        password: 'Password123!',
      }),
    });
    assert.equal(secondSetupRes.status, 403);
  } finally {
    await new Promise<void>((resolve) => emptyServer.close(() => resolve()));
  }

  // 2. Test Standard Server with Owner Account, Protected Routes, Rate Limiting, CSRF, and Session Revocation
  const app = createApp({ persistFilePath: null, maxLoginAttempts: 4 });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Unauthenticated API requests to private routes must return 401
    const unauthState = await fetch(`${baseUrl}/api/state`);
    assert.equal(unauthState.status, 401);

    const unauthAi = await fetch(`${baseUrl}/api/ai/parse-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: 'Customer: Rahim; Phone: 01712345678' }),
    });
    assert.equal(unauthAi.status, 401);

    const unauthUsers = await fetch(`${baseUrl}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test' }),
    });
    assert.equal(unauthUsers.status, 401);

    // Rate limiting check for repeated wrong passwords on an unknown account
    for (let i = 0; i < 4; i++) {
      const badRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'brute_target', password: 'WrongPassword!' }),
      });
      assert.equal(badRes.status, 401);
    }
    const rateLimitedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'brute_target', password: 'WrongPassword!' }),
    });
    assert.equal(rateLimitedRes.status, 429);

    // Valid login with main owner Super Admin email & password
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'mdrabbyislamsanny1@gmail.com',
        password: 'Admin2026@#',
      }),
    });
    assert.equal(loginRes.status, 200);
    const setCookieHeader = loginRes.headers.get('set-cookie') || '';
    assert.ok(setCookieHeader.includes('cgh_session='));
    assert.ok(setCookieHeader.includes('HttpOnly'));

    const cookies = parseCookies(setCookieHeader.split(';')[0]);
    const sessionCookie = `cgh_session=${cookies['cgh_session']}`;
    const loginData = await loginRes.json();
    assert.equal(loginData.success, true);
    assert.equal(loginData.user.email, 'mdrabbyislamsanny1@gmail.com');
    assert.equal(loginData.user.passwordSalt, '[REDACTED]');
    const csrfToken = loginData.csrfToken;
    assert.ok(csrfToken);

    // Authenticated GET /api/state succeeds
    const authStateRes = await fetch(`${baseUrl}/api/state`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(authStateRes.status, 200);
    const statePayload = await authStateRes.json();
    assert.equal(statePayload.success, true);
    assert.ok(Array.isArray(statePayload.state.orders));

    // Mutating POST without CSRF token is rejected with 403
    const noCsrfRes = await fetch(`${baseUrl}/api/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        username: 'new_admin',
        fullName: 'New Admin',
        email: 'newadmin@cgh.com.bd',
        phone: '01700000000',
        role: 'admin',
        passwordPlain: 'AdminPass123',
      }),
    });
    assert.equal(noCsrfRes.status, 403);

    // Mutating POST with valid CSRF token succeeds
    const createUserRes = await fetch(`${baseUrl}/api/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({
        username: 'new_admin',
        fullName: 'New Admin',
        email: 'newadmin@cgh.com.bd',
        phone: '01700000000',
        role: 'admin',
        passwordPlain: 'AdminPass123',
      }),
    });
    assert.equal(createUserRes.status, 201);
    const createdUserData = await createUserRes.json();
    const newUserId = createdUserData.user.id;

    // Revoke the new user's access and verify they cannot log in (403)
    const revokeRes = await fetch(`${baseUrl}/api/users/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ userId: newUserId, reason: 'Security test revocation' }),
    });
    assert.equal(revokeRes.status, 200);

    const revokedLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'new_admin', password: 'AdminPass123' }),
    });
    assert.equal(revokedLoginRes.status, 403);

    // Logout invalidates the session
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    assert.equal(logoutRes.status, 200);

    // Subsequent GET /api/state with the old session cookie returns 401
    const afterLogoutRes = await fetch(`${baseUrl}/api/state`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(afterLogoutRes.status, 401);

    // Verify cross-origin iframe header authentication (x-session-token / Authorization: Bearer) without cookies
    const tokenLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-proto': 'https' },
      body: JSON.stringify({
        username: 'mdrabbyislamsanny1@gmail.com',
        password: 'Admin2026@#',
      }),
    });
    assert.equal(tokenLoginRes.status, 200);
    const httpsCookie = tokenLoginRes.headers.get('set-cookie') || '';
    assert.ok(httpsCookie.includes('SameSite=None'), 'HTTPS proxy must use SameSite=None');
    assert.ok(httpsCookie.includes('Secure'), 'HTTPS proxy must include Secure attribute');

    const tokenLoginData = await tokenLoginRes.json();
    assert.ok(tokenLoginData.sessionToken, 'Login response must return sessionToken');

    const headerStateRes = await fetch(`${baseUrl}/api/state`, {
      headers: {
        'x-session-token': tokenLoginData.sessionToken,
      },
    });
    assert.equal(headerStateRes.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('authClient resilient fallback authenticates with PBKDF2-CGH when backend returns HTML or network error', async () => {
  const { loginWithAuthServer, checkAuthSessionStatus, logoutFromAuthServer } = await import(
    './authClient'
  );

  const originalFetch = globalThis.fetch;
  try {
    // Simulate bare Vite or static server returning HTML<!doctype html> on /api/auth/login
    globalThis.fetch = async () =>
      new Response('<!doctype html><html><body>SPA</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });

    // Wrong password must still be rejected
    const badRes = await loginWithAuthServer('mdrabbyislamsanny1@gmail.com', 'WrongPass123');
    assert.equal(badRes.success, false);
    assert.ok(badRes.error?.includes('Invalid username or password'));

    // Valid Super Admin credentials must succeed without throwing "Network error while connecting to authentication server"
    const goodRes = await loginWithAuthServer('mdrabbyislamsanny1@gmail.com', 'Admin2026@#');
    assert.equal(goodRes.success, true);
    assert.equal(goodRes.user?.email, 'mdrabbyislamsanny1@gmail.com');
    assert.ok(goodRes.csrfToken);

    const statusRes = await checkAuthSessionStatus();
    assert.equal(statusRes.authenticated, true);
    assert.equal(statusRes.user?.username, 'admin');

    await logoutFromAuthServer(goodRes.csrfToken);
    const afterLogoutStatus = await checkAuthSessionStatus();
    assert.equal(afterLogoutStatus.authenticated, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


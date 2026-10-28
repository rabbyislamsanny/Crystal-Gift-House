import {
  AppModule,
  PermissionAction,
  RolePermissionMap,
  UserAccount,
  UserRole,
} from '../types/database';

export const ALL_MODULES: AppModule[] = [
  'dashboard',
  'orders',
  'ai_order_entry',
  'inventory',
  'purchases',
  'couriers',
  'expenses',
  'accounting',
  'customers',
  'reports',
  'users',
  'audit_logs',
  'settings',
];

export const ALL_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'approve',
];

export const ROLE_LABELS: Record<UserRole, { name: string; bangla: string; badgeClass: string; description: string }> = {
  super_admin: {
    name: 'Super Admin',
    bangla: 'সুপার অ্যাডমিন',
    badgeClass: 'bg-emerald-900 text-amber-300 border-emerald-700',
    description: 'Full unrestricted access to all modules, security settings, and Super Admin accounts.',
  },
  admin: {
    name: 'Admin',
    bangla: 'অ্যাডমিন',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    description: 'Configurable administrative access across operations, staff users, and reports.',
  },
  order_manager: {
    name: 'Order Manager',
    bangla: 'অর্ডার ম্যানেজার',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    description: 'Manages manual orders, AI order entry, customer records, and courier dispatches.',
  },
  inventory_manager: {
    name: 'Inventory Manager',
    bangla: 'ইনভেন্টরি ম্যানেজার',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Manages product catalogue, stock adjustments, purchase orders, and suppliers.',
  },
  accountant: {
    name: 'Accountant',
    bangla: 'অ্যাকাউন্ট্যান্ট',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Manages Cash In/Out ledger, courier settlements, ad spend, operating expenses, and P&L.',
  },
  staff: {
    name: 'Staff',
    bangla: 'স্টাফ',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Creates draft orders and uses AI Order Entry; cannot delete records or view sensitive financials.',
  },
};

export function getDefaultRolePermissions(): RolePermissionMap {
  const fullModuleMap = (): Record<AppModule, PermissionAction[]> => {
    const map = {} as Record<AppModule, PermissionAction[]>;
    for (const mod of ALL_MODULES) {
      map[mod] = [...ALL_ACTIONS];
    }
    return map;
  };

  return {
    super_admin: fullModuleMap(),
    admin: {
      dashboard: ['view', 'export'],
      orders: ['view', 'create', 'edit', 'delete', 'export', 'approve'],
      ai_order_entry: ['view', 'create', 'edit', 'approve'],
      inventory: ['view', 'create', 'edit', 'delete', 'export', 'approve'],
      purchases: ['view', 'create', 'edit', 'delete', 'export', 'approve'],
      couriers: ['view', 'create', 'edit', 'delete', 'export', 'approve'],
      expenses: ['view', 'create', 'edit', 'delete', 'export', 'approve'],
      accounting: ['view', 'create', 'edit', 'export', 'approve'],
      customers: ['view', 'create', 'edit', 'delete', 'export'],
      reports: ['view', 'export'],
      users: ['view', 'create', 'edit'],
      audit_logs: ['view', 'export'],
      settings: ['view', 'edit', 'export'],
    },
    order_manager: {
      dashboard: ['view'],
      orders: ['view', 'create', 'edit', 'export', 'approve'],
      ai_order_entry: ['view', 'create', 'edit', 'approve'],
      inventory: ['view'],
      purchases: [],
      couriers: ['view', 'create', 'edit', 'export'],
      expenses: [],
      accounting: [],
      customers: ['view', 'create', 'edit', 'export'],
      reports: ['view', 'export'],
      users: [],
      audit_logs: ['view'],
      settings: [],
    },
    inventory_manager: {
      dashboard: ['view'],
      orders: ['view'],
      ai_order_entry: [],
      inventory: ['view', 'create', 'edit', 'export', 'approve'],
      purchases: ['view', 'create', 'edit', 'export', 'approve'],
      couriers: ['view'],
      expenses: [],
      accounting: [],
      customers: [],
      reports: ['view', 'export'],
      users: [],
      audit_logs: ['view'],
      settings: [],
    },
    accountant: {
      dashboard: ['view', 'export'],
      orders: ['view', 'export'],
      ai_order_entry: [],
      inventory: ['view', 'export'],
      purchases: ['view', 'create', 'edit', 'export', 'approve'],
      couriers: ['view', 'edit', 'export', 'approve'],
      expenses: ['view', 'create', 'edit', 'export', 'approve'],
      accounting: ['view', 'create', 'edit', 'export', 'approve'],
      customers: ['view'],
      reports: ['view', 'export'],
      users: [],
      audit_logs: ['view', 'export'],
      settings: [],
    },
    staff: {
      dashboard: ['view'],
      orders: ['view', 'create', 'edit'],
      ai_order_entry: ['view', 'create', 'edit'],
      inventory: ['view'],
      purchases: [],
      couriers: ['view'],
      expenses: [],
      accounting: [],
      customers: ['view', 'create'],
      reports: [],
      users: [],
      audit_logs: [],
      settings: [],
    },
  };
}

/**
 * Generates a cryptographic-style random salt string.
 */
export function generateSalt(length: number = 16): string {
  const chars = 'abcdef0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let salt = 'cgh_s1_';
  for (let i = 0; i < length; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * Deterministic multi-round salted password key derivation (portable across browser & Node).
 * Never stores or returns plain-text passwords.
 */
export function hashPasswordSync(password: string, salt: string): string {
  if (!password) throw new Error('Password cannot be empty');
  const pepper = 'CrystalGiftHouse_BD_OS_v2_Pepper_9981';
  const input = `${salt}:${password}:${pepper}`;

  // 8x 32-bit state words (256-bit output) with 1,024 mixing rounds
  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  for (let round = 0; round < 1024; round++) {
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      const idx = (i + round) & 7;
      let val = state[idx] ^ (code + round * 31 + i * 17);
      val = Math.imul(val ^ (val >>> 15), 0x85ebca6b);
      val = Math.imul(val ^ (val >>> 13), 0xc2b2ae35);
      state[idx] = (val ^ (val >>> 16)) >>> 0;
      state[(idx + 1) & 7] = (state[(idx + 1) & 7] + state[idx]) >>> 0;
    }
  }

  return 'pbkdf2_cgh$' + state.map((w) => w.toString(16).padStart(8, '0')).join('');
}

/**
 * Constant-time verification of password against stored salt and hash.
 */
export function verifyPasswordSync(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  const computed = hashPasswordSync(password, salt);
  if (computed.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Checks whether a user has a specific permission on a module.
 */
export function hasPermission(
  user: Pick<UserAccount, 'role' | 'isActive' | 'customPermissions'> | null | undefined,
  rolePermissions: RolePermissionMap,
  module: AppModule,
  action: PermissionAction
): boolean {
  if (!user || !user.isActive) return false;
  if (user.role === 'super_admin') return true;

  if (user.customPermissions && user.customPermissions[module]) {
    return user.customPermissions[module]!.includes(action);
  }

  const roleMap = rolePermissions[user.role];
  if (!roleMap) return false;
  const allowedActions = roleMap[module] || [];
  return allowedActions.includes(action);
}

/**
 * Checks if targetUserId is the last active Super Admin in the system.
 */
export function isLastActiveSuperAdmin(
  targetUserId: string,
  allUsers: Array<Pick<UserAccount, 'id' | 'role' | 'isActive'>>
): boolean {
  const target = allUsers.find((u) => u.id === targetUserId);
  if (!target || target.role !== 'super_admin' || !target.isActive) {
    return false;
  }
  const activeSuperAdmins = allUsers.filter((u) => u.role === 'super_admin' && u.isActive);
  return activeSuperAdmins.length <= 1;
}

/**
 * Validates whether an actor can perform a sensitive operation on a target user.
 */
export function validateUserModification(params: {
  actor: Pick<UserAccount, 'id' | 'role' | 'isActive' | 'customPermissions'>;
  rolePermissions: RolePermissionMap;
  targetUser: Pick<UserAccount, 'id' | 'username' | 'role' | 'isActive'>;
  allUsers: Array<Pick<UserAccount, 'id' | 'role' | 'isActive'>>;
  operation: 'deactivate' | 'delete' | 'change_role' | 'edit' | 'reset_password' | 'revoke';
  newRole?: UserRole;
}): { allowed: boolean; error?: string } {
  const { actor, rolePermissions, targetUser, allUsers, operation, newRole } = params;

  if (!actor || !actor.isActive) {
    return { allowed: false, error: 'Unauthorized: Actor account is inactive or not logged in.' };
  }

  const requiredAction: PermissionAction = operation === 'delete' ? 'delete' : 'edit';
  if (!hasPermission(actor, rolePermissions, 'users', requiredAction)) {
    return {
      allowed: false,
      error: `Access denied: Role "${actor.role}" does not have "${requiredAction}" permission on User Management.`,
    };
  }

  // Only a Super Admin can modify or delete another Super Admin
  if (targetUser.role === 'super_admin' && actor.role !== 'super_admin') {
    return {
      allowed: false,
      error: 'Access denied: Only a Super Admin can modify or manage another Super Admin account.',
    };
  }

  if (newRole === 'super_admin' && actor.role !== 'super_admin') {
    return {
      allowed: false,
      error: 'Access denied: Only a Super Admin can promote a user to Super Admin.',
    };
  }

  // Protect the last active Super Admin from being deactivated, deleted, or demoted
  if (
    operation === 'deactivate' ||
    operation === 'delete' ||
    (operation === 'change_role' && newRole && newRole !== 'super_admin')
  ) {
    if (isLastActiveSuperAdmin(targetUser.id, allUsers)) {
      return {
        allowed: false,
        error: `Security rule violation: Cannot ${operation.replace('_', ' ')} "${targetUser.username}" because they are the last active Super Admin.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Sanitizes audit log details to ensure plain-text passwords, PINs, or tokens are never logged.
 */
export function sanitizeAuditDetails(details: string): string {
  if (!details) return '';
  return details
    .replace(/(password|passwd|pwd|pin|secret|token|apiKey)\s*[:=]\s*["']?[^\s,;)"']+["']?/gi, '$1: [REDACTED]')
    .replace(/pbkdf2_cgh\$[0-9a-f]+/gi, '[HASH_REDACTED]');
}

/**
 * Strips passwordSalt and raw passwordHash before sending user objects to the client.
 */
export function sanitizeUserForClient(user: UserAccount): UserAccount {
  return {
    ...user,
    passwordSalt: '[REDACTED]',
    passwordHash: user.passwordHash ? `${user.passwordHash.slice(0, 18)}...[PROTECTED]` : '[PROTECTED]',
  };
}

/**
 * Parses an HTTP Cookie header into key-value pairs.
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const rawVal = pair.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

/**
 * Generates a high-entropy random token for session IDs and CSRF tokens.
 */
export function generateSecureToken(prefix: string = 'cgh'): string {
  const chars = '0123456789abcdefABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomPart = '';
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 32; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

export interface RateLimitEntry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

/**
 * Tracks failed login attempts per IP/account and enforces temporary lockouts.
 */
export class LoginRateLimiter {
  private attempts = new Map<string, RateLimitEntry>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;

  constructor(options?: { maxAttempts?: number; windowMs?: number; lockoutMs?: number }) {
    this.maxAttempts = options?.maxAttempts ?? 5;
    this.windowMs = options?.windowMs ?? 15 * 60 * 1000; // 15 minutes
    this.lockoutMs = options?.lockoutMs ?? 15 * 60 * 1000; // 15 minutes lockout
  }

  private normalizeKey(key: string): string {
    return (key || 'unknown').trim().toLowerCase();
  }

  public check(key: string, nowMs: number = Date.now()): {
    allowed: boolean;
    remainingAttempts: number;
    retryAfterSeconds: number;
  } {
    const k = this.normalizeKey(key);
    const entry = this.attempts.get(k);
    if (!entry) {
      return { allowed: true, remainingAttempts: this.maxAttempts, retryAfterSeconds: 0 };
    }

    if (entry.lockedUntil > nowMs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.lockedUntil - nowMs) / 1000));
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }

    if (nowMs - entry.firstFailureAt > this.windowMs) {
      this.attempts.delete(k);
      return { allowed: true, remainingAttempts: this.maxAttempts, retryAfterSeconds: 0 };
    }

    const remainingAttempts = Math.max(0, this.maxAttempts - entry.failures);
    return { allowed: remainingAttempts > 0, remainingAttempts, retryAfterSeconds: 0 };
  }

  public recordFailure(key: string, nowMs: number = Date.now()): {
    locked: boolean;
    remainingAttempts: number;
    retryAfterSeconds: number;
  } {
    const k = this.normalizeKey(key);
    const existing = this.attempts.get(k);

    if (!existing || nowMs - existing.firstFailureAt > this.windowMs || (existing.lockedUntil > 0 && existing.lockedUntil <= nowMs)) {
      const failures = 1;
      const locked = failures >= this.maxAttempts;
      const lockedUntil = locked ? nowMs + this.lockoutMs : 0;
      this.attempts.set(k, { failures, firstFailureAt: nowMs, lockedUntil });
      return {
        locked,
        remainingAttempts: Math.max(0, this.maxAttempts - failures),
        retryAfterSeconds: locked ? Math.ceil(this.lockoutMs / 1000) : 0,
      };
    }

    existing.failures += 1;
    if (existing.failures >= this.maxAttempts) {
      existing.lockedUntil = nowMs + this.lockoutMs;
    }
    this.attempts.set(k, existing);

    const locked = existing.lockedUntil > nowMs;
    const retryAfterSeconds = locked ? Math.max(1, Math.ceil((existing.lockedUntil - nowMs) / 1000)) : 0;
    return {
      locked,
      remainingAttempts: Math.max(0, this.maxAttempts - existing.failures),
      retryAfterSeconds,
    };
  }

  public reset(key: string): void {
    this.attempts.delete(this.normalizeKey(key));
  }

  public clearAll(): void {
    this.attempts.clear();
  }
}

export interface ServerSessionRecord {
  token: string;
  csrfToken: string;
  userId: string;
  username: string;
  role: UserRole;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Authoritative server-side session store with expiration, CSRF token pairing,
 * and automatic invalidation when a user's sessionVersion changes or account is deactivated.
 */
export class ServerSessionStore {
  private sessions = new Map<string, ServerSessionRecord>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 12 * 60 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public createSession(
    user: Pick<UserAccount, 'id' | 'username' | 'role' | 'sessionVersion'>,
    ttlMs: number = this.defaultTtlMs,
    nowMs: number = Date.now()
  ): ServerSessionRecord {
    const token = generateSecureToken('cgh_sess');
    const csrfToken = generateSecureToken('cgh_csrf');
    const record: ServerSessionRecord = {
      token,
      csrfToken,
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionVersion: user.sessionVersion || 1,
      issuedAt: nowMs,
      expiresAt: nowMs + ttlMs,
    };
    this.sessions.set(token, record);
    return record;
  }

  public validateSession(
    token: string | undefined,
    users: UserAccount[],
    nowMs: number = Date.now()
  ): {
    valid: boolean;
    session?: ServerSessionRecord;
    user?: UserAccount;
    reason?: string;
  } {
    if (!token) {
      return { valid: false, reason: 'No session token provided.' };
    }
    const session = this.sessions.get(token);
    if (!session) {
      return { valid: false, reason: 'Session not found or already logged out.' };
    }
    if (nowMs > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false, reason: 'Session has expired. Please log in again.' };
    }

    const user = users.find((u) => u.id === session.userId);
    if (!user) {
      this.sessions.delete(token);
      return { valid: false, reason: 'User account no longer exists.' };
    }
    if (!user.isActive || user.revokedAt) {
      this.sessions.delete(token);
      return { valid: false, reason: 'User account is deactivated or access has been revoked.' };
    }
    if ((user.sessionVersion || 1) !== session.sessionVersion) {
      this.sessions.delete(token);
      return { valid: false, reason: 'Session invalidated due to password reset or security rotation.' };
    }

    return { valid: true, session, user };
  }

  public invalidateSession(token: string | undefined): boolean {
    if (!token) return false;
    return this.sessions.delete(token);
  }

  public invalidateUserSessions(userId: string): number {
    let removed = 0;
    for (const [token, sess] of this.sessions.entries()) {
      if (sess.userId === userId) {
        this.sessions.delete(token);
        removed++;
      }
    }
    return removed;
  }

  public exportSessions(nowMs: number = Date.now()): ServerSessionRecord[] {
    const active: ServerSessionRecord[] = [];
    for (const [token, sess] of this.sessions.entries()) {
      if (sess.expiresAt > nowMs) {
        active.push({ ...sess });
      } else {
        this.sessions.delete(token);
      }
    }
    return active;
  }

  public hydrateSessions(records: ServerSessionRecord[], nowMs: number = Date.now()): void {
    if (!Array.isArray(records)) return;
    for (const rec of records) {
      if (rec && rec.token && rec.csrfToken && rec.userId && rec.expiresAt > nowMs) {
        this.sessions.set(rec.token, { ...rec });
      }
    }
  }
}

/**
 * Validates and constructs the one-time initial Super Admin account.
 * Permanently rejects setup once any Super Admin account already exists.
 */
export function validateInitialSuperAdminSetup(
  existingUsers: UserAccount[],
  input: {
    username: string;
    fullName: string;
    email: string;
    phone?: string;
    passwordPlain: string;
  }
): {
  allowed: boolean;
  status: number;
  user?: UserAccount;
  error?: string;
} {
  const hasSuperAdmin = existingUsers.some((u) => u.role === 'super_admin');
  if (hasSuperAdmin) {
    return {
      allowed: false,
      status: 403,
      error: 'Initial Super Admin setup has already been completed and is permanently disabled.',
    };
  }

  const cleanUsername = (input.username || '').trim().toLowerCase();
  const cleanFullName = (input.fullName || '').trim();
  const cleanEmail = (input.email || '').trim().toLowerCase();
  const cleanPhone = (input.phone || '').trim();
  const passwordPlain = input.passwordPlain || '';

  if (!cleanUsername || cleanUsername.length < 3) {
    return { allowed: false, status: 400, error: 'Username must be at least 3 characters.' };
  }
  if (!cleanFullName || cleanFullName.length < 2) {
    return { allowed: false, status: 400, error: 'Full name is required.' };
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { allowed: false, status: 400, error: 'A valid email address is required.' };
  }
  if (!passwordPlain || passwordPlain.length < 8) {
    return {
      allowed: false,
      status: 400,
      error: 'Initial Super Admin password must be at least 8 characters.',
    };
  }

  const salt = generateSalt();
  const passwordHash = hashPasswordSync(passwordPlain, salt);
  const now = new Date().toISOString();

  const newUser: UserAccount = {
    id: 'user-1',
    username: cleanUsername,
    fullName: cleanFullName,
    email: cleanEmail,
    phone: cleanPhone,
    role: 'super_admin',
    passwordSalt: salt,
    passwordHash,
    isActive: true,
    sessionVersion: 1,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };

  return { allowed: true, status: 201, user: newUser };
}


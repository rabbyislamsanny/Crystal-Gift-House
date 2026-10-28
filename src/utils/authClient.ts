import {
  AppModule,
  DatabaseState,
  PermissionAction,
  UserAccount,
  UserRole,
} from '../types/database';
import { db } from '../db/database';
import {
  LoginRateLimiter,
  sanitizeUserForClient,
  ServerSessionStore,
} from './authSecurity';
import {
  computeStateSignature,
  findUnsyncedLocalRecords,
} from './stateSync';

const ACTIVE_SESSION_STORAGE_KEY = 'cgh_active_session_v1';
const LOCAL_SESSION_STORE_KEY = 'cgh_local_session_record_v1';
const LOCAL_RECONCILED_FLAG_KEY = 'cgh_server_reconciled_v1';
export const SYNC_BROADCAST_CHANNEL_NAME = 'cgh_business_os_sync_v1';
export const SYNC_STORAGE_PING_KEY = 'cgh_last_sync_ping_v1';

interface StoredSessionTokens {
  sessionToken: string;
  csrfToken: string;
  expiresAt?: string;
}

interface PersistedLocalSession {
  token: string;
  csrfToken: string;
  userId: string;
  username: string;
  role: UserRole;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
}

let inMemorySessionToken = '';
let inMemoryCsrfToken = '';
let inMemoryServerRevision = 0;
let inMemoryStateSignature = '';

const fallbackSessionStore = new ServerSessionStore(12 * 60 * 60 * 1000);
const fallbackRateLimiter = new LoginRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
});

export function getLastKnownServerRevision(): number {
  return inMemoryServerRevision;
}

export function getLastKnownStateSignature(): string {
  return inMemoryStateSignature;
}

export function updateLastKnownSyncMeta(revision?: number, signature?: string, state?: DatabaseState): void {
  if (typeof revision === 'number' && revision > 0) {
    inMemoryServerRevision = revision;
  }
  if (typeof signature === 'string' && signature) {
    inMemoryStateSignature = signature;
  } else if (state) {
    inMemoryStateSignature = computeStateSignature(state);
  }
}

export function broadcastStateSyncEvent(eventType: 'state_updated' | 'logged_out' = 'state_updated', revision?: number): void {
  const payload = {
    type: eventType,
    revision: revision ?? inMemoryServerRevision,
    timestamp: Date.now(),
  };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(SYNC_BROADCAST_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // ignore BroadcastChannel issues
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SYNC_STORAGE_PING_KEY, JSON.stringify(payload));
    }
  } catch {
    // ignore storage issues
  }
}

function loadStoredTokens(): StoredSessionTokens | null {
  if (inMemorySessionToken && inMemoryCsrfToken) {
    return {
      sessionToken: inMemorySessionToken,
      csrfToken: inMemoryCsrfToken,
    };
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSessionTokens;
        if (parsed?.sessionToken && parsed?.csrfToken) {
          inMemorySessionToken = parsed.sessionToken;
          inMemoryCsrfToken = parsed.csrfToken;
          return parsed;
        }
      }
    }
    if (typeof localStorage !== 'undefined') {
      const rawLocal = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal) as StoredSessionTokens;
        if (parsed?.sessionToken && parsed?.csrfToken) {
          inMemorySessionToken = parsed.sessionToken;
          inMemoryCsrfToken = parsed.csrfToken;
          return parsed;
        }
      }
    }
  } catch {
    // ignore storage access issues
  }
  return null;
}

export function setActiveSessionTokens(sessionToken?: string, csrfToken?: string, expiresAt?: string): void {
  if (sessionToken) inMemorySessionToken = sessionToken;
  if (csrfToken) inMemoryCsrfToken = csrfToken;
  try {
    if (inMemorySessionToken && inMemoryCsrfToken) {
      const serialized = JSON.stringify({
        sessionToken: inMemorySessionToken,
        csrfToken: inMemoryCsrfToken,
        expiresAt,
      });
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, serialized);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, serialized);
      }
    }
  } catch {
    // ignore storage access issues
  }
}

export function clearActiveSessionTokens(): void {
  inMemorySessionToken = '';
  inMemoryCsrfToken = '';
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(LOCAL_SESSION_STORE_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      localStorage.removeItem(LOCAL_SESSION_STORE_KEY);
    }
  } catch {
    // ignore storage access issues
  }
}

export function getActiveSessionTokens(): { sessionToken: string; csrfToken: string } {
  const stored = loadStoredTokens();
  return {
    sessionToken: stored?.sessionToken || inMemorySessionToken,
    csrfToken: stored?.csrfToken || inMemoryCsrfToken,
  };
}

function saveFallbackSessionRecord(record: PersistedLocalSession): void {
  try {
    const serialized = JSON.stringify(record);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(LOCAL_SESSION_STORE_KEY, serialized);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_SESSION_STORE_KEY, serialized);
    }
  } catch {
    // ignore
  }
}

function getFallbackSessionRecord(): PersistedLocalSession | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(LOCAL_SESSION_STORE_KEY);
      if (raw) {
        return JSON.parse(raw) as PersistedLocalSession;
      }
    }
    if (typeof localStorage !== 'undefined') {
      const rawLocal = localStorage.getItem(LOCAL_SESSION_STORE_KEY);
      if (rawLocal) {
        return JSON.parse(rawLocal) as PersistedLocalSession;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function buildAuthHeaders(extraCsrfToken?: string): Record<string, string> {
  const { sessionToken, csrfToken } = getActiveSessionTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (sessionToken) {
    headers['x-session-token'] = sessionToken;
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  const effectiveCsrf = extraCsrfToken || csrfToken;
  if (effectiveCsrf) {
    headers['x-csrf-token'] = effectiveCsrf;
  }
  return headers;
}

interface SafeFetchResult<T = any> {
  reachable: boolean;
  ok: boolean;
  status: number;
  data?: T;
}

export async function safeApiFetch<T = any>(
  url: string,
  options: RequestInit = {},
  csrfTokenOverride?: string
): Promise<SafeFetchResult<T>> {
  try {
    const mergedHeaders: Record<string, string> = {
      ...buildAuthHeaders(csrfTokenOverride),
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: mergedHeaders,
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!contentType.toLowerCase().includes('application/json')) {
      // Check if body is still valid JSON despite missing header
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed) as T;
          return {
            reachable: true,
            ok: response.ok,
            status: response.status,
            data: parsed,
          };
        } catch {
          return { reachable: false, ok: false, status: response.status };
        }
      }
      // HTML 404 / SPA fallback from static server or bare Vite
      return { reachable: false, ok: false, status: response.status };
    }

    const parsed = JSON.parse(text) as T;
    return {
      reachable: true,
      ok: response.ok,
      status: response.status,
      data: parsed,
    };
  } catch {
    return { reachable: false, ok: false, status: 0 };
  }
}

function validateFallbackSession(): {
  valid: boolean;
  user?: UserAccount;
  sessionToken?: string;
  csrfToken?: string;
} {
  const { sessionToken } = getActiveSessionTokens();
  if (!sessionToken) return { valid: false };

  const memCheck = fallbackSessionStore.validateSession(sessionToken, db.getUsers());
  if (memCheck.valid && memCheck.user && memCheck.session) {
    db.setCurrentUser(memCheck.user.id);
    return {
      valid: true,
      user: sanitizeUserForClient(memCheck.user),
      sessionToken: memCheck.session.token,
      csrfToken: memCheck.session.csrfToken,
    };
  }

  const persisted = getFallbackSessionRecord();
  if (!persisted || persisted.token !== sessionToken) {
    return { valid: false };
  }
  if (Date.now() > persisted.expiresAt) {
    clearActiveSessionTokens();
    return { valid: false };
  }

  const user = db.getUsers().find((u) => u.id === persisted.userId);
  if (!user || !user.isActive || user.revokedAt || user.sessionVersion !== persisted.sessionVersion) {
    clearActiveSessionTokens();
    return { valid: false };
  }

  db.setCurrentUser(user.id);
  return {
    valid: true,
    user: sanitizeUserForClient(user),
    sessionToken: persisted.token,
    csrfToken: persisted.csrfToken,
  };
}

export async function loginWithAuthServer(
  usernameOrEmail: string,
  passwordPlain: string
): Promise<{
  success: boolean;
  user?: UserAccount;
  csrfToken?: string;
  sessionToken?: string;
  error?: string;
  remainingAttempts?: number;
  retryAfterSeconds?: number;
}> {
  const cleanIdentifier = usernameOrEmail.trim();
  if (!cleanIdentifier || !passwordPlain) {
    return {
      success: false,
      error: 'Please enter both your username/email and password.',
    };
  }

  const res = await safeApiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: cleanIdentifier,
      password: passwordPlain,
    }),
  });

  if (res.reachable && res.data) {
    if (res.ok && res.data.success && res.data.user) {
      setActiveSessionTokens(
        res.data.sessionToken || `cgh_srv_${Date.now()}`,
        res.data.csrfToken,
        res.data.expiresAt
      );
      return {
        success: true,
        user: res.data.user,
        csrfToken: res.data.csrfToken,
        sessionToken: res.data.sessionToken,
      };
    }
    return {
      success: false,
      error: res.data.error || 'Authentication failed. Please check your credentials.',
      remainingAttempts: res.data.remainingAttempts,
      retryAfterSeconds: res.data.retryAfterSeconds,
    };
  }

  // Fallback to local salted PBKDF2-CGH authentication engine when backend route is unreachable
  const rateKey = `local:${cleanIdentifier.toLowerCase()}`;
  const rateCheck = fallbackRateLimiter.check(rateKey);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed login attempts. Account login is temporarily locked. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    };
  }

  const authResult = db.authenticateUser(cleanIdentifier, passwordPlain);
  if (!authResult.success || !authResult.user) {
    const failureStatus = fallbackRateLimiter.recordFailure(rateKey);
    return {
      success: false,
      error: authResult.error || 'Invalid username or password.',
      remainingAttempts: failureStatus.remainingAttempts,
      retryAfterSeconds: failureStatus.retryAfterSeconds,
    };
  }

  fallbackRateLimiter.reset(rateKey);
  const session = fallbackSessionStore.createSession(authResult.user);
  saveFallbackSessionRecord(session);
  setActiveSessionTokens(
    session.token,
    session.csrfToken,
    new Date(session.expiresAt).toISOString()
  );

  return {
    success: true,
    user: sanitizeUserForClient(authResult.user),
    csrfToken: session.csrfToken,
    sessionToken: session.token,
  };
}

export async function setupSuperAdminWithAuthServer(input: {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{
  success: boolean;
  user?: UserAccount;
  csrfToken?: string;
  sessionToken?: string;
  error?: string;
}> {
  const res = await safeApiFetch('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (res.reachable && res.data) {
    if (res.ok && res.data.success && res.data.user) {
      setActiveSessionTokens(
        res.data.sessionToken || `cgh_srv_${Date.now()}`,
        res.data.csrfToken,
        res.data.expiresAt
      );
      return {
        success: true,
        user: res.data.user,
        csrfToken: res.data.csrfToken,
        sessionToken: res.data.sessionToken,
      };
    }
    return {
      success: false,
      error: res.data.error || 'Initial Super Admin setup failed.',
    };
  }

  const localResult = db.setupInitialSuperAdmin({
    username: input.username,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    passwordPlain: input.password,
  });

  if (!localResult.success || !localResult.user) {
    return {
      success: false,
      error: localResult.error || 'Initial Super Admin setup is disabled.',
    };
  }

  const session = fallbackSessionStore.createSession(localResult.user);
  saveFallbackSessionRecord(session);
  setActiveSessionTokens(
    session.token,
    session.csrfToken,
    new Date(session.expiresAt).toISOString()
  );

  return {
    success: true,
    user: sanitizeUserForClient(localResult.user),
    csrfToken: session.csrfToken,
    sessionToken: session.token,
  };
}

async function reconcileLocalStateIfNeeded(
  serverState: DatabaseState,
  csrfToken?: string
): Promise<DatabaseState> {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_RECONCILED_FLAG_KEY) === '1') {
      return serverState;
    }
    const rawLocal = db.getRawSavedLocalState();
    if (!rawLocal) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_RECONCILED_FLAG_KEY, '1');
      }
      return serverState;
    }
    const check = findUnsyncedLocalRecords(rawLocal, serverState);
    if (!check.hasUnsynced) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_RECONCILED_FLAG_KEY, '1');
      }
      return serverState;
    }

    const reconcileRes = await safeApiFetch(
      '/api/state/reconcile',
      {
        method: 'POST',
        body: JSON.stringify({ state: rawLocal }),
      },
      csrfToken
    );

    if (reconcileRes.reachable && reconcileRes.ok && reconcileRes.data?.state) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_RECONCILED_FLAG_KEY, '1');
      }
      updateLastKnownSyncMeta(
        reconcileRes.data.revision,
        reconcileRes.data.signature,
        reconcileRes.data.state
      );
      broadcastStateSyncEvent('state_updated', reconcileRes.data.revision);
      return reconcileRes.data.state as DatabaseState;
    }
  } catch {
    // ignore reconciliation errors and preserve serverState
  }
  return serverState;
}

export async function checkAuthSessionStatus(): Promise<{
  authenticated: boolean;
  setupRequired: boolean;
  user?: UserAccount;
  csrfToken?: string;
  state?: DatabaseState;
  revision?: number;
}> {
  const statusRes = await safeApiFetch('/api/auth/status', { method: 'GET' });

  if (statusRes.reachable && statusRes.data) {
    if (!statusRes.data.authenticated || !statusRes.data.user) {
      clearActiveSessionTokens();
      return {
        authenticated: false,
        setupRequired: Boolean(statusRes.data.setupRequired),
      };
    }

    setActiveSessionTokens(
      statusRes.data.sessionToken,
      statusRes.data.csrfToken,
      statusRes.data.expiresAt
    );

    const stateRes = await safeApiFetch('/api/state', { method: 'GET' }, statusRes.data.csrfToken);
    if (stateRes.reachable && stateRes.ok && stateRes.data?.state) {
      const effectiveCsrf = stateRes.data.csrfToken || statusRes.data.csrfToken;
      if (effectiveCsrf) {
        setActiveSessionTokens(undefined, effectiveCsrf);
      }
      const unifiedState = await reconcileLocalStateIfNeeded(
        stateRes.data.state,
        effectiveCsrf
      );
      updateLastKnownSyncMeta(
        stateRes.data.revision,
        stateRes.data.signature,
        unifiedState
      );
      return {
        authenticated: true,
        setupRequired: false,
        user: stateRes.data.currentUser || statusRes.data.user,
        csrfToken: effectiveCsrf,
        state: unifiedState,
        revision: getLastKnownServerRevision(),
      };
    }

    return {
      authenticated: true,
      setupRequired: false,
      user: statusRes.data.user,
      csrfToken: statusRes.data.csrfToken,
      state: db.getSanitizedStateForClient(),
    };
  }

  // Fallback session validation when server endpoint is unreachable
  const localValidation = validateFallbackSession();
  if (!localValidation.valid || !localValidation.user) {
    return {
      authenticated: false,
      setupRequired: !db.hasSuperAdmin(),
    };
  }

  return {
    authenticated: true,
    setupRequired: false,
    user: localValidation.user,
    csrfToken: localValidation.csrfToken,
    state: db.getSanitizedStateForClient(),
  };
}

export async function fetchServerVersion(csrfToken?: string): Promise<{
  reachable: boolean;
  authenticated: boolean;
  revision?: number;
  signature?: string;
  csrfToken?: string;
}> {
  const res = await safeApiFetch('/api/state/version', { method: 'GET' }, csrfToken);
  if (!res.reachable) {
    return { reachable: false, authenticated: true };
  }
  if (res.status === 401 || !res.ok || !res.data?.success) {
    if (res.status === 401) {
      clearActiveSessionTokens();
      return { reachable: true, authenticated: false };
    }
    return { reachable: false, authenticated: true };
  }
  if (res.data.csrfToken) {
    setActiveSessionTokens(undefined, res.data.csrfToken);
  }
  return {
    reachable: true,
    authenticated: true,
    revision: res.data.revision,
    signature: res.data.signature,
    csrfToken: res.data.csrfToken,
  };
}

export async function fetchAuthoritativeState(csrfToken?: string): Promise<{
  authenticated: boolean;
  state?: DatabaseState;
  currentUser?: UserAccount;
  csrfToken?: string;
  revision?: number;
  signature?: string;
}> {
  const res = await safeApiFetch('/api/state', { method: 'GET' }, csrfToken);
  if (res.reachable) {
    if (res.status === 401 || !res.ok || !res.data?.state) {
      clearActiveSessionTokens();
      return { authenticated: false };
    }
    const effectiveCsrf = res.data.csrfToken || csrfToken;
    if (effectiveCsrf) {
      setActiveSessionTokens(undefined, effectiveCsrf);
    }
    const unifiedState = await reconcileLocalStateIfNeeded(res.data.state, effectiveCsrf);
    updateLastKnownSyncMeta(res.data.revision, res.data.signature, unifiedState);
    return {
      authenticated: true,
      state: unifiedState,
      currentUser: res.data.currentUser,
      csrfToken: effectiveCsrf,
      revision: getLastKnownServerRevision(),
      signature: getLastKnownStateSignature(),
    };
  }

  const localValidation = validateFallbackSession();
  if (!localValidation.valid || !localValidation.user) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    state: db.getSanitizedStateForClient(),
    currentUser: localValidation.user,
    csrfToken: localValidation.csrfToken || csrfToken,
  };
}

export async function syncStateWithServer(
  stateToSync: DatabaseState,
  csrfToken?: string,
  options?: {
    baseRevision?: number;
    deletedIds?: string[];
  }
): Promise<{
  authenticated: boolean;
  state?: DatabaseState;
  revision?: number;
  csrfToken?: string;
}> {
  const effectiveBaseRevision = options?.baseRevision ?? inMemoryServerRevision;
  const payloadBody = JSON.stringify({
    state: stateToSync,
    baseRevision: effectiveBaseRevision > 0 ? effectiveBaseRevision : undefined,
    deletedIds: options?.deletedIds,
  });

  let res = await safeApiFetch(
    '/api/state/sync',
    {
      method: 'POST',
      body: payloadBody,
    },
    csrfToken
  );

  // If CSRF token was rotated or out of sync across tabs, refresh status once and retry
  if (res.reachable && res.status === 403) {
    const statusRefresh = await safeApiFetch('/api/auth/status', { method: 'GET' });
    if (statusRefresh.reachable && statusRefresh.data?.authenticated && statusRefresh.data?.csrfToken) {
      setActiveSessionTokens(
        statusRefresh.data.sessionToken,
        statusRefresh.data.csrfToken,
        statusRefresh.data.expiresAt
      );
      res = await safeApiFetch(
        '/api/state/sync',
        {
          method: 'POST',
          body: payloadBody,
        },
        statusRefresh.data.csrfToken
      );
    }
  }

  if (res.reachable) {
    if (res.status === 401) {
      clearActiveSessionTokens();
      return { authenticated: false };
    }
    if (res.ok && res.data?.state) {
      updateLastKnownSyncMeta(res.data.revision, res.data.signature, res.data.state);
      broadcastStateSyncEvent('state_updated', res.data.revision);
      return {
        authenticated: true,
        state: res.data.state,
        revision: res.data.revision,
        csrfToken: getActiveSessionTokens().csrfToken,
      };
    }
  }

  return {
    authenticated: true,
    state: db.getSanitizedStateForClient(),
  };
}

export async function mutateOnServer<T = any>(
  action: string,
  payload: any,
  csrfToken?: string
): Promise<{
  reachable: boolean;
  authenticated: boolean;
  success: boolean;
  result?: T;
  state?: DatabaseState;
  revision?: number;
  error?: string;
}> {
  const bodyStr = JSON.stringify({ action, payload });
  let res = await safeApiFetch(
    '/api/db/mutate',
    {
      method: 'POST',
      body: bodyStr,
    },
    csrfToken
  );

  if (res.reachable && res.status === 403) {
    const statusRefresh = await safeApiFetch('/api/auth/status', { method: 'GET' });
    if (statusRefresh.reachable && statusRefresh.data?.authenticated && statusRefresh.data?.csrfToken) {
      setActiveSessionTokens(
        statusRefresh.data.sessionToken,
        statusRefresh.data.csrfToken,
        statusRefresh.data.expiresAt
      );
      res = await safeApiFetch(
        '/api/db/mutate',
        {
          method: 'POST',
          body: bodyStr,
        },
        statusRefresh.data.csrfToken
      );
    }
  }

  if (!res.reachable) {
    return { reachable: false, authenticated: true, success: false };
  }
  if (res.status === 401) {
    clearActiveSessionTokens();
    return { reachable: true, authenticated: false, success: false, error: 'Authentication required.' };
  }
  if (!res.ok || !res.data?.success) {
    return {
      reachable: true,
      authenticated: true,
      success: false,
      error: res.data?.error || 'Server mutation failed.',
    };
  }

  if (res.data.state) {
    updateLastKnownSyncMeta(res.data.revision, res.data.signature, res.data.state);
    broadcastStateSyncEvent('state_updated', res.data.revision);
  }

  return {
    reachable: true,
    authenticated: true,
    success: true,
    result: res.data.result as T,
    state: res.data.state as DatabaseState,
    revision: res.data.revision,
  };
}

export async function logoutFromAuthServer(csrfToken?: string): Promise<void> {
  const { sessionToken } = getActiveSessionTokens();
  if (sessionToken) {
    fallbackSessionStore.invalidateSession(sessionToken);
  }
  await safeApiFetch(
    '/api/auth/logout',
    {
      method: 'POST',
    },
    csrfToken
  );
  clearActiveSessionTokens();
  broadcastStateSyncEvent('logged_out');
}

export async function createUserOnServer(
  input: {
    username: string;
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    passwordPlain: string;
  },
  csrfToken?: string
): Promise<{
  success: boolean;
  user?: UserAccount;
  state?: DatabaseState;
  error?: string;
  unauthenticated?: boolean;
}> {
  const res = await safeApiFetch(
    '/api/users/create',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    csrfToken
  );

  if (res.reachable && res.data) {
    if (res.status === 401) {
      clearActiveSessionTokens();
      return { success: false, unauthenticated: true, error: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !res.data.success) {
      return { success: false, error: res.data.error || 'Failed to create user.' };
    }
    return {
      success: true,
      user: res.data.user,
      state: res.data.state,
    };
  }

  const localRes = db.createUser(input);
  if (!localRes.success || !localRes.user) {
    return { success: false, error: localRes.error || 'Failed to create user.' };
  }
  return {
    success: true,
    user: sanitizeUserForClient(localRes.user),
    state: db.getSanitizedStateForClient(),
  };
}

export async function updateUserOnServer(
  userId: string,
  updates: {
    fullName?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
    isActive?: boolean;
  },
  csrfToken?: string
): Promise<{
  success: boolean;
  user?: UserAccount;
  state?: DatabaseState;
  error?: string;
  unauthenticated?: boolean;
}> {
  const res = await safeApiFetch(
    '/api/users/update',
    {
      method: 'POST',
      body: JSON.stringify({ userId, updates }),
    },
    csrfToken
  );

  if (res.reachable && res.data) {
    if (res.status === 401) {
      clearActiveSessionTokens();
      return { success: false, unauthenticated: true, error: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !res.data.success) {
      return { success: false, error: res.data.error || 'Failed to update user.' };
    }
    return {
      success: true,
      user: res.data.user,
      state: res.data.state,
    };
  }

  const localRes = db.updateUser(userId, updates);
  if (!localRes.success || !localRes.user) {
    return { success: false, error: localRes.error || 'Failed to update user.' };
  }
  if (updates.isActive === false) {
    fallbackSessionStore.invalidateUserSessions(userId);
  }
  return {
    success: true,
    user: sanitizeUserForClient(localRes.user),
    state: db.getSanitizedStateForClient(),
  };
}

export async function resetPasswordOnServer(
  userId: string,
  newPasswordPlain: string,
  csrfToken?: string
): Promise<{
  success: boolean;
  csrfToken?: string;
  sessionToken?: string;
  state?: DatabaseState;
  error?: string;
  unauthenticated?: boolean;
}> {
  const res = await safeApiFetch(
    '/api/users/reset-password',
    {
      method: 'POST',
      body: JSON.stringify({ userId, newPasswordPlain }),
    },
    csrfToken
  );

  if (res.reachable && res.data) {
    if (res.status === 401) {
      clearActiveSessionTokens();
      return { success: false, unauthenticated: true, error: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !res.data.success) {
      return { success: false, error: res.data.error || 'Failed to reset password.' };
    }
    if (res.data.csrfToken || res.data.sessionToken) {
      setActiveSessionTokens(res.data.sessionToken, res.data.csrfToken);
    }
    return {
      success: true,
      csrfToken: res.data.csrfToken,
      sessionToken: res.data.sessionToken,
      state: res.data.state,
    };
  }

  const localRes = db.resetUserPassword(userId, newPasswordPlain);
  if (!localRes.success) {
    return { success: false, error: localRes.error || 'Failed to reset password.' };
  }
  fallbackSessionStore.invalidateUserSessions(userId);
  const currentActor = db.getCurrentUser();
  if (currentActor.id === userId) {
    const refreshed = db.getUsers().find((u) => u.id === userId)!;
    const newSession = fallbackSessionStore.createSession(refreshed);
    saveFallbackSessionRecord(newSession);
    setActiveSessionTokens(newSession.token, newSession.csrfToken);
    return {
      success: true,
      csrfToken: newSession.csrfToken,
      sessionToken: newSession.token,
      state: db.getSanitizedStateForClient(),
    };
  }
  return {
    success: true,
    state: db.getSanitizedStateForClient(),
  };
}

export async function revokeUserOnServer(
  userId: string,
  reason?: string,
  csrfToken?: string
): Promise<{
  success: boolean;
  state?: DatabaseState;
  error?: string;
  unauthenticated?: boolean;
}> {
  const res = await safeApiFetch(
    '/api/users/revoke',
    {
      method: 'POST',
      body: JSON.stringify({ userId, reason }),
    },
    csrfToken
  );

  if (res.reachable && res.data) {
    if (res.status === 401) {
      clearActiveSessionTokens();
      return { success: false, unauthenticated: true, error: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !res.data.success) {
      return { success: false, error: res.data.error || 'Cannot revoke user access.' };
    }
    return {
      success: true,
      state: res.data.state,
    };
  }

  const localRes = db.revokeUserAccess(userId, reason);
  if (!localRes.success) {
    return { success: false, error: localRes.error || 'Cannot revoke user access.' };
  }
  fallbackSessionStore.invalidateUserSessions(userId);
  return {
    success: true,
    state: db.getSanitizedStateForClient(),
  };
}

export async function deleteUserOnServer(
  userId: string,
  reason?: string,
  csrfToken?: string
): Promise<{
  success: boolean;
  state?: DatabaseState;
  error?: string;
  unauthenticated?: boolean;
}> {
  const res = await safeApiFetch(
    '/api/users/delete',
    {
      method: 'POST',
      body: JSON.stringify({ userId, reason }),
    },
    csrfToken
  );

  if (res.reachable && res.data) {
    if (res.status === 401) {
      clearActiveSessionTokens();
      return { success: false, unauthenticated: true, error: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !res.data.success) {
      return { success: false, error: res.data.error || 'Cannot delete user.' };
    }
    return {
      success: true,
      state: res.data.state,
    };
  }

  const localRes = db.deleteUser(userId, reason);
  if (!localRes.success) {
    return { success: false, error: localRes.error || 'Cannot delete user.' };
  }
  fallbackSessionStore.invalidateUserSessions(userId);
  return {
    success: true,
    state: db.getSanitizedStateForClient(),
  };
}

export async function updateRolePermissionsOnServer(
  role: UserRole,
  modulePermissions: Record<AppModule, PermissionAction[]>,
  csrfToken?: string
): Promise<{
  success: boolean;
  state?: DatabaseState;
  error?: string;
  unauthenticated?: boolean;
}> {
  const res = await safeApiFetch(
    '/api/users/role-permissions',
    {
      method: 'POST',
      body: JSON.stringify({ role, modulePermissions }),
    },
    csrfToken
  );

  if (res.reachable && res.data) {
    if (res.status === 401) {
      clearActiveSessionTokens();
      return { success: false, unauthenticated: true, error: 'Session expired. Please log in again.' };
    }
    if (!res.ok || !res.data.success) {
      return { success: false, error: res.data.error || 'Failed to update role permissions.' };
    }
    return {
      success: true,
      state: res.data.state,
    };
  }

  const localRes = db.updateRolePermissions(role, modulePermissions);
  if (!localRes.success) {
    return { success: false, error: localRes.error || 'Failed to update role permissions.' };
  }
  return {
    success: true,
    state: db.getSanitizedStateForClient(),
  };
}

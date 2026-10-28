import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AppModule,
  DatabaseState,
  Order,
  PermissionAction,
  Product,
  UserAccount,
  UserRole,
} from './src/types/database';
import { DatabaseService } from './src/db/database';
import {
  hasPermission,
  LoginRateLimiter,
  parseCookies,
  sanitizeUserForClient,
  ServerSessionRecord,
  ServerSessionStore,
  validateUserModification,
} from './src/utils/authSecurity';
import {
  parseBatchOrderText,
  parseOrderText,
  ParsedOrderDraft,
  recalculateAndValidateDraft,
  matchProductFromCatalogue,
} from './src/utils/aiOrderParser';
import {
  computeStateSignature,
  mergeDatabaseStates,
} from './src/utils/stateSync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_COOKIE_NAME = 'cgh_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface AuthenticatedRequest extends Request {
  authUser?: UserAccount;
  authSession?: ServerSessionRecord;
}

export interface CreateAppOptions {
  initialEmptySetup?: boolean;
  sessionTtlMs?: number;
  maxLoginAttempts?: number;
  persistFilePath?: string | null;
}

export function createApp(options?: CreateAppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  const serverDb = new DatabaseService({
    initialEmptySetup: options?.initialEmptySetup,
  });

  let stateRevision = 1;
  let lastUpdatedAt = new Date().toISOString();

  const persistFilePath =
    options?.persistFilePath !== undefined
      ? options.persistFilePath
      : path.join(__dirname, '.data', 'cgh-server-state.json');

  const persistSessionFilePath = persistFilePath
    ? path.join(path.dirname(persistFilePath), 'cgh-server-sessions.json')
    : null;

  // Load persisted server database state if available (unless running isolated test instance)
  if (persistFilePath && !options?.initialEmptySetup) {
    try {
      if (fs.existsSync(persistFilePath)) {
        const raw = fs.readFileSync(persistFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseState & {
          _metaRevision?: number;
          _metaUpdatedAt?: string;
        };
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          serverDb.hydrateFromServer(parsed);
          if (typeof parsed._metaRevision === 'number' && parsed._metaRevision > 0) {
            stateRevision = parsed._metaRevision;
          }
          if (typeof parsed._metaUpdatedAt === 'string') {
            lastUpdatedAt = parsed._metaUpdatedAt;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load persisted server state:', err);
    }
  }

  const sseClients = new Set<Response>();

  function broadcastSseUpdate(): void {
    if (sseClients.size === 0) return;
    try {
      const payload = JSON.stringify({
        type: 'state_updated',
        revision: stateRevision,
        lastUpdatedAt,
        signature: computeStateSignature(serverDb.getState()),
      });
      const message = `data: ${payload}\n\n`;
      for (const client of sseClients) {
        try {
          client.write(message);
        } catch {
          sseClients.delete(client);
        }
      }
    } catch {
      // ignore SSE broadcast errors
    }
  }

  function persistServerState(bumpRevision: boolean = true): void {
    if (bumpRevision) {
      stateRevision += 1;
      lastUpdatedAt = new Date().toISOString();
    }
    if (persistFilePath) {
      try {
        const dir = path.dirname(persistFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // Keep a safe backup of the previous valid state before overwriting
        if (fs.existsSync(persistFilePath)) {
          try {
            fs.copyFileSync(persistFilePath, `${persistFilePath}.backup`);
          } catch {
            // ignore backup copy warning
          }
        }
        const payloadToSave = {
          ...serverDb.getState(),
          _metaRevision: stateRevision,
          _metaUpdatedAt: lastUpdatedAt,
        };
        const tmpPath = `${persistFilePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(payloadToSave), 'utf-8');
        fs.renameSync(tmpPath, persistFilePath);
      } catch (err) {
        console.error('Failed to persist server state:', err);
      }
    }
    if (bumpRevision) {
      broadcastSseUpdate();
    }
  }

  const sessionStore = new ServerSessionStore(options?.sessionTtlMs ?? SESSION_TTL_MS);

  // Restore active sessions across server restarts
  if (persistSessionFilePath && !options?.initialEmptySetup) {
    try {
      if (fs.existsSync(persistSessionFilePath)) {
        const rawSessions = fs.readFileSync(persistSessionFilePath, 'utf-8');
        const parsedSessions = JSON.parse(rawSessions) as ServerSessionRecord[];
        sessionStore.hydrateSessions(parsedSessions);
      }
    } catch {
      // ignore session hydration warnings
    }
  }

  function persistSessions(): void {
    if (!persistSessionFilePath) return;
    try {
      const dir = path.dirname(persistSessionFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${persistSessionFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(sessionStore.exportSessions()), 'utf-8');
      fs.renameSync(tmpPath, persistSessionFilePath);
    } catch {
      // ignore session persistence warnings
    }
  }

  const loginRateLimiter = new LoginRateLimiter({
    maxAttempts: options?.maxLoginAttempts ?? 5,
    windowMs: 15 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
  });

  function setSessionCookie(
    req: Request,
    res: Response,
    token: string,
    maxAgeSeconds: number = 43200
  ): void {
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || '';
    const isHttps =
      req.secure ||
      forwardedProto.toLowerCase().includes('https') ||
      process.env.NODE_ENV === 'production';

    const cookieParts = [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      'HttpOnly',
      'Path=/',
      isHttps ? 'SameSite=None' : 'SameSite=Lax',
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (isHttps) {
      cookieParts.push('Secure');
    }
    res.setHeader('Set-Cookie', cookieParts.join('; '));
  }

  function clearSessionCookie(req: Request, res: Response): void {
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || '';
    const isHttps =
      req.secure ||
      forwardedProto.toLowerCase().includes('https') ||
      process.env.NODE_ENV === 'production';
    const parts = [
      `${SESSION_COOKIE_NAME}=`,
      'HttpOnly',
      'Path=/',
      isHttps ? 'SameSite=None' : 'SameSite=Lax',
      'Max-Age=0',
    ];
    if (isHttps) {
      parts.push('Secure');
    }
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function extractTokenFromRequest(req: Request): string | undefined {
    const headerToken = (req.headers['x-session-token'] as string)?.trim();
    if (headerToken) {
      return headerToken;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearer = authHeader.slice(7).trim();
      if (bearer) return bearer;
    }
    const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    if (queryToken) {
      return queryToken;
    }
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      return cookies[SESSION_COOKIE_NAME];
    }
    return undefined;
  }

  // Strict server-side authentication + CSRF verification middleware
  function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const token = extractTokenFromRequest(req);
    const validation = sessionStore.validateSession(token, serverDb.getUsers());

    if (!validation.valid || !validation.user || !validation.session) {
      clearSessionCookie(req, res);
      res.status(401).json({
        success: false,
        authenticated: false,
        error: validation.reason || 'Authentication required. Please log in.',
      });
      return;
    }

    // Verify CSRF token on state-mutating requests
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfHeader = (req.headers['x-csrf-token'] as string) || '';
      if (!csrfHeader || csrfHeader !== validation.session.csrfToken) {
        res.status(403).json({
          success: false,
          error: 'CSRF security validation failed. Missing or invalid x-csrf-token header.',
        });
        return;
      }
    }

    req.authUser = validation.user;
    req.authSession = validation.session;
    // Set actor context on serverDb for accurate audit logs without spamming USER_SWITCH_SESSION
    serverDb.setCurrentUser(validation.user.id, { silent: true });
    next();
  }

  function requireBackendPermission(module: AppModule, action: PermissionAction) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const actor = req.authUser;
      const rolePermissions = serverDb.getState().rolePermissions;
      if (!actor || !hasPermission(actor, rolePermissions, module, action)) {
        res.status(403).json({
          success: false,
          error: `Backend RBAC Denied: Role "${actor?.role || 'unauthenticated'}" lacks "${action}" permission on module "${module}".`,
        });
        return;
      }
      next();
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC ENDPOINTS (Zero private data or secrets exposed)
  // ---------------------------------------------------------------------------

  app.get('/api/health', (_req: Request, res: Response) => {
    const rawKey = process.env.GEMINI_API_KEY || '';
    const hasConfiguredGeminiKey =
      Boolean(rawKey) && rawKey !== 'MY_GEMINI_API_KEY' && rawKey.length > 10;
    res.json({
      status: 'ok',
      aiConfigured: hasConfiguredGeminiKey,
      aiModel: hasConfiguredGeminiKey ? 'gemini-3.8-flash' : 'rule_engine_fallback',
      timezone: 'Asia/Dhaka',
      currency: 'BDT',
    });
  });

  // Check current session & whether one-time initial Super Admin setup is required
  app.get('/api/auth/status', (req: Request, res: Response) => {
    const setupRequired = !serverDb.hasSuperAdmin();
    const token = extractTokenFromRequest(req);
    const validation = sessionStore.validateSession(token, serverDb.getUsers());

    if (!validation.valid || !validation.user || !validation.session) {
      if (token) {
        clearSessionCookie(req, res);
      }
      res.json({
        authenticated: false,
        setupRequired,
      });
      return;
    }

    res.json({
      authenticated: true,
      setupRequired: false,
      user: sanitizeUserForClient(validation.user),
      sessionToken: validation.session.token,
      csrfToken: validation.session.csrfToken,
      expiresAt: new Date(validation.session.expiresAt).toISOString(),
      revision: stateRevision,
      lastUpdatedAt,
    });
  });

  // One-time Initial Super Admin Setup (permanently disabled once a Super Admin exists)
  app.post('/api/auth/setup', (req: Request, res: Response) => {
    const { username, fullName, email, phone, password } = req.body || {};
    const result = serverDb.setupInitialSuperAdmin({
      username: String(username || ''),
      fullName: String(fullName || ''),
      email: String(email || ''),
      phone: String(phone || ''),
      passwordPlain: String(password || ''),
    });

    if (!result.success || !result.user) {
      persistServerState();
      res.status(result.status).json({
        success: false,
        error: result.error || 'Initial Super Admin setup is disabled.',
      });
      return;
    }

    persistServerState();
    const session = sessionStore.createSession(result.user);
    persistSessions();
    setSessionCookie(req, res, session.token);

    res.status(201).json({
      success: true,
      user: sanitizeUserForClient(result.user),
      sessionToken: session.token,
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
      revision: stateRevision,
      lastUpdatedAt,
    });
  });

  // Secure Login with Rate Limiting, Salted Hash Verification & HttpOnly Session Cookie
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const rawIdentifier = String(req.body?.username || req.body?.email || '').trim();
    const rawPassword = String(req.body?.password || '');
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'local';
    const rateKey = `${clientIp}:${rawIdentifier.toLowerCase()}`;

    if (!rawIdentifier || !rawPassword) {
      res.status(400).json({
        success: false,
        error: 'Both username/email and password are required.',
      });
      return;
    }

    const rateCheck = loginRateLimiter.check(rateKey);
    if (!rateCheck.allowed) {
      serverDb.logAudit(
        'AUTH_RATE_LIMITED',
        'Security',
        rawIdentifier || 'UNKNOWN',
        `Login rate limit exceeded for "${rawIdentifier}" from IP ${clientIp}. Locked for ${rateCheck.retryAfterSeconds}s.`,
        'Security Guard',
        'users'
      );
      persistServerState(false);
      res.status(429).json({
        success: false,
        error: `Too many failed login attempts. Account login is temporarily locked. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return;
    }

    const authResult = serverDb.authenticateUser(rawIdentifier, rawPassword);
    if (!authResult.success || !authResult.user) {
      const failureStatus = loginRateLimiter.recordFailure(rateKey);
      persistServerState(false);

      const isDeactivated =
        authResult.error?.toLowerCase().includes('deactivated') ||
        authResult.error?.toLowerCase().includes('revoked');

      res.status(isDeactivated ? 403 : 401).json({
        success: false,
        error: authResult.error || 'Invalid username or password.',
        remainingAttempts: failureStatus.remainingAttempts,
        locked: failureStatus.locked,
        retryAfterSeconds: failureStatus.retryAfterSeconds,
      });
      return;
    }

    loginRateLimiter.reset(rateKey);
    persistServerState(false);

    const session = sessionStore.createSession(authResult.user);
    persistSessions();
    setSessionCookie(req, res, session.token);

    res.json({
      success: true,
      user: sanitizeUserForClient(authResult.user),
      sessionToken: session.token,
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
      revision: stateRevision,
      lastUpdatedAt,
    });
  });

  // Logout & Session Invalidation
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractTokenFromRequest(req);
    if (token) {
      const validation = sessionStore.validateSession(token, serverDb.getUsers());
      if (validation.user) {
        serverDb.logAudit(
          'USER_LOGOUT',
          'User',
          validation.user.id,
          `User ${validation.user.fullName} (@${validation.user.username}) logged out and invalidated session.`,
          validation.user.fullName,
          'users'
        );
        persistServerState(false);
      }
      sessionStore.invalidateSession(token);
      persistSessions();
    }
    clearSessionCookie(req, res);
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------------
  // PROTECTED PRIVATE ROUTES (Require valid HttpOnly session + CSRF on writes)
  // ---------------------------------------------------------------------------

  // Real-time Server-Sent Events (SSE) stream so every tab & window updates immediately
  app.get('/api/state/stream', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const currentState = serverDb.getState();
    const initialPayload = JSON.stringify({
      type: 'connected',
      revision: stateRevision,
      lastUpdatedAt,
      signature: computeStateSignature(currentState),
    });
    res.write(`data: ${initialPayload}\n\n`);

    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Lightweight state version & signature endpoint for real-time cross-browser sync
  app.get('/api/state/version', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const currentState = serverDb.getState();
    res.json({
      success: true,
      revision: stateRevision,
      lastUpdatedAt,
      signature: computeStateSignature(currentState),
      csrfToken: req.authSession!.csrfToken,
    });
  });

  // Fetch authoritative sanitized database state for authenticated user
  app.get('/api/state', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const sanitized = serverDb.getSanitizedStateForClient();
    res.json({
      success: true,
      state: sanitized,
      currentUser: sanitizeUserForClient(req.authUser!),
      csrfToken: req.authSession!.csrfToken,
      revision: stateRevision,
      lastUpdatedAt,
      signature: computeStateSignature(sanitized),
    });
  });

  // Safe non-destructive reconciliation of unsynced browser localStorage records into central database
  app.post('/api/state/reconcile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const incoming = req.body?.state as Partial<DatabaseState> | undefined;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid state payload for reconciliation.' });
      return;
    }

    const currentServerState = serverDb.getState();
    const mergedState = mergeDatabaseStates(currentServerState, incoming, {
      mode: 'safe_merge',
    });

    serverDb.hydrateFromServer(mergedState, req.authUser);
    persistServerState(true);

    const sanitized = serverDb.getSanitizedStateForClient();
    res.json({
      success: true,
      state: sanitized,
      revision: stateRevision,
      lastUpdatedAt,
      signature: computeStateSignature(sanitized),
    });
  });

  // Synchronize authorized operational data changes while preserving server-side user credentials
  // and preventing stale tabs/browsers from clobbering concurrent updates
  app.post('/api/state/sync', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const incoming = req.body?.state as Partial<DatabaseState> | undefined;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid state payload.' });
      return;
    }

    const clientBaseRevision =
      typeof req.body?.baseRevision === 'number' ? req.body.baseRevision : undefined;
    const explicitDeletedIds = Array.isArray(req.body?.deletedIds)
      ? (req.body.deletedIds as string[])
      : undefined;
    const forceAuthoritative = Boolean(req.body?.forceAuthoritative);

    // If forceAuthoritative is true, the active tab's state is applied directly as authoritative_client.
    // Otherwise, if clientBaseRevision is older than stateRevision, use 'safe_merge' so concurrent additions are preserved.
    const isClientStale =
      !forceAuthoritative &&
      clientBaseRevision !== undefined &&
      clientBaseRevision < stateRevision;
    const mergeMode = isClientStale ? 'safe_merge' : 'authoritative_client';

    const currentServerState = serverDb.getState();
    const mergedState = mergeDatabaseStates(currentServerState, incoming, {
      mode: mergeMode,
      deletedIds: explicitDeletedIds,
    });

    serverDb.hydrateFromServer(mergedState, req.authUser);
    persistServerState(true);

    const sanitized = serverDb.getSanitizedStateForClient();
    res.json({
      success: true,
      state: sanitized,
      revision: stateRevision,
      lastUpdatedAt,
      signature: computeStateSignature(sanitized),
    });
  });

  // Dedicated endpoint to reset inventory to a clean Fresh Inventory across all tabs/windows
  app.post('/api/inventory/fresh', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const actor = req.authUser!;
    const result = serverDb.resetInventory({
      performedBy: actor.fullName || 'Super Admin',
    });
    persistServerState(true);
    const sanitized = serverDb.getSanitizedStateForClient();
    res.json({
      success: true,
      result,
      state: sanitized,
      revision: stateRevision,
      lastUpdatedAt,
      signature: computeStateSignature(sanitized),
    });
  });

  // Server-authoritative atomic CRUD mutation endpoint for business records
  app.post('/api/db/mutate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { action, payload } = req.body || {};
    if (!action || typeof action !== 'string') {
      res.status(400).json({ success: false, error: 'Mutation action is required.' });
      return;
    }

    const actor = req.authUser!;
    let result: any;

    try {
      switch (action) {
        case 'saveProduct':
          result = serverDb.saveProduct(payload);
          break;
        case 'deleteProduct':
          result = serverDb.deleteProduct(payload?.productId, payload?.options);
          break;
        case 'resetInventory':
          result = serverDb.resetInventory({
            performedBy: payload?.performedBy || actor.fullName || 'Super Admin',
          });
          break;
        case 'adjustStock':
          result = serverDb.adjustStock({
            ...payload,
            performedBy: payload?.performedBy || actor.fullName || 'Admin',
          });
          break;
        case 'createOrder':
          result = serverDb.createOrder({
            ...payload,
            createdByUserId: payload?.createdByUserId || actor.id,
            createdByName: payload?.createdByName || actor.fullName || 'Admin',
          });
          break;
        case 'updateOrder':
          result = serverDb.updateOrder(payload?.orderId, payload?.updates || {});
          break;
        case 'updateOrderStatus':
          result = serverDb.updateOrderStatus({
            ...payload,
            performedBy: payload?.performedBy || actor.fullName || 'Admin',
          });
          break;
        case 'bulkUpdateOrderStatus': {
          const orderIds: string[] = Array.isArray(payload?.orderIds) ? payload.orderIds : [];
          for (const id of orderIds) {
            serverDb.updateOrderStatus({
              orderId: id,
              newStatus: payload.newStatus,
              performedBy: actor.fullName || 'Admin',
            });
          }
          result = { success: true };
          break;
        }
        case 'deleteOrder':
          result = serverDb.deleteOrder(payload?.orderId, payload?.reason);
          break;
        case 'createPurchaseOrder':
          result = serverDb.createPurchaseOrder(payload);
          break;
        case 'deletePurchaseOrder':
          result = serverDb.deletePurchaseOrder(payload?.poId);
          break;
        case 'receivePurchaseOrderGoods':
          result = serverDb.receivePurchaseOrderGoods(payload?.poId);
          break;
        case 'saveSupplier':
          result = serverDb.saveSupplier(payload);
          break;
        case 'deleteSupplier':
          result = serverDb.deleteSupplier(payload?.supplierId);
          break;
        case 'saveCashTransaction':
          result = serverDb.saveCashTransaction(payload);
          break;
        case 'deleteCashTransaction':
          result = serverDb.deleteCashTransaction(payload?.txId, payload?.reason);
          break;
        case 'saveBankAccount':
          result = serverDb.saveBankAccount(payload);
          break;
        case 'deleteBankAccount':
          result = serverDb.deleteBankAccount(payload?.accountId);
          break;
        case 'settleParcels':
          result = serverDb.settleParcels(
            payload?.parcelIds || [],
            payload?.bankAccountId,
            payload?.notes
          );
          break;
        case 'saveAdExpense':
          result = serverDb.saveAdExpense(payload);
          break;
        case 'deleteAdExpense':
          result = serverDb.deleteAdExpense(payload?.adId, payload?.reason);
          break;
        case 'saveOperatingExpense':
          result = serverDb.saveOperatingExpense(payload);
          break;
        case 'deleteOperatingExpense':
          result = serverDb.deleteOperatingExpense(payload?.expId, payload?.reason);
          break;
        case 'updateSettings':
          result = serverDb.updateSettings(payload);
          break;
        case 'restoreBackup':
          result = serverDb.restoreBackup(payload?.jsonString);
          break;
        case 'resetToDemo':
          serverDb.resetToDemo();
          result = { success: true };
          break;
        case 'runAcceptanceTests':
          result = serverDb.runAcceptanceTests();
          break;
        default:
          res.status(400).json({ success: false, error: `Unknown mutation action "${action}".` });
          return;
      }

      persistServerState(true);
      const sanitized = serverDb.getSanitizedStateForClient();
      res.json({
        success: true,
        result,
        state: sanitized,
        revision: stateRevision,
        lastUpdatedAt,
        signature: computeStateSignature(sanitized),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to execute server database mutation.',
      });
    }
  });

  // Server-authoritative User Creation
  app.post(
    '/api/users/create',
    requireAuth,
    requireBackendPermission('users', 'create'),
    (req: AuthenticatedRequest, res: Response) => {
      const { username, fullName, email, phone, role, passwordPlain } = req.body || {};
      const result = serverDb.createUser({
        username: String(username || ''),
        fullName: String(fullName || ''),
        email: String(email || ''),
        phone: String(phone || ''),
        role: role as UserRole,
        passwordPlain: String(passwordPlain || ''),
      });

      if (!result.success || !result.user) {
        res.status(400).json({ success: false, error: result.error || 'Failed to create user.' });
        return;
      }

      persistServerState(true);
      res.status(201).json({
        success: true,
        user: sanitizeUserForClient(result.user),
        state: serverDb.getSanitizedStateForClient(),
        revision: stateRevision,
        lastUpdatedAt,
      });
    }
  );

  // Server-authoritative User Update
  app.post(
    '/api/users/update',
    requireAuth,
    requireBackendPermission('users', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const { userId, updates } = req.body || {};
      const result = serverDb.updateUser(String(userId || ''), updates || {});
      if (!result.success || !result.user) {
        res.status(403).json({ success: false, error: result.error || 'Failed to update user.' });
        return;
      }

      if (updates?.isActive === false) {
        sessionStore.invalidateUserSessions(String(userId));
        persistSessions();
      }

      persistServerState(true);
      res.json({
        success: true,
        user: sanitizeUserForClient(result.user),
        state: serverDb.getSanitizedStateForClient(),
        revision: stateRevision,
        lastUpdatedAt,
      });
    }
  );

  // Server-authoritative Password Reset & Session Rotation
  app.post(
    '/api/users/reset-password',
    requireAuth,
    requireBackendPermission('users', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const { userId, newPasswordPlain } = req.body || {};
      const targetId = String(userId || '');
      const result = serverDb.resetUserPassword(targetId, String(newPasswordPlain || ''));
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error || 'Password reset failed.' });
        return;
      }

      // Immediately invalidate all existing sessions for the target user
      sessionStore.invalidateUserSessions(targetId);

      // If the current actor reset their own password, issue a fresh session so they stay logged in
      if (req.authUser && req.authUser.id === targetId) {
        const refreshedUser = serverDb.getUsers().find((u) => u.id === targetId)!;
        const newSession = sessionStore.createSession(refreshedUser);
        persistSessions();
        setSessionCookie(req, res, newSession.token);
        persistServerState(true);
        res.json({
          success: true,
          sessionToken: newSession.token,
          csrfToken: newSession.csrfToken,
          state: serverDb.getSanitizedStateForClient(),
          revision: stateRevision,
          lastUpdatedAt,
        });
        return;
      }

      persistSessions();
      persistServerState(true);
      res.json({
        success: true,
        state: serverDb.getSanitizedStateForClient(),
        revision: stateRevision,
        lastUpdatedAt,
      });
    }
  );

  // Server-authoritative Access Revocation
  app.post(
    '/api/users/revoke',
    requireAuth,
    requireBackendPermission('users', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const { userId, reason } = req.body || {};
      const targetId = String(userId || '');
      const result = serverDb.revokeUserAccess(targetId, reason ? String(reason) : undefined);
      if (!result.success) {
        res.status(403).json({ success: false, error: result.error || 'Cannot revoke user access.' });
        return;
      }

      sessionStore.invalidateUserSessions(targetId);
      persistSessions();
      persistServerState(true);
      res.json({
        success: true,
        state: serverDb.getSanitizedStateForClient(),
        revision: stateRevision,
        lastUpdatedAt,
      });
    }
  );

  // Server-authoritative User Deletion (with last active Super Admin protection)
  app.post(
    '/api/users/delete',
    requireAuth,
    requireBackendPermission('users', 'delete'),
    (req: AuthenticatedRequest, res: Response) => {
      const { userId, reason } = req.body || {};
      const targetId = String(userId || '');
      const result = serverDb.deleteUser(targetId, reason ? String(reason) : undefined);
      if (!result.success) {
        res.status(403).json({ success: false, error: result.error || 'Cannot delete user.' });
        return;
      }

      sessionStore.invalidateUserSessions(targetId);
      persistSessions();
      persistServerState(true);
      res.json({
        success: true,
        state: serverDb.getSanitizedStateForClient(),
        revision: stateRevision,
        lastUpdatedAt,
      });
    }
  );

  // Server-authoritative Role Permission Matrix Update
  app.post(
    '/api/users/role-permissions',
    requireAuth,
    requireBackendPermission('users', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const { role, modulePermissions } = req.body || {};
      const result = serverDb.updateRolePermissions(role as UserRole, modulePermissions);
      if (!result.success) {
        res.status(403).json({
          success: false,
          error: result.error || 'Failed to update role permissions.',
        });
        return;
      }

      persistServerState(true);
      res.json({
        success: true,
        state: serverDb.getSanitizedStateForClient(),
        revision: stateRevision,
        lastUpdatedAt,
      });
    }
  );

  // Backend RBAC permission verification endpoint
  app.post('/api/rbac/verify', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { module, action } = req.body as { module: AppModule; action: PermissionAction };
    const actor = req.authUser!;
    const rolePermissions = serverDb.getState().rolePermissions;
    const allowed = hasPermission(actor, rolePermissions, module, action);
    if (!allowed) {
      res.status(403).json({
        allowed: false,
        error: `Backend RBAC Denied: Role "${actor.role}" is not permitted to perform "${action}" in "${module}".`,
      });
      return;
    }
    res.json({ allowed: true, role: actor.role, module, action });
  });

  // Backend User Modification Security Validator
  app.post(
    '/api/users/validate-modification',
    requireAuth,
    requireBackendPermission('users', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const actor = req.authUser!;
      const rolePermissions = serverDb.getState().rolePermissions;
      const { targetUser, allUsers, operation, newRole } = req.body;
      const result = validateUserModification({
        actor,
        rolePermissions,
        targetUser,
        allUsers: allUsers || serverDb.getUsers(),
        operation,
        newRole,
      });
      if (!result.allowed) {
        res.status(403).json(result);
        return;
      }
      res.json(result);
    }
  );

  // Server-side AI Auto Order Entry Parser with Gemini 3.8 Flash + Rule Engine Fallback
  app.post(
    '/api/ai/parse-order',
    requireAuth,
    requireBackendPermission('ai_order_entry', 'create'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          rawText,
          isBatch,
          catalogue = serverDb.getProducts(),
          existingOrders = serverDb.getState().orders,
          settings = {
            defaultInsideDhakaFee: serverDb.getState().settings.defaultInsideDhakaFee || 80,
            defaultOutsideDhakaFee: serverDb.getState().settings.defaultOutsideDhakaFee || 120,
          },
        } = req.body as {
          rawText: string;
          isBatch?: boolean;
          catalogue?: Product[];
          existingOrders?: Order[];
          settings?: { defaultInsideDhakaFee?: number; defaultOutsideDhakaFee?: number };
        };

        if (!rawText || !rawText.trim()) {
          res.status(400).json({ success: false, error: 'Order text cannot be empty.' });
          return;
        }

        const ruleDrafts: ParsedOrderDraft[] = isBatch
          ? parseBatchOrderText(rawText, catalogue, existingOrders, settings)
          : [parseOrderText(rawText, catalogue, existingOrders, settings)];

        const rawKey = process.env.GEMINI_API_KEY || '';
        const hasConfiguredGeminiKey =
          Boolean(rawKey) && rawKey !== 'MY_GEMINI_API_KEY' && rawKey.length > 10;

        if (!hasConfiguredGeminiKey) {
          res.json({
            success: true,
            parserSource: 'rule_engine',
            drafts: ruleDrafts,
          });
          return;
        }

        try {
          const ai = new GoogleGenAI({
            apiKey: rawKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const catalogueSummary = catalogue
            .filter((p) => !p.isArchived)
            .map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              banglaName: p.banglaName || '',
              aliases: p.aliases || [],
              sellingPrice: p.sellingPrice,
            }));

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `Extract customer order details from the following Bangladesh e-commerce customer message(s).
Accept Bangla, Banglish, and English.
Catalogue products (ONLY match against these; never invent products):
${JSON.stringify(catalogueSummary)}

Rules:
- Never invent missing customer name, phone, or address. Leave empty string if missing.
- Default delivery charge is Inside Dhaka = ${settings?.defaultInsideDhakaFee ?? 80} BDT, Outside Dhaka = ${settings?.defaultOutsideDhakaFee ?? 120} BDT unless specified in the text.
- Customer Text:
${rawText}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    customerName: { type: Type.STRING },
                    customerPhone: { type: Type.STRING },
                    fullAddress: { type: Type.STRING },
                    district: { type: Type.STRING },
                    deliveryZone: { type: Type.STRING },
                    discount: { type: Type.NUMBER },
                    deliveryCharge: { type: Type.NUMBER },
                    advancePaid: { type: Type.NUMBER },
                    paymentMethod: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          rawProductText: { type: Type.STRING },
                          matchedProductId: { type: Type.STRING },
                          quantity: { type: Type.NUMBER },
                          unitPrice: { type: Type.NUMBER },
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          const parsedJson = JSON.parse(response.text || '[]');
          if (Array.isArray(parsedJson) && parsedJson.length > 0) {
            const aiDrafts: ParsedOrderDraft[] = parsedJson.map((aiItem: any, idx: number) => {
              const fallback = ruleDrafts[idx] || ruleDrafts[0];
              const zone =
                aiItem.deliveryZone === 'outside_dhaka' || aiItem.deliveryZone === 'sub_dhaka'
                  ? aiItem.deliveryZone
                  : aiItem.deliveryZone === 'inside_dhaka'
                  ? 'inside_dhaka'
                  : fallback.deliveryZone;

              const mappedItems =
                Array.isArray(aiItem.items) && aiItem.items.length > 0
                  ? aiItem.items.map((it: any, iIdx: number) => {
                      const directProd = catalogue.find((p) => p.id === it.matchedProductId);
                      const matched = directProd
                        ? { product: directProd, confidence: 'exact' as const }
                        : matchProductFromCatalogue(it.rawProductText || '', catalogue);
                      const prod = matched.product;
                      const qty = Math.max(1, Number(it.quantity) || 1);
                      const price =
                        Number(it.unitPrice) > 0
                          ? Number(it.unitPrice)
                          : prod
                          ? prod.sellingPrice
                          : 0;
                      return {
                        id: `ai-item-${Date.now()}-${idx}-${iIdx}`,
                        rawProductText: it.rawProductText || prod?.name || 'Unknown Product',
                        matchedProductId: prod ? prod.id : null,
                        matchedProductName: prod
                          ? prod.name
                          : it.rawProductText || 'Unmatched Product',
                        matchedSku: prod ? prod.sku : '',
                        quantity: qty,
                        unitPrice: price,
                        cataloguePrice: prod ? prod.sellingPrice : 0,
                        availableStock: prod
                          ? Math.max(0, prod.currentStock - prod.reservedStock)
                          : 0,
                        subtotal: qty * price,
                        confidence: matched.confidence,
                      };
                    })
                  : fallback.items;

              const merged: ParsedOrderDraft = {
                ...fallback,
                customerName: aiItem.customerName || fallback.customerName,
                customerPhone: aiItem.customerPhone || fallback.customerPhone,
                fullAddress: aiItem.fullAddress || fallback.fullAddress,
                district: aiItem.district || fallback.district,
                deliveryZone: zone,
                discount:
                  aiItem.discount !== undefined ? Number(aiItem.discount) : fallback.discount,
                deliveryCharge:
                  aiItem.deliveryCharge !== undefined && Number(aiItem.deliveryCharge) > 0
                    ? Number(aiItem.deliveryCharge)
                    : fallback.deliveryCharge,
                advancePaid:
                  aiItem.advancePaid !== undefined
                    ? Number(aiItem.advancePaid)
                    : fallback.advancePaid,
                paymentMethod: aiItem.paymentMethod || fallback.paymentMethod,
                notes: aiItem.notes || fallback.notes,
                items: mappedItems,
                parserSource: 'gemini_ai',
              };

              return recalculateAndValidateDraft(merged, catalogue, existingOrders, settings);
            });

            res.json({
              success: true,
              parserSource: 'gemini_ai',
              drafts: aiDrafts,
            });
            return;
          }
        } catch (_aiErr) {
          // Gracefully fall back to rule-based parser if Gemini API fails or quota is reached
        }

        res.json({
          success: true,
          parserSource: 'rule_engine',
          drafts: ruleDrafts,
        });
      } catch (err: any) {
        res.status(500).json({
          success: false,
          error: err?.message || 'Failed to parse order text.',
        });
      }
    }
  );

  // Catch-all for any other /api/* route: enforce authentication first
  app.all('/api/*', requireAuth, (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found.',
    });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Crystal Gift House Business OS server running on http://0.0.0.0:${PORT}`);
  });
}

// Start server when run directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  startServer();
}

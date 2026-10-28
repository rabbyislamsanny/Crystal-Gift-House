import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSalt,
  getDefaultRolePermissions,
  hashPasswordSync,
  hasPermission,
  isLastActiveSuperAdmin,
  sanitizeAuditDetails,
  validateUserModification,
  verifyPasswordSync,
} from './authSecurity';
import { UserAccount } from '../types/database';

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

  // Attempting to delete last active Super Admin must be blocked
  const delCheck = validateUserModification({
    actor: super1,
    rolePermissions: perms,
    targetUser: super1,
    allUsers: [super1, adminUser],
    operation: 'delete',
  });
  assert.equal(delCheck.allowed, false);
  assert.ok(delCheck.error?.includes('last active Super Admin'));

  // Attempting to deactivate last active Super Admin must be blocked
  const deactCheck = validateUserModification({
    actor: super1,
    rolePermissions: perms,
    targetUser: super1,
    allUsers: [super1, adminUser],
    operation: 'deactivate',
  });
  assert.equal(deactCheck.allowed, false);

  // Attempting to demote last active Super Admin must be blocked
  const demoteCheck = validateUserModification({
    actor: super1,
    rolePermissions: perms,
    targetUser: super1,
    allUsers: [super1, adminUser],
    operation: 'change_role',
    newRole: 'admin',
  });
  assert.equal(demoteCheck.allowed, false);

  // When a second active Super Admin exists, deactivating one is allowed
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

test('Audit log sanitizer redacts passwords, PINs, tokens, and hashes', () => {
  const raw = 'User login with password: MySecretPassword123 and token=abc999 hash pbkdf2_cgh$1234567890abcdef';
  const clean = sanitizeAuditDetails(raw);
  assert.equal(clean.includes('MySecretPassword123'), false);
  assert.equal(clean.includes('abc999'), false);
  assert.ok(clean.includes('[REDACTED]'));
});

import React, { useState } from 'react';
import {
  Users,
  Shield,
  KeyRound,
  UserPlus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Trash2,
  Edit3,
  History,
  LogIn,
  Ban,
  Search,
} from 'lucide-react';
import {
  AppModule,
  AuditLog,
  PermissionAction,
  RolePermissionMap,
  UserAccount,
  UserRole,
} from '../types/database';
import {
  ALL_ACTIONS,
  ALL_MODULES,
  hasPermission,
  isLastActiveSuperAdmin,
  ROLE_LABELS,
} from '../utils/authSecurity';

interface UserManagementViewProps {
  users: UserAccount[];
  currentUser: UserAccount;
  rolePermissions: RolePermissionMap;
  auditLogs: AuditLog[];
  onCreateUser: (input: {
    username: string;
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    passwordPlain: string;
  }) => { success: boolean; user?: UserAccount; error?: string };
  onUpdateUser: (
    userId: string,
    updates: {
      fullName?: string;
      email?: string;
      phone?: string;
      role?: UserRole;
      isActive?: boolean;
    }
  ) => { success: boolean; user?: UserAccount; error?: string };
  onResetPassword: (userId: string, newPasswordPlain: string) => { success: boolean; error?: string };
  onRevokeAccess: (userId: string, reason?: string) => { success: boolean; error?: string };
  onDeleteUser: (userId: string, reason?: string) => { success: boolean; error?: string };
  onUpdateRolePermissions: (
    role: UserRole,
    modulePermissions: Record<AppModule, PermissionAction[]>
  ) => { success: boolean; error?: string };
  onSwitchUser: (userId: string) => { success: boolean; user?: UserAccount; error?: string };
  onAuthenticateUser: (
    username: string,
    passwordPlain: string
  ) => { success: boolean; user?: UserAccount; error?: string };
}

const MODULE_LABELS: Record<AppModule, string> = {
  dashboard: 'Dashboard & KPIs',
  orders: 'Manual Orders',
  ai_order_entry: 'AI Auto Order Entry',
  inventory: 'Products & Inventory',
  purchases: 'Purchases & Suppliers',
  couriers: 'Parcels & Couriers',
  expenses: 'Meta Ads & Expenses',
  accounting: 'Cash In/Out & P&L',
  customers: 'Customers Directory',
  reports: 'Analytics & Exports',
  users: 'Users & Permissions',
  audit_logs: 'System Audit Logs',
  settings: 'Settings & Backup',
};

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  rolePermissions,
  auditLogs,
  onCreateUser,
  onUpdateUser,
  onResetPassword,
  onRevokeAccess,
  onDeleteUser,
  onUpdateRolePermissions,
  onSwitchUser,
  onAuthenticateUser,
}) => {
  const [subTab, setSubTab] = useState<'users' | 'permissions' | 'audit'>('users');
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<UserRole>('admin');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Create User Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [newPassword, setNewPassword] = useState('');

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('staff');

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<UserAccount | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  // Login Test Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Audit Filter State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditUserFilter, setAuditUserFilter] = useState('all');

  const canCreateUsers = hasPermission(currentUser, rolePermissions, 'users', 'create');
  const canEditUsers = hasPermission(currentUser, rolePermissions, 'users', 'edit');
  const canDeleteUsers = hasPermission(currentUser, rolePermissions, 'users', 'delete');

  const showMessage = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onCreateUser({
      username: newUsername,
      fullName: newFullName,
      email: newEmail,
      phone: newPhone,
      role: newRole,
      passwordPlain: newPassword,
    });
    if (!res.success) {
      showMessage('error', res.error || 'Failed to create user.');
      return;
    }
    showMessage(
      'success',
      `Created user ${res.user?.fullName} (@${res.user?.username}) with salted password hash.`
    );
    setIsCreateOpen(false);
    setNewUsername('');
    setNewFullName('');
    setNewEmail('');
    setNewPhone('');
    setNewPassword('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const res = onUpdateUser(editingUser.id, {
      fullName: editFullName,
      email: editEmail,
      phone: editPhone,
      role: editRole,
    });
    if (!res.success) {
      showMessage('error', res.error || 'Failed to update user.');
      return;
    }
    showMessage('success', `Updated account settings for @${editingUser.username}.`);
    setEditingUser(null);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    const res = onResetPassword(resetTargetUser.id, resetPasswordValue);
    if (!res.success) {
      showMessage('error', res.error || 'Password reset failed.');
      return;
    }
    showMessage(
      'success',
      `Password securely reset and active sessions rotated for @${resetTargetUser.username}.`
    );
    setResetTargetUser(null);
    setResetPasswordValue('');
  };

  const handleTogglePermissionAction = (module: AppModule, action: PermissionAction) => {
    if (selectedRoleForMatrix === 'super_admin') return;
    const currentRoleMap = rolePermissions[selectedRoleForMatrix];
    const existingActions = currentRoleMap[module] || [];
    const nextActions = existingActions.includes(action)
      ? existingActions.filter((a) => a !== action)
      : [...existingActions, action];

    const updatedMap: Record<AppModule, PermissionAction[]> = {
      ...currentRoleMap,
      [module]: nextActions,
    };

    const res = onUpdateRolePermissions(selectedRoleForMatrix, updatedMap);
    if (!res.success) {
      showMessage('error', res.error || 'Failed to update permissions.');
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (auditUserFilter !== 'all' && log.performedBy !== auditUserFilter) return false;
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.performedBy.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <span>Multi-User Administration & Role-Based Access Control (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage staff logins, salted password hashes, granular module permissions, session revocation, and audit logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSubTab('users')}
              className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
                subTab === 'users' ? 'bg-white text-emerald-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Users ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('permissions')}
              className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
                subTab === 'permissions' ? 'bg-white text-emerald-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Roles & Permissions Matrix
            </button>
            <button
              type="button"
              onClick={() => setSubTab('audit')}
              className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${
                subTab === 'audit' ? 'bg-white text-emerald-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Audit Log ({auditLogs.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsLoginModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-700" />
            <span>Login with Password</span>
          </button>

          {canCreateUsers && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add User Account</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* TAB 1: USERS DIRECTORY */}
      {subTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
            <div className="text-xs text-slate-600">
              Active Session: <strong className="text-slate-900">{currentUser.fullName}</strong> (@
              {currentUser.username}) •{' '}
              <span className="font-semibold text-emerald-800">
                {ROLE_LABELS[currentUser.role].name}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              <span>All passwords salted & hashed (PBKDF2-CGH). Last active Super Admin protected.</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">User / Login ID</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Password Security</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const roleMeta = ROLE_LABELS[u.role];
                  const isLastSuper = isLastActiveSuperAdmin(u.id, users);
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{u.fullName}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-700 text-white font-semibold">
                              Active You
                            </span>
                          )}
                          {isLastSuper && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                              Primary Super Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">@{u.username}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${roleMeta.badgeClass}`}
                        >
                          {roleMeta.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{u.email}</div>
                        <div className="font-mono text-[11px] text-slate-500">{u.phone}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                        <div>Hash: {u.passwordHash.slice(0, 18)}…</div>
                        <div>Session v{u.sessionVersion || 1}</div>
                      </td>
                      <td className="px-4 py-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold text-[11px]">
                            <XCircle className="w-3 h-3" /> Deactivated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.isActive && !isCurrent && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = onSwitchUser(u.id);
                                if (res.success) {
                                  showMessage('success', `Switched active user session to ${u.fullName} (${roleMeta.name}).`);
                                } else {
                                  showMessage('error', res.error || 'Could not switch user.');
                                }
                              }}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded border border-slate-200 cursor-pointer"
                              title="Switch active session to test this role"
                            >
                              Switch To
                            </button>
                          )}

                          {canEditUsers && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditFullName(u.fullName);
                                  setEditEmail(u.email);
                                  setEditPhone(u.phone);
                                  setEditRole(u.role);
                                }}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded cursor-pointer"
                                title="Edit User & Role"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setResetTargetUser(u);
                                  setResetPasswordValue('');
                                }}
                                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                                title="Secure Password Reset"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={isLastSuper && u.isActive}
                                onClick={() => {
                                  if (u.isActive) {
                                    const res = onRevokeAccess(u.id, 'Revoked by Admin');
                                    if (!res.success) {
                                      showMessage('error', res.error || 'Cannot revoke access.');
                                    } else {
                                      showMessage('success', `Revoked access and deactivated @${u.username}.`);
                                    }
                                  } else {
                                    const res = onUpdateUser(u.id, { isActive: true });
                                    if (res.success) {
                                      showMessage('success', `Re-activated user @${u.username}.`);
                                    } else {
                                      showMessage('error', res.error || 'Cannot activate user.');
                                    }
                                  }
                                }}
                                className={`px-2 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                                  isLastSuper && u.isActive
                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                                    : u.isActive
                                    ? 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                                title={
                                  isLastSuper
                                    ? 'Cannot disable the last active Super Admin'
                                    : u.isActive
                                    ? 'Deactivate / Revoke Access'
                                    : 'Activate Account'
                                }
                              >
                                {u.isActive ? 'Revoke' : 'Activate'}
                              </button>
                            </>
                          )}

                          {canDeleteUsers && (
                            <button
                              type="button"
                              disabled={isLastSuper}
                              onClick={() => {
                                const res = onDeleteUser(u.id, 'Deleted from User Management');
                                if (!res.success) {
                                  showMessage('error', res.error || 'Cannot delete user.');
                                } else {
                                  showMessage('success', `Deleted user @${u.username}.`);
                                }
                              }}
                              className={`p-1.5 rounded ${
                                isLastSuper
                                  ? 'opacity-30 cursor-not-allowed text-slate-300'
                                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                              }`}
                              title={
                                isLastSuper
                                  ? 'Protected: Cannot delete the last active Super Admin'
                                  : 'Delete user account'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
      {subTab === 'permissions' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Configurable Module Permissions by Role
              </h3>
              <p className="text-xs text-slate-500">
                Configure view, create, edit, delete, export, and approve permissions per module. Enforced in both UI and backend APIs.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRoleForMatrix(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                    selectedRoleForMatrix === r
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {ROLE_LABELS[r].name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <strong className="text-slate-900">{ROLE_LABELS[selectedRoleForMatrix].name}</strong>:{' '}
              <span className="text-slate-600">{ROLE_LABELS[selectedRoleForMatrix].description}</span>
            </div>
            {selectedRoleForMatrix === 'super_admin' && (
              <span className="px-2 py-0.5 rounded bg-emerald-900 text-amber-300 font-semibold text-[11px]">
                Locked Full Access
              </span>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">System Module</th>
                  {ALL_ACTIONS.map((act) => (
                    <th key={act} className="px-3 py-3 text-center capitalize">
                      {act}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ALL_MODULES.map((mod) => {
                  const allowed = rolePermissions[selectedRoleForMatrix]?.[mod] || [];
                  return (
                    <tr key={mod} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {MODULE_LABELS[mod]}
                      </td>
                      {ALL_ACTIONS.map((act) => {
                        const checked =
                          selectedRoleForMatrix === 'super_admin' || allowed.includes(act);
                        return (
                          <td key={act} className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={selectedRoleForMatrix === 'super_admin' || !canEditUsers}
                              onChange={() => handleTogglePermissionAction(mod, act)}
                              className="w-4 h-4 rounded accent-emerald-700 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOG */}
      {subTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-700" />
                <span>Immutable Security & Operations Audit Log</span>
              </h3>
              <p className="text-xs text-slate-500">
                Tracks who created, edited, deleted, restored, or approved records with timestamps. Secrets are automatically redacted.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search action, record, user..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <select
                value={auditUserFilter}
                onChange={(e) => setAuditUserFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="all">All Users</option>
                {Array.from(new Set(auditLogs.map((l) => l.performedBy))).map((actorName) => (
                  <option key={actorName} value={actorName}>
                    {actorName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Timestamp (Asia/Dhaka)</th>
                  <th className="px-4 py-3">User / Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Record Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      <div>{log.performedBy}</div>
                      {log.userRole && (
                        <div className="text-[10px] text-emerald-700 font-mono">{log.userRole}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{log.entity}</td>
                    <td className="px-4 py-2.5 text-slate-800">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Create New User Account</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Unique Login Username *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. tanvir_om"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@cgh.com.bd"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                >
                  {currentUser.role === 'super_admin' && (
                    <option value="super_admin">Super Admin (Full Access)</option>
                  )}
                  <option value="admin">Admin (Configurable Access)</option>
                  <option value="order_manager">Order Manager</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Initial Password (min 6 chars, stored as salted hash) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
              >
                Create User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Edit User @{editingUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="order_manager">Order Manager</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: SECURE PASSWORD RESET */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleResetPasswordSubmit}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Reset Password for @{resetTargetUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                New Password (min 6 characters)
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Enter new strong password"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Generates a new cryptographic salt, stores only the PBKDF2-CGH hash, and invalidates older sessions.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: LOGIN WITH CREDENTIALS */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = onAuthenticateUser(loginUsername, loginPassword);
              if (!res.success) {
                showMessage('error', res.error || 'Authentication failed.');
                return;
              }
              showMessage('success', `Authenticated as ${res.user?.fullName} (@${res.user?.username}).`);
              setIsLoginModalOpen(false);
              setLoginUsername('');
              setLoginPassword('');
            }}
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Sign In with User Credentials</h3>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username or Email</label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="mdrabbyislamsanny1@gmail.com or username"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 space-y-0.5 font-mono">
                <div>Configured Accounts (Salted Hash Verified):</div>
                <div>• Main Super Admin: mdrabbyislamsanny1@gmail.com</div>
                <div>• Admin: rafiq / Manager@123</div>
                <div>• Order Manager: nusrat / Order@123</div>
                <div>• Staff: sakib / Staff@123</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
              >
                Verify & Sign In
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

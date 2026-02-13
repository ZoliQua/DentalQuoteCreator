import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getAuthHeaders, type AuthUser, type PermissionItem } from '../utils/auth';
import { Modal, ConfirmModal } from '../components/common/Modal';
import type { TranslationKeys } from '../i18n/hu';

type AdminUser = AuthUser & {
  permissions: PermissionItem[];
};

type UserRole = 'admin' | 'doctor' | 'assistant' | 'receptionist' | 'user' | 'beta_tester';

type AuditLogEntry = {
  id: string;
  key: string;
  oldValue: boolean;
  newValue: boolean;
  changedAt: string;
  changedByName: string;
};

type ActivityLogEntry = {
  id: string;
  action: string;
  page: string | null;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  ipAddress: string | null;
};

function getPermissionLabels(t: TranslationKeys): Record<string, string> {
  return {
    'quotes.view': t.admin.permQuotesView,
    'quotes.create': t.admin.permQuotesCreate,
    'quotes.delete': t.admin.permQuotesDelete,
    'invoices.view': t.admin.permInvoicesView,
    'invoices.issue': t.admin.permInvoicesIssue,
    'invoices.storno': t.admin.permInvoicesStorno,
    'catalog.view': t.admin.permCatalogView,
    'catalog.create': t.admin.permCatalogCreate,
    'catalog.update': t.admin.permCatalogUpdate,
    'catalog.delete': t.admin.permCatalogDelete,
    'patients.update': t.admin.permPatientsUpdate,
    'patients.create': t.admin.permPatientsCreate,
    'patients.delete': t.admin.permPatientsDelete,
    'lab.view': t.admin.permLabView,
    'settings.view': t.admin.permSettingsView,
    'data.view': t.admin.permDataView,
    'admin.users.manage': t.admin.permAdminUsersManage,
    'admin.permissions.manage': t.admin.permAdminPermissionsManage,
  };
}

function getRoleLabel(role: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    admin: t.admin.roleAdmin,
    doctor: t.admin.roleDoctor,
    assistant: t.admin.roleAssistant,
    receptionist: t.admin.roleReceptionist,
    user: t.admin.roleUser,
    beta_tester: t.admin.roleBetaTester,
  };
  return map[role] || role;
}

const ROLE_OPTIONS: UserRole[] = ['admin', 'doctor', 'assistant', 'receptionist', 'user', 'beta_tester'];

function getActivityLabel(action: string, t: TranslationKeys): string {
  const map: Record<string, string> = {
    'login': t.admin.activityLogin,
    'logout': t.admin.activityLogout,
    'patient.create': t.admin.activityPatientCreate,
    'patient.delete': t.admin.activityPatientDelete,
    'quote.create': t.admin.activityQuoteCreate,
    'quote.delete': t.admin.activityQuoteDelete,
    'invoice.create': t.admin.activityInvoiceCreate,
    'invoice.storno': t.admin.activityInvoiceStorno,
  };
  return map[action] || action;
}

const parseResponse = async <T,>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) return {} as T;
  const data = JSON.parse(text) as T;
  return data;
};

export function AdminPage() {
  const { user, hasPermission, refreshMe } = useAuth();
  const { t } = useSettings();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'user' as UserRole,
    isActive: true,
  });
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'user' as UserRole,
  });
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [auditLogUser, setAuditLogUser] = useState<AdminUser | null>(null);
  const [auditLogEntries, setAuditLogEntries] = useState<AuditLogEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [activityLogUser, setActivityLogUser] = useState<AdminUser | null>(null);
  const [activityLogEntries, setActivityLogEntries] = useState<ActivityLogEntry[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);

  const canManageUsers = hasPermission('admin.users.manage');
  const canManagePermissions = hasPermission('admin.permissions.manage');

  const selectedUser = useMemo(
    () => users.find((entry) => entry.id === selectedUserId) || null,
    [selectedUserId, users]
  );

  const loadUsers = async () => {
    if (!canManageUsers) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/backend/admin/users', {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        const parsed = await parseResponse<{ message?: string }>(response);
        throw new Error(parsed.message || `HTTP ${response.status}`);
      }
      const data = await parseResponse<AdminUser[]>(response);
      const activeUsers = data.filter((entry) => entry.isActive);
      setUsers(activeUsers);
      if (!selectedUserId && activeUsers.length > 0) {
        setSelectedUserId(activeUsers[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.loadUsersFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers().catch(() => undefined);
  }, [canManageUsers]);

  const openEditModal = (entry: AdminUser) => {
    setEditingUser(entry);
    setEditForm({
      fullName: entry.fullName,
      email: entry.email,
      password: '',
      role: entry.role as UserRole,
    });
  };

  const openAuditLog = async (entry: AdminUser) => {
    setAuditLogUser(entry);
    setAuditLogLoading(true);
    try {
      const response = await fetch(`/backend/admin/audit-log/${entry.id}`, {
        headers: { ...getAuthHeaders() },
      });
      if (response.ok) {
        setAuditLogEntries(await response.json());
      }
    } catch { /* ignore */ } finally {
      setAuditLogLoading(false);
    }
  };

  const openActivityLog = async (entry: AdminUser) => {
    setActivityLogUser(entry);
    setActivityLogLoading(true);
    try {
      const response = await fetch(`/backend/admin/activity-log/${entry.id}`, {
        headers: { ...getAuthHeaders() },
      });
      if (response.ok) {
        setActivityLogEntries(await response.json());
      }
    } catch { /* ignore */ } finally {
      setActivityLogLoading(false);
    }
  };

  const handleUpdateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, string> = {
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }
      const response = await fetch(`/backend/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const parsed = await parseResponse<{ message?: string }>(response);
        throw new Error(parsed.message || t.admin.userUpdateFailed);
      }
      setMessage(t.admin.userUpdated);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.userUpdateFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/backend/admin/users/${deletingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ isActive: false }),
      });
      if (!response.ok) {
        const parsed = await parseResponse<{ message?: string }>(response);
        throw new Error(parsed.message || t.admin.userDeleteFailed);
      }
      setMessage(t.admin.userDeleted);
      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.userDeleteFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newUser.password !== newUser.passwordConfirm) {
      setError(t.admin.passwordMismatch);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { passwordConfirm: _, ...payload } = newUser;
      const response = await fetch('/backend/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const parsed = await parseResponse<{ message?: string }>(response);
        throw new Error(parsed.message || t.admin.userCreateFailed);
      }
      setNewUser({ fullName: '', email: '', password: '', passwordConfirm: '', role: 'user' as UserRole, isActive: true });
      setShowAddUserModal(false);
      setMessage(t.admin.userCreated);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.userCreateFailed);
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = async (key: string, value: boolean) => {
    if (!selectedUser || !canManagePermissions) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const permissions = selectedUser.permissions.map((entry) =>
        entry.key === key ? { ...entry, isAllowed: value } : entry
      );
      const response = await fetch(`/backend/admin/permissions/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ permissions }),
      });
      if (!response.ok) {
        const parsed = await parseResponse<{ message?: string }>(response);
        throw new Error(parsed.message || t.admin.permissionSaveFailed);
      }
      setMessage(t.admin.permissionsSaved);
      await loadUsers();
      if (selectedUser.id === user?.id) {
        await refreshMe();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.permissionSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (!canManageUsers && !canManagePermissions) {
    return (
      <div className="text-slate-700">
        <h1 className="text-2xl font-bold text-slate-900">{t.admin.title}</h1>
        <p className="mt-2">{t.admin.noPermission}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t.admin.title}</h1>
        <p className="text-slate-600 mt-2">{t.admin.subtitle}</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">{message}</div>
      )}

      {canManageUsers && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setNewUser({ fullName: '', email: '', password: '', passwordConfirm: '', role: 'user' as UserRole, isActive: true });
              setShowAddUserModal(true);
            }}
            className="rounded-lg bg-dental-600 text-white font-medium px-4 py-2 hover:bg-dental-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.admin.addUser}
          </button>
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-xl font-semibold text-slate-900">{t.admin.users}</h2>
        </div>
        {loading ? (
          <div className="px-5 py-4 text-slate-600">{t.common.loading}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="border-r border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 text-sm uppercase">
                  <tr>
                    <th className="px-4 py-3">{t.admin.name}</th>
                    <th className="px-4 py-3">{t.patients.email}</th>
                    <th className="px-4 py-3">{t.admin.role}</th>
                    {canManageUsers && <th className="px-4 py-3 w-20" />}
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`border-t border-slate-100 cursor-pointer ${
                        selectedUserId === entry.id ? 'bg-dental-50' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedUserId(entry.id)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{entry.fullName}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.email}</td>
                      <td className="px-4 py-3 text-slate-700">{getRoleLabel(entry.role, t)}</td>
                      {canManageUsers && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title={t.admin.editUser}
                              className="p-1.5 rounded-md text-slate-500 hover:text-dental-600 hover:bg-slate-100"
                              onClick={(e) => { e.stopPropagation(); openEditModal(entry); }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              title={t.admin.deleteUser}
                              className={`p-1.5 rounded-md ${
                                entry.role === 'admin'
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                              }`}
                              disabled={entry.role === 'admin'}
                              onClick={(e) => { e.stopPropagation(); setDeletingUser(entry); }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">{t.admin.permissions}</h3>
                {selectedUser && (
                  <div className="flex items-center gap-1">
                    {canManagePermissions && (
                      <button
                        type="button"
                        title={t.admin.auditLogTitle}
                        className="p-1.5 rounded-md text-slate-500 hover:text-dental-600 hover:bg-slate-100"
                        onClick={() => openAuditLog(selectedUser)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </button>
                    )}
                    {canManageUsers && (
                      <button
                        type="button"
                        title={t.admin.activityLogTitle}
                        className="p-1.5 rounded-md text-slate-500 hover:text-dental-600 hover:bg-slate-100"
                        onClick={() => openActivityLog(selectedUser)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!selectedUser && <p className="text-slate-600">{t.admin.selectUser}</p>}
              {selectedUser && (
                <>
                  <p className="text-sm text-slate-600">
                    {selectedUser.fullName} ({getRoleLabel(selectedUser.role, t)})
                  </p>
                  {selectedUser.permissions.map((entry) => (
                    <label key={entry.key} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-800">{getPermissionLabels(t)[entry.key] || entry.key}</span>
                      <input
                        type="checkbox"
                        checked={entry.isAllowed}
                        disabled={!canManagePermissions || saving}
                        onChange={(event) => togglePermission(entry.key, event.target.checked)}
                        className="h-4 w-4"
                      />
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <Modal
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title={t.admin.editUser}
        size="sm"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.admin.fullName}</label>
            <input
              value={editForm.fullName}
              onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.patients.email}</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.admin.newPassword}</label>
            <input
              type="password"
              value={editForm.password}
              onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder={t.admin.newPasswordPlaceholder}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.admin.role}</label>
            <select
              value={editForm.role}
              onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{getRoleLabel(r, t)}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-dental-600 text-white font-medium px-4 py-2 hover:bg-dental-700 disabled:opacity-60"
              disabled={saving}
            >
              {t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deletingUser !== null}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        title={t.admin.deleteUser}
        message={t.admin.deleteUserConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />

      <Modal
        isOpen={auditLogUser !== null}
        onClose={() => { setAuditLogUser(null); setAuditLogEntries([]); }}
        title={`${t.admin.auditLogTitle} — ${auditLogUser?.fullName || ''}`}
        size="lg"
      >
        {auditLogLoading ? (
          <p className="text-slate-600">{t.common.loading}</p>
        ) : auditLogEntries.length === 0 ? (
          <p className="text-slate-600">{t.admin.auditLogNoEntries}</p>
        ) : (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2">{t.admin.auditLogWhen}</th>
                  <th className="px-3 py-2">{t.admin.auditLogWho}</th>
                  <th className="px-3 py-2">{t.admin.auditLogPermission}</th>
                  <th className="px-3 py-2">{t.admin.auditLogOldValue}</th>
                  <th className="px-3 py-2">{t.admin.auditLogNewValue}</th>
                </tr>
              </thead>
              <tbody>
                {auditLogEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(entry.changedAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{entry.changedByName}</td>
                    <td className="px-3 py-2">{getPermissionLabels(t)[entry.key] || entry.key}</td>
                    <td className="px-3 py-2">{entry.oldValue ? t.admin.auditLogEnabled : t.admin.auditLogDisabled}</td>
                    <td className="px-3 py-2">{entry.newValue ? t.admin.auditLogEnabled : t.admin.auditLogDisabled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        title={t.admin.addUser}
        size="sm"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.admin.fullName}</label>
            <input
              value={newUser.fullName}
              onChange={(event) => setNewUser((prev) => ({ ...prev, fullName: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.patients.email}</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.admin.password}</label>
            <input
              type="password"
              value={newUser.password}
              onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.admin.passwordConfirm}</label>
            <input
              type="password"
              value={newUser.passwordConfirm}
              onChange={(event) => setNewUser((prev) => ({ ...prev, passwordConfirm: event.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 ${
                newUser.passwordConfirm && newUser.password !== newUser.passwordConfirm
                  ? 'border-red-500'
                  : 'border-slate-300'
              }`}
              required
            />
            {newUser.passwordConfirm && newUser.password !== newUser.passwordConfirm && (
              <p className="mt-1 text-sm text-red-600">{t.admin.passwordMismatch}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t.admin.role}</label>
            <select
              value={newUser.role}
              onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value as UserRole }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{getRoleLabel(r, t)}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddUserModal(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-dental-600 text-white font-medium px-4 py-2 hover:bg-dental-700 disabled:opacity-60"
              disabled={saving || (!!newUser.passwordConfirm && newUser.password !== newUser.passwordConfirm)}
            >
              {t.common.add}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={activityLogUser !== null}
        onClose={() => { setActivityLogUser(null); setActivityLogEntries([]); }}
        title={`${t.admin.activityLogTitle} — ${activityLogUser?.fullName || ''}`}
        size="lg"
      >
        {activityLogLoading ? (
          <p className="text-slate-600">{t.common.loading}</p>
        ) : activityLogEntries.length === 0 ? (
          <p className="text-slate-600">{t.admin.activityLogNoEntries}</p>
        ) : (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2">{t.admin.activityLogRow}</th>
                  <th className="px-3 py-2">{t.admin.activityLogTimestamp}</th>
                  <th className="px-3 py-2">{t.admin.activityLogAction}</th>
                  <th className="px-3 py-2">{t.admin.activityLogDetails}</th>
                </tr>
              </thead>
              <tbody>
                {activityLogEntries.map((entry, idx) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{getActivityLabel(entry.action, t)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {entry.entityType && <span>{entry.entityType}{entry.entityId ? ` #${entry.entityId.slice(0, 8)}` : ''}</span>}
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <span className="ml-1">{JSON.stringify(entry.details)}</span>
                      )}
                      {entry.ipAddress && <span className="ml-1 text-slate-400">{entry.ipAddress}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

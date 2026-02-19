import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { getAuthHeaders } from '../utils/auth';
import { Button, Card, CardContent, CardHeader, Select } from '../components/common';
import { Modal, ConfirmModal } from '../components/common/Modal';

type ColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
};

type BrowseResponse = {
  table: string;
  pkColumns: string[];
  totalRows: number;
  page: number;
  limit: number;
  totalPages: number;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
};

const PAGE_SIZES = [10, 25, 50, 100];
const READ_ONLY_COLUMNS = new Set(['createdAt', 'updatedAt']);

const TABLES = [
  'AppSettings',
  'AuthSession',
  'DentalStatusSnapshot',
  'Invoice',
  'NeakCheck',
  'OdontogramCurrent',
  'OdontogramDaily',
  'OdontogramTimeline',
  'Patient',
  'PermissionAuditLog',
  'PriceList',
  'PriceListCategory',
  'PriceListCatalogItem',
  'Quote',
  'User',
  'UserActivityLog',
  'UserPermissionOverride',
];

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildPkId(row: Record<string, unknown>, pkColumns: string[]): string {
  return pkColumns.map(col => String(row[col] ?? '')).join('--');
}

export function DatabaseBrowserPage() {
  const { t } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTable = searchParams.get('table') || '';

  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Edit modal
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Success toast
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedTable) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (sortColumn) {
        params.set('sortColumn', sortColumn);
        params.set('sortDir', sortDir);
      }
      const response = await fetch(
        `/backend/db/browse/${selectedTable}?${params}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('403');
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const json = (await response.json()) as BrowseResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedTable, page, limit, sortColumn, sortDir]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
    setSortColumn(null);
    setSortDir('asc');
  }, [selectedTable]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const table = e.target.value;
    if (table) {
      setSearchParams({ table });
    } else {
      setSearchParams({});
    }
    setData(null);
  };

  const openEditModal = (row: Record<string, unknown>) => {
    setEditRow(row);
    setSaveError(null);
    const values: Record<string, string> = {};
    if (data) {
      for (const col of data.columns) {
        const val = row[col.name];
        if (val === null || val === undefined) {
          values[col.name] = '';
        } else if (typeof val === 'object') {
          values[col.name] = JSON.stringify(val, null, 2);
        } else {
          values[col.name] = String(val);
        }
      }
    }
    setEditValues(values);
  };

  const handleSave = async () => {
    if (!editRow || !data) return;
    setSaveError(null);

    const body: Record<string, unknown> = {};
    for (const col of data.columns) {
      if (data.pkColumns.includes(col.name)) continue;
      if (READ_ONLY_COLUMNS.has(col.name)) continue;

      const rawValue = editValues[col.name] ?? '';
      const dataType = col.type;

      // Type conversion
      if (rawValue === '' && col.nullable) {
        body[col.name] = null;
      } else if (dataType === 'jsonb' || dataType === 'json') {
        try {
          body[col.name] = rawValue === '' ? null : JSON.parse(rawValue);
        } catch {
          setSaveError(`${t.dbBrowser.jsonInvalid}: ${col.name}`);
          return;
        }
      } else if (dataType === 'boolean') {
        body[col.name] = rawValue === 'true' || rawValue === '1';
      } else if (dataType === 'integer' || dataType === 'bigint' || dataType === 'smallint') {
        body[col.name] = rawValue === '' ? null : parseInt(rawValue, 10);
      } else if (dataType === 'double precision' || dataType === 'real' || dataType === 'numeric') {
        body[col.name] = rawValue === '' ? null : parseFloat(rawValue);
      } else if (dataType.endsWith('[]') || dataType.startsWith('ARRAY')) {
        try {
          body[col.name] = rawValue === '' ? null : JSON.parse(rawValue);
        } catch {
          setSaveError(`${t.dbBrowser.jsonInvalid}: ${col.name}`);
          return;
        }
      } else {
        body[col.name] = rawValue;
      }
    }

    const pkId = buildPkId(editRow, data.pkColumns);
    try {
      const response = await fetch(`/backend/db/browse/${data.table}/${encodeURIComponent(pkId)}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || `HTTP ${response.status}`);
      }
      setEditRow(null);
      setToast(t.dbBrowser.saveSuccess);
      loadData();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteRowId || !data) return;
    try {
      const response = await fetch(`/backend/db/browse/${data.table}/${encodeURIComponent(deleteRowId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || `HTTP ${response.status}`);
      }
      setDeleteRowId(null);
      setToast(t.dbBrowser.deleteSuccess);
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const tableOptions = [
    { value: '', label: t.dbBrowser.selectTablePlaceholder },
    ...TABLES.map(name => ({ value: name, label: name })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/data" className="text-sm text-dental-600 hover:text-dental-800 mb-2 inline-block">
          &larr; {t.dataManagement.title}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t.dbBrowser.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{t.dbBrowser.subtitle}</p>
      </div>

      {/* Table selector */}
      <Card>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="w-72">
              <Select
                label={t.dbBrowser.selectTable}
                options={tableOptions}
                value={selectedTable}
                onChange={handleTableChange}
              />
            </div>
            {data && (
              <p className="text-sm text-gray-500 pb-2">
                {t.dbBrowser.totalRows}: <strong>{new Intl.NumberFormat('hu-HU').format(data.totalRows)}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading / Error */}
      {loading && <p className="text-sm text-gray-500">{t.common.loading}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-2 text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Data table */}
      {data && !loading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{data.table}</h2>
              <div className="flex items-center gap-2">
                <Select
                  options={PAGE_SIZES.map(s => ({ value: String(s), label: String(s) }))}
                  value={String(limit)}
                  onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">{t.common.perPage}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent noPadding>
            {data.rows.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">{t.dbBrowser.noRows}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      {data.columns.map(col => {
                        const isActive = sortColumn === col.name;
                        return (
                          <th
                            key={col.name}
                            className="px-3 py-2 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors"
                            onClick={() => {
                              if (isActive) {
                                setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortColumn(col.name);
                                setSortDir('asc');
                              }
                              setPage(1);
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {col.name}
                              <span className="inline-flex flex-col leading-none text-[10px]">
                                <span className={isActive && sortDir === 'asc' ? 'text-dental-600' : 'text-gray-300'}>&#9650;</span>
                                <span className={isActive && sortDir === 'desc' ? 'text-dental-600' : 'text-gray-300'}>&#9660;</span>
                              </span>
                            </div>
                            <div className="font-normal text-gray-400 normal-case">{col.type}</div>
                          </th>
                        );
                      })}
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, idx) => {
                      const pkId = buildPkId(row, data.pkColumns);
                      return (
                        <tr
                          key={pkId || idx}
                          className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => openEditModal(row)}
                        >
                          {data.columns.map(col => (
                            <td
                              key={col.name}
                              className="px-3 py-2 max-w-[300px] truncate text-gray-700"
                              title={formatCellValue(row[col.name])}
                            >
                              {row[col.name] === null ? (
                                <span className="text-gray-400 italic">NULL</span>
                              ) : (
                                formatCellValue(row[col.name])
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <button
                              className="text-red-500 hover:text-red-700"
                              title={t.common.delete}
                              onClick={e => {
                                e.stopPropagation();
                                setDeleteRowId(pkId);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-gray-500">
                  {t.common.page} {data.page} / {data.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    &laquo;
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    &raquo;
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      {editRow && data && (
        <Modal
          isOpen
          onClose={() => setEditRow(null)}
          title={t.dbBrowser.editRow}
          size="xl"
        >
          <div className="space-y-4">
            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{saveError}</p>
            )}
            {data.columns.map(col => {
              const isPk = data.pkColumns.includes(col.name);
              const isReadOnly = isPk || READ_ONLY_COLUMNS.has(col.name);
              const isJson = col.type === 'jsonb' || col.type === 'json' || col.type.endsWith('[]');
              const isBool = col.type === 'boolean';

              return (
                <div key={col.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {col.name}
                    <span className="ml-2 font-normal text-gray-400">({col.type})</span>
                    {isPk && <span className="ml-1 text-xs text-dental-600">PK</span>}
                  </label>
                  {isReadOnly ? (
                    <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                      {formatCellValue(editRow[col.name])}
                    </p>
                  ) : isBool ? (
                    <select
                      className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-dental-500"
                      value={editValues[col.name] || 'false'}
                      onChange={e => setEditValues(prev => ({ ...prev, [col.name]: e.target.value }))}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                      {col.nullable && <option value="">NULL</option>}
                    </select>
                  ) : isJson ? (
                    <textarea
                      className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-dental-500 font-mono text-sm"
                      rows={4}
                      value={editValues[col.name] || ''}
                      onChange={e => setEditValues(prev => ({ ...prev, [col.name]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-dental-500"
                      value={editValues[col.name] || ''}
                      onChange={e => setEditValues(prev => ({ ...prev, [col.name]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setEditRow(null)}>
                {t.common.cancel}
              </Button>
              <Button onClick={() => setShowSaveConfirm(true)}>
                {t.common.save}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Save confirmation */}
      <ConfirmModal
        isOpen={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={() => { setShowSaveConfirm(false); handleSave(); }}
        title={t.common.confirm}
        message={t.dbBrowser.saveConfirm}
        confirmText={t.common.save}
        cancelText={t.common.cancel}
        variant="primary"
      />

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteRowId(null); }}
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
        title={t.common.delete}
        message={t.dbBrowser.deleteConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />
    </div>
  );
}

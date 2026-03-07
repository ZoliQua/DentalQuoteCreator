import { useState, useEffect, useCallback } from 'react';
import { Badge } from '../common/Badge';
import { useSettings } from '../../context/SettingsContext';
import { useEmail } from '../../hooks/useEmail';

interface EmailHistoryTableProps {
  patientId?: string;
  compact?: boolean;
}

export function EmailHistoryTable({ patientId, compact }: EmailHistoryTableProps) {
  const { t } = useSettings();
  const { emailHistory, emailTotal, loading, fetchHistory } = useEmail();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = compact ? 5 : 20;

  const load = useCallback(() => {
    fetchHistory({
      patientId,
      status: statusFilter || undefined,
      limit,
      offset: page * limit,
    });
  }, [fetchHistory, patientId, statusFilter, page, limit]);

  useEffect(() => { load(); }, [load]);

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
      sent: { variant: 'success', label: t.email.statusSent },
      pending: { variant: 'warning', label: t.email.statusPending },
      failed: { variant: 'danger', label: t.email.statusFailed },
    };
    const entry = map[status] || { variant: 'default' as const, label: status };
    return <Badge variant={entry.variant}>{entry.label}</Badge>;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('hu-HU') + ' ' + d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  const totalPages = Math.ceil(emailTotal / limit);

  return (
    <div>
      {/* Filters */}
      {!compact && (
        <div className="flex items-center gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 border border-theme-secondary rounded-lg text-sm bg-theme-primary text-theme-primary"
          >
            <option value="">{t.email.all}</option>
            <option value="sent">{t.email.statusSent}</option>
            <option value="pending">{t.email.statusPending}</option>
            <option value="failed">{t.email.statusFailed}</option>
          </select>
          <span className="text-sm text-theme-muted">{t.email.totalSent}: {emailTotal}</span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-theme-muted">...</div>
      ) : emailHistory.length === 0 ? (
        <div className="text-center py-8 text-theme-muted">{t.email.noHistory}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-theme-primary">
            <thead className="bg-theme-tertiary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase">{t.email.sentAt}</th>
                {!patientId && <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase">{t.email.recipient}</th>}
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase">{t.email.emailAddress}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase">{t.email.subject}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase">{t.email.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-primary">
              {emailHistory.map((log) => (
                <tr key={log.id} className="hover:bg-theme-tertiary">
                  <td className="px-4 py-3 text-sm text-theme-secondary whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  {!patientId && <td className="px-4 py-3 text-sm text-theme-primary">{log.patientName || '—'}</td>}
                  <td className="px-4 py-3 text-sm font-mono text-theme-secondary">{log.toEmail}</td>
                  <td className="px-4 py-3 text-sm text-theme-primary max-w-xs truncate" title={log.subject}>{log.subject}</td>
                  <td className="px-4 py-3 text-sm">{statusBadge(log.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-sm border border-theme-secondary rounded disabled:opacity-40 text-theme-secondary hover:bg-theme-tertiary"
          >
            &laquo;
          </button>
          <span className="text-sm text-theme-muted">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 text-sm border border-theme-secondary rounded disabled:opacity-40 text-theme-secondary hover:bg-theme-tertiary"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { getAuthHeaders } from '../utils/auth';
import { downloadAsCsv, downloadAsXlsx } from '../utils/exportHelpers';
import { Card, CardContent, CardHeader, Button } from '../components/common';

type VisitorLogEntry = {
  id: string;
  userId: string | null;
  userName: string | null;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  createdAt: string;
};

type ActivityLogEntry = {
  id: string;
  action: string;
  page: string | null;
  entityType: string | null;
  entityId: string | null;
  details: unknown;
  createdAt: string;
  ipAddress: string | null;
};

type Stats = {
  today: { total: number; unique: number };
  week: { total: number; unique: number };
  month: { total: number; unique: number };
};

type SortDir = 'asc' | 'desc';

type UserOption = { id: string; fullName: string };

const ITEMS_PER_PAGE = 50;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function UsageSection() {
  const { t } = useSettings();
  const dm = t.dataManagement;

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);

  // Visitor log
  const [visitors, setVisitors] = useState<VisitorLogEntry[]>([]);
  const [visitorLoading, setVisitorLoading] = useState(false);

  // Filters
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterDay, setFilterDay] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('');

  // Visitor sort
  const [vSortKey, setVSortKey] = useState<string>('createdAt');
  const [vSortDir, setVSortDir] = useState<SortDir>('desc');
  const [vPage, setVPage] = useState(0);

  // Activity log
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [aSortKey, setASortKey] = useState<string>('createdAt');
  const [aSortDir, setASortDir] = useState<SortDir>('desc');
  const [aPage, setAPage] = useState(0);

  // Fetch stats on mount
  useEffect(() => {
    fetch('/backend/visitor-log/stats', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  // Fetch users for activity log dropdown
  useEffect(() => {
    fetch('/backend/admin/users', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data: Array<{ id: string; fullName: string }>) => setUsers(data.map((u) => ({ id: u.id, fullName: u.fullName }))))
      .catch(() => {});
  }, []);

  // Build query params and fetch visitors
  const fetchVisitors = () => {
    setVisitorLoading(true);
    const params = new URLSearchParams();
    if (filterPeriod) {
      params.set('period', filterPeriod);
    } else {
      if (filterYear) params.set('year', filterYear);
      if (filterMonth) params.set('month', filterMonth);
      if (filterDay) params.set('day', filterDay);
    }
    fetch(`/backend/visitor-log?${params}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data: VisitorLogEntry[]) => {
        setVisitors(data);
        setVPage(0);
      })
      .catch(() => {})
      .finally(() => setVisitorLoading(false));
  };

  // Fetch on mount (all data)
  useEffect(() => {
    fetchVisitors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch activity log when user changes
  useEffect(() => {
    if (!selectedUserId) {
      setActivityLog([]);
      return;
    }
    setActivityLoading(true);
    fetch(`/backend/admin/activity-log/${selectedUserId}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data: ActivityLogEntry[]) => {
        setActivityLog(data);
        setAPage(0);
      })
      .catch(() => {})
      .finally(() => setActivityLoading(false));
  }, [selectedUserId]);

  // Sorting helpers
  const sortedVisitors = useMemo(() => {
    const sorted = [...visitors].sort((a, b) => {
      const av = (a as Record<string, unknown>)[vSortKey];
      const bv = (b as Record<string, unknown>)[vSortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return vSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [visitors, vSortKey, vSortDir]);

  const pagedVisitors = sortedVisitors.slice(vPage * ITEMS_PER_PAGE, (vPage + 1) * ITEMS_PER_PAGE);
  const vTotalPages = Math.ceil(sortedVisitors.length / ITEMS_PER_PAGE);

  const sortedActivity = useMemo(() => {
    const sorted = [...activityLog].sort((a, b) => {
      const av = (a as Record<string, unknown>)[aSortKey];
      const bv = (b as Record<string, unknown>)[aSortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return aSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [activityLog, aSortKey, aSortDir]);

  const pagedActivity = sortedActivity.slice(aPage * ITEMS_PER_PAGE, (aPage + 1) * ITEMS_PER_PAGE);
  const aTotalPages = Math.ceil(sortedActivity.length / ITEMS_PER_PAGE);

  const toggleVSort = (key: string) => {
    if (vSortKey === key) setVSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setVSortKey(key); setVSortDir('desc'); }
  };

  const toggleASort = (key: string) => {
    if (aSortKey === key) setASortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setASortKey(key); setASortDir('desc'); }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <span className="inline-block ml-1 text-xs">{active ? (dir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BC'}</span>
  );

  // Current year for filter
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const visitorColumns = [
    { key: 'createdAt', label: dm.usageDate },
    { key: 'userName', label: dm.usageUser },
    { key: 'ipAddress', label: dm.usageIp },
    { key: 'browser', label: dm.usageBrowser },
    { key: 'os', label: dm.usageOs },
    { key: 'device', label: dm.usageDevice },
    { key: 'userAgent', label: dm.usageUserAgent },
  ];

  const activityColumns = [
    { key: 'createdAt', label: dm.usageDate },
    { key: 'action', label: dm.usageAction },
    { key: 'page', label: dm.usagePage },
    { key: 'entityType', label: dm.usageEntityType },
    { key: 'entityId', label: dm.usageEntityId },
    { key: 'ipAddress', label: dm.usageIp },
    { key: 'details', label: dm.usageDetails },
  ];

  const exportVisitorRows = sortedVisitors.map((v) => ({
    ...v,
    createdAt: formatDate(v.createdAt),
    details: '',
  }));

  const exportActivityRows = sortedActivity.map((a) => ({
    ...a,
    createdAt: formatDate(a.createdAt),
    details: a.details ? JSON.stringify(a.details) : '',
  }));

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: dm.usageToday, data: stats.today },
            { label: dm.usageWeek, data: stats.week },
            { label: dm.usageMonth, data: stats.month },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{card.data.total}</p>
              <p className="text-xs text-gray-500 mt-1">
                {dm.usageVisitors} &middot; {card.data.unique} {dm.usageUnique}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Visitor log */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              {dm.usageTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => downloadAsCsv(exportVisitorRows, visitorColumns, 'visitor-log.csv')}>
                {dm.usageExportCsv}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => downloadAsXlsx(exportVisitorRows, visitorColumns, 'visitor-log.xlsx')}>
                {dm.usageExportXlsx}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{dm.usageYear}</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={filterYear}
                onChange={(e) => { setFilterYear(e.target.value); setFilterPeriod(''); }}
              >
                <option value="">{dm.usageAll}</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{dm.usageMonth2}</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={filterMonth}
                onChange={(e) => { setFilterMonth(e.target.value); setFilterPeriod(''); }}
              >
                <option value="">{dm.usageAll}</option>
                {months.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{dm.usageDay}</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={filterDay}
                onChange={(e) => { setFilterDay(e.target.value); setFilterPeriod(''); }}
              >
                <option value="">{dm.usageAll}</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <Button size="sm" variant="secondary" onClick={() => { setFilterPeriod('last30days'); setFilterYear(''); setFilterMonth(''); setFilterDay(''); }}>
              {dm.usageLast30}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setFilterPeriod('last365days'); setFilterYear(''); setFilterMonth(''); setFilterDay(''); }}>
              {dm.usageLast365}
            </Button>
            <Button size="sm" onClick={fetchVisitors}>
              {dm.usageFilter}
            </Button>
          </div>

          {visitorLoading && <p className="text-sm text-gray-500 py-4">{dm.dbReportLoading}</p>}

          {!visitorLoading && visitors.length === 0 && (
            <p className="text-sm text-gray-500 py-4">{dm.usageNoData}</p>
          )}

          {!visitorLoading && visitors.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {visitorColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-3 py-2 text-left font-medium text-gray-600 cursor-pointer select-none whitespace-nowrap"
                          onClick={() => toggleVSort(col.key)}
                        >
                          {col.label}
                          <SortIcon active={vSortKey === col.key} dir={vSortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedVisitors.map((v) => (
                      <tr key={v.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(v.createdAt)}</td>
                        <td className="px-3 py-2">{v.userName ?? '-'}</td>
                        <td className="px-3 py-2">{v.ipAddress ?? '-'}</td>
                        <td className="px-3 py-2">{v.browser ?? '-'}</td>
                        <td className="px-3 py-2">{v.os ?? '-'}</td>
                        <td className="px-3 py-2">{v.device ?? '-'}</td>
                        <td className="px-3 py-2 max-w-xs truncate" title={v.userAgent ?? ''}>{v.userAgent ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {vTotalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">{sortedVisitors.length} {dm.usageVisitors}</p>
                  <div className="flex gap-1">
                    <button disabled={vPage === 0} onClick={() => setVPage((p) => p - 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-40">&laquo;</button>
                    <span className="px-2 py-1 text-xs">{vPage + 1} / {vTotalPages}</span>
                    <button disabled={vPage >= vTotalPages - 1} onClick={() => setVPage((p) => p + 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-40">&raquo;</button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Activity log */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              {dm.usageActivityLog}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {activityLog.length > 0 && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => downloadAsCsv(exportActivityRows, activityColumns, 'activity-log.csv')}>
                    {dm.usageExportCsv}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadAsXlsx(exportActivityRows, activityColumns, 'activity-log.xlsx')}>
                    {dm.usageExportXlsx}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <select
              className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">{dm.usageSelectUser}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>

          {activityLoading && <p className="text-sm text-gray-500 py-4">{dm.dbReportLoading}</p>}

          {!activityLoading && selectedUserId && activityLog.length === 0 && (
            <p className="text-sm text-gray-500 py-4">{dm.usageNoData}</p>
          )}

          {!activityLoading && activityLog.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {activityColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-3 py-2 text-left font-medium text-gray-600 cursor-pointer select-none whitespace-nowrap"
                          onClick={() => toggleASort(col.key)}
                        >
                          {col.label}
                          <SortIcon active={aSortKey === col.key} dir={aSortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedActivity.map((a) => (
                      <tr key={a.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                        <td className="px-3 py-2">{a.action}</td>
                        <td className="px-3 py-2">{a.page ?? '-'}</td>
                        <td className="px-3 py-2">{a.entityType ?? '-'}</td>
                        <td className="px-3 py-2">{a.entityId ?? '-'}</td>
                        <td className="px-3 py-2">{a.ipAddress ?? '-'}</td>
                        <td className="px-3 py-2 max-w-xs truncate" title={a.details ? JSON.stringify(a.details) : ''}>
                          {a.details ? JSON.stringify(a.details) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {aTotalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">{sortedActivity.length} {dm.usageVisitors}</p>
                  <div className="flex gap-1">
                    <button disabled={aPage === 0} onClick={() => setAPage((p) => p - 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-40">&laquo;</button>
                    <span className="px-2 py-1 text-xs">{aPage + 1} / {aTotalPages}</span>
                    <button disabled={aPage >= aTotalPages - 1} onClick={() => setAPage((p) => p + 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-40">&raquo;</button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

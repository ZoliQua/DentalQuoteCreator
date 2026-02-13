import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useApp } from '../context/AppContext';
import { useQuotes, usePatients } from '../hooks';
import { Quote, QuoteStatus } from '../types';
import {
  Card,
  CardContent,
  SearchInput,
  EmptyState,
  EmptySearchIcon,
  ConfirmModal,
} from '../components/common';
import { formatDate, formatDateTime, formatCurrency, calculateQuoteTotals } from '../utils';

type FilterTab = 'all' | 'draft' | 'in_progress' | 'completed';
type SortColumn = 'quoteName' | 'patient' | 'doctor' | 'status' | 'createdAt' | 'modifiedAt' | 'validUntil' | 'total';
type SortDirection = 'asc' | 'desc';

export function QuotesPage({ showDeleted }: { showDeleted?: boolean }) {
  const { t, settings } = useSettings();
  const navigate = useNavigate();
  const { restoreQuote } = useApp();
  const {
    quotes,
    allQuotes,
    draftQuotes,
    inProgressQuotes,
    completedQuotes,
    deleteQuote,
    canDeleteQuote,
    closeQuote,
    acceptQuote,
    rejectQuote,
    revokeAcceptance,
    revokeRejection,
    completeTreatment,
    reopenTreatment,
  } = useQuotes();
  const { getPatient } = usePatients();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const perPage = settings.quote?.perPage || 50;

  const getPatientName = (patientId: string) => {
    const patient = getPatient(patientId);
    return patient ? `${patient.lastName} ${patient.firstName}` : '-';
  };

  const getDoctorName = (doctorId: string) => {
    const doctor = settings.doctors.find((d) => d.id === doctorId);
    return doctor?.name || '-';
  };

  const getQuoteTotal = (quote: Quote) => {
    const totals = calculateQuoteTotals(quote);
    return totals.total;
  };

  // Deleted quotes view
  const deletedQuotes = useMemo(() => {
    return allQuotes.filter((q) => q.isDeleted);
  }, [allQuotes]);

  const baseQuotes = showDeleted ? deletedQuotes : quotes;

  const filteredQuotes = useMemo(() => {
    let result = baseQuotes;

    if (!showDeleted) {
      if (filterTab === 'draft') {
        result = draftQuotes;
      } else if (filterTab === 'in_progress') {
        result = inProgressQuotes;
      } else if (filterTab === 'completed') {
        result = completedQuotes;
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((q) => {
        const patient = getPatient(q.patientId);
        const patientName = patient
          ? `${patient.lastName} ${patient.firstName}`.toLowerCase()
          : '';
        const doctor = settings.doctors.find((d) => d.id === q.doctorId);
        const doctorName = doctor?.name.toLowerCase() || '';

        return (
          q.quoteName.toLowerCase().includes(query) ||
          patientName.includes(query) ||
          doctorName.includes(query) ||
          q.quoteNumber.toLowerCase().includes(query)
        );
      });
    }

    // Sort
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'quoteName':
          cmp = a.quoteName.localeCompare(b.quoteName);
          break;
        case 'patient':
          cmp = getPatientName(a.patientId).localeCompare(getPatientName(b.patientId));
          break;
        case 'doctor':
          cmp = getDoctorName(a.doctorId).localeCompare(getDoctorName(b.doctorId));
          break;
        case 'status':
          cmp = a.quoteStatus.localeCompare(b.quoteStatus);
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'modifiedAt':
          cmp = new Date(a.lastStatusChangeAt).getTime() - new Date(b.lastStatusChangeAt).getTime();
          break;
        case 'validUntil':
          cmp = new Date(a.validUntil).getTime() - new Date(b.validUntil).getTime();
          break;
        case 'total':
          cmp = getQuoteTotal(a) - getQuoteTotal(b);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [baseQuotes, draftQuotes, inProgressQuotes, completedQuotes, filterTab, searchQuery, getPatient, settings.doctors, sortColumn, sortDirection, showDeleted]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / perPage));
  const paginatedQuotes = filteredQuotes.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortArrow = ({ column }: { column: SortColumn }) => (
    <span className="ml-1 inline-block w-3">
      {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
    </span>
  );

  const getStatusLabel = (status: QuoteStatus): string => {
    const labels: Record<QuoteStatus, string> = {
      draft: t.quotes.statusDraft,
      closed: t.quotes.statusClosed,
      rejected: t.quotes.statusRejected,
      started: t.quotes.statusStarted,
      completed: t.quotes.statusCompleted,
    };
    return labels[status];
  };

  const getStatusBadgeStyle = (status: QuoteStatus): string => {
    const styles: Record<QuoteStatus, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      started: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-600',
    };
    return styles[status];
  };

  const handleDelete = (quoteId: string) => {
    deleteQuote(quoteId);
    setDeleteConfirm(null);
  };

  const handleRestore = (quoteId: string) => {
    restoreQuote(quoteId);
    setRestoreConfirm(null);
  };

  // Icon button helper
  const IconBtn = ({ onClick, title, className, children }: { onClick: () => void; title: string; className: string; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${className}`}
    >
      {children}
    </button>
  );

  const renderActionButtons = (quote: Quote) => {
    if (showDeleted) {
      return (
        <IconBtn onClick={() => setRestoreConfirm(quote.quoteId)} title={t.quotes.restoreQuote} className="text-green-600 hover:bg-green-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
          </svg>
        </IconBtn>
      );
    }

    const status = quote.quoteStatus;
    const btns: React.ReactNode[] = [];

    if (status === 'draft') {
      btns.push(
        <IconBtn key="edit" onClick={() => navigate(`/patients/${quote.patientId}/quotes/${quote.quoteId}`)} title={t.common.edit} className="text-gray-600 hover:bg-gray-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </IconBtn>,
        <IconBtn key="close" onClick={() => closeQuote(quote.quoteId)} title={t.quotes.close} className="text-blue-600 hover:bg-blue-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </IconBtn>
      );
    }

    if (status === 'closed') {
      btns.push(
        <IconBtn key="accept" onClick={() => acceptQuote(quote.quoteId)} title={t.quotes.accept} className="text-green-600 hover:bg-green-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </IconBtn>,
        <IconBtn key="reject" onClick={() => rejectQuote(quote.quoteId)} title={t.quotes.reject} className="text-red-600 hover:bg-red-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconBtn>
      );
    }

    if (status === 'rejected') {
      btns.push(
        <IconBtn key="revoke-reject" onClick={() => revokeRejection(quote.quoteId)} title={t.quotes.revokeRejection} className="text-orange-600 hover:bg-orange-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
          </svg>
        </IconBtn>
      );
    }

    if (status === 'started') {
      btns.push(
        <IconBtn key="complete" onClick={() => completeTreatment(quote.quoteId)} title={t.quotes.completeTreatment} className="text-green-600 hover:bg-green-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </IconBtn>,
        <IconBtn key="revoke-accept" onClick={() => revokeAcceptance(quote.quoteId)} title={t.quotes.revokeAcceptance} className="text-orange-600 hover:bg-orange-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
          </svg>
        </IconBtn>
      );
    }

    if (status === 'completed') {
      btns.push(
        <IconBtn key="reopen" onClick={() => reopenTreatment(quote.quoteId)} title={t.quotes.reopenTreatment} className="text-orange-600 hover:bg-orange-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
          </svg>
        </IconBtn>
      );
    }

    // Delete button (when allowed)
    if (canDeleteQuote(quote.quoteId)) {
      btns.push(
        <IconBtn key="delete" onClick={() => setDeleteConfirm(quote.quoteId)} title={t.common.delete} className="text-red-500 hover:bg-red-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </IconBtn>
      );
    }

    return <>{btns}</>;
  };

  const ThSortable = ({ column, children, align }: { column: SortColumn; children: React.ReactNode; align?: string }) => (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(column)}
    >
      {children}
      <SortArrow column={column} />
    </th>
  );

  const pageTitle = showDeleted ? t.nav.quotesDeleted : t.quotes.title;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          {!showDeleted && (
            <p className="text-gray-500 mt-1">
              {draftQuotes.length} {t.quotes.filterDraft}, {inProgressQuotes.length} {t.quotes.filterInProgress},{' '}
              {completedQuotes.length} {t.quotes.filterCompleted}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SearchInput
          value={searchQuery}
          onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          placeholder={t.common.search}
          className="flex-1"
        />
        {!showDeleted && (
          <div className="flex items-center gap-2">
            {(['all', 'draft', 'in_progress', 'completed'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setFilterTab(tab); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterTab === tab
                    ? 'bg-dental-100 text-dental-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab === 'all' ? t.quotes.filterAll : tab === 'draft' ? t.quotes.filterDraft : tab === 'in_progress' ? t.quotes.filterInProgress : t.quotes.filterCompleted}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredQuotes.length === 0 ? (
        <Card>
          <CardContent>
            {searchQuery || filterTab !== 'all' ? (
              <EmptyState
                icon={<EmptySearchIcon />}
                title={t.common.noResults}
                description={t.quotes.noSearchResults}
              />
            ) : (
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                title={t.quotes.noQuotes}
                description={t.quotes.createFromPatientHint}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <ThSortable column="quoteName">{t.quotes.quoteName}</ThSortable>
                  <ThSortable column="patient">{t.quotes.patient}</ThSortable>
                  <ThSortable column="doctor">{t.quotes.doctor}</ThSortable>
                  <ThSortable column="status">{t.quotes.status}</ThSortable>
                  <ThSortable column="createdAt">{t.quotes.createdAt}</ThSortable>
                  <ThSortable column="modifiedAt">{t.quotes.modifiedAt}</ThSortable>
                  <ThSortable column="validUntil">{t.quotes.validUntil}</ThSortable>
                  <ThSortable column="total" align="right">{t.quotes.total}</ThSortable>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedQuotes.map((quote) => (
                  <tr key={quote.quoteId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-400">{quote.quoteNumber}</span>
                        <Link
                          to={`/patients/${quote.patientId}/quotes/${quote.quoteId}`}
                          className="text-dental-600 hover:text-dental-700 font-medium"
                        >
                          {quote.quoteName}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <Link to={`/patients/${quote.patientId}`} className="hover:text-dental-600">
                        {getPatientName(quote.patientId)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {getDoctorName(quote.doctorId)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/patients/${quote.patientId}/quotes/${quote.quoteId}`)}
                        className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 ${getStatusBadgeStyle(quote.quoteStatus)}`}
                      >
                        {getStatusLabel(quote.quoteStatus)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(quote.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDateTime(quote.lastStatusChangeAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(quote.validUntil)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(getQuoteTotal(quote))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {renderActionButtons(quote)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filteredQuotes.length)} / {filteredQuotes.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  &laquo;
                </button>
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title={t.common.confirm}
        message={t.quotes.deleteConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Restore Confirmation */}
      <ConfirmModal
        isOpen={restoreConfirm !== null}
        onClose={() => setRestoreConfirm(null)}
        onConfirm={() => restoreConfirm && handleRestore(restoreConfirm)}
        title={t.common.confirm}
        message={t.quotes.restoreConfirm}
        confirmText={t.quotes.restoreQuote}
        cancelText={t.common.cancel}
        variant="primary"
      />
    </div>
  );
}

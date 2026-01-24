import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useQuotes, usePatients } from '../hooks';
import { Quote, QuoteStatus } from '../types';
import {
  Button,
  Card,
  CardContent,
  SearchInput,
  EmptyState,
  EmptySearchIcon,
  ConfirmModal,
} from '../components/common';
import { formatDate, formatCurrency, calculateQuoteTotals } from '../utils';

type FilterTab = 'all' | 'draft' | 'in_progress' | 'completed';

export function QuotesPage() {
  const { t, settings } = useSettings();
  const navigate = useNavigate();
  const {
    quotes,
    draftQuotes,
    inProgressQuotes,
    completedQuotes,
    deleteQuote,
    closeQuote,
    acceptQuote,
    rejectQuote,
    revokeAcceptance,
    revokeRejection,
    startTreatment,
    revokeStart,
    completeTreatment,
    reopenTreatment,
  } = useQuotes();
  const { getPatient } = usePatients();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredQuotes = useMemo(() => {
    let result = quotes;

    // Filter by tab
    if (filterTab === 'draft') {
      result = draftQuotes;
    } else if (filterTab === 'in_progress') {
      result = inProgressQuotes;
    } else if (filterTab === 'completed') {
      result = completedQuotes;
    }

    // Filter by search query
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

    // Sort by date, newest first
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [quotes, draftQuotes, inProgressQuotes, completedQuotes, filterTab, searchQuery, getPatient, settings.doctors]);

  const getStatusLabel = (status: QuoteStatus): string => {
    const labels: Record<QuoteStatus, string> = {
      draft: t.quotes.statusDraft,
      closed_pending: t.quotes.statusClosedPending,
      accepted_in_progress: t.quotes.statusAcceptedInProgress,
      rejected: t.quotes.statusRejected,
      started: t.quotes.statusStarted,
      completed: t.quotes.statusCompleted,
    };
    return labels[status];
  };

  const getStatusBadgeStyle = (status: QuoteStatus): string => {
    const styles: Record<QuoteStatus, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      closed_pending: 'bg-blue-100 text-blue-800',
      accepted_in_progress: 'bg-indigo-100 text-indigo-800',
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

  const getQuoteTotal = (quote: Quote) => {
    const totals = calculateQuoteTotals(quote);
    return totals.total;
  };

  const getPatientName = (patientId: string) => {
    const patient = getPatient(patientId);
    return patient ? `${patient.lastName} ${patient.firstName}` : '-';
  };

  const getDoctorName = (doctorId: string) => {
    const doctor = settings.doctors.find((d) => d.id === doctorId);
    return doctor?.name || '-';
  };

  const renderActionButtons = (quote: Quote) => {
    const status = quote.quoteStatus;

    switch (status) {
      case 'draft':
        return (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/patients/${quote.patientId}/quotes/${quote.quoteId}`)}
            >
              {t.common.edit}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => closeQuote(quote.quoteId)}
              className="border-2 border-blue-500"
            >
              {t.quotes.close}
            </Button>
          </>
        );

      case 'closed_pending':
        return (
          <>
            <Button
              variant="success"
              size="sm"
              onClick={() => acceptQuote(quote.quoteId)}
              className="border-2 border-green-500 whitespace-pre-line text-center"
            >
              {t.quotes.accept}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => rejectQuote(quote.quoteId)}
              className="border-2 border-red-500 whitespace-pre-line text-center"
            >
              {t.quotes.reject}
            </Button>
          </>
        );

      case 'accepted_in_progress':
        return (
          <>
            <Button
              variant="success"
              size="sm"
              onClick={() => startTreatment(quote.quoteId)}
              className="border-2 border-green-500 whitespace-pre-line text-center"
            >
              {t.quotes.startTreatment}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => revokeAcceptance(quote.quoteId)}
              className="border-2 border-red-500 whitespace-pre-line text-center"
            >
              {t.quotes.revokeAcceptance}
            </Button>
          </>
        );

      case 'rejected':
        return (
          <Button
            variant="danger"
            size="sm"
            onClick={() => revokeRejection(quote.quoteId)}
            className="border-2 border-red-500 whitespace-pre-line text-center"
          >
            {t.quotes.revokeRejection}
          </Button>
        );

      case 'started':
        return (
          <>
            <Button
              variant="success"
              size="sm"
              onClick={() => completeTreatment(quote.quoteId)}
              className="border-2 border-green-500 whitespace-pre-line text-center"
            >
              {t.quotes.completeTreatment}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => revokeStart(quote.quoteId)}
              className="border-2 border-red-500 whitespace-pre-line text-center"
            >
              {t.quotes.revokeStart}
            </Button>
          </>
        );

      case 'completed':
        return (
          <Button
            variant="danger"
            size="sm"
            onClick={() => reopenTreatment(quote.quoteId)}
            className="border-2 border-red-500 whitespace-pre-line text-center"
          >
            {t.quotes.reopenTreatment}
          </Button>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.quotes.title}</h1>
          <p className="text-gray-500 mt-1">
            {draftQuotes.length} {t.quotes.filterDraft}, {inProgressQuotes.length} {t.quotes.filterInProgress},{' '}
            {completedQuotes.length} {t.quotes.filterCompleted}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t.common.search}
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterTab === 'all'
                ? 'bg-dental-100 text-dental-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.quotes.filterAll}
          </button>
          <button
            onClick={() => setFilterTab('draft')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterTab === 'draft'
                ? 'bg-dental-100 text-dental-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.quotes.filterDraft}
          </button>
          <button
            onClick={() => setFilterTab('in_progress')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterTab === 'in_progress'
                ? 'bg-dental-100 text-dental-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.quotes.filterInProgress}
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterTab === 'completed'
                ? 'bg-dental-100 text-dental-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.quotes.filterCompleted}
          </button>
        </div>
      </div>

      {filteredQuotes.length === 0 ? (
        <Card>
          <CardContent>
            {searchQuery || filterTab !== 'all' ? (
              <EmptyState
                icon={<EmptySearchIcon />}
                title={t.common.noResults}
                description="Nincs a keresésnek megfelelő árajánlat"
              />
            ) : (
              <EmptyState
                icon={
                  <svg
                    className="w-12 h-12 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
                title={t.quotes.noQuotes}
                description="Az árajánlatok a páciens adatlapján hozhatók létre"
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.quotes.quoteName}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.quotes.patient}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.quotes.doctor}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.quotes.status}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.quotes.createdAt}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.quotes.modifiedAt}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.quotes.validUntil}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.quotes.total}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredQuotes.map((quote) => (
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
                      <Link
                        to={`/patients/${quote.patientId}`}
                        className="hover:text-dental-600"
                      >
                        {getPatientName(quote.patientId)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {getDoctorName(quote.doctorId)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/patients/${quote.patientId}/quotes/${quote.quoteId}`)}
                        className={`px-2 py-1 rounded-full text-xs font-medium whitespace-pre-line text-center cursor-pointer hover:opacity-80 ${getStatusBadgeStyle(quote.quoteStatus)}`}
                      >
                        {getStatusLabel(quote.quoteStatus)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(quote.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(quote.lastStatusChangeAt)}
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
    </div>
  );
}

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { usePatients, useQuotes } from '../hooks';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Badge,
  EmptyState,
  EmptyQuoteIcon,
  ConfirmModal,
} from '../components/common';
import { formatDate, formatCurrency, formatPatientName, formatQuoteId } from '../utils';
import { calculateQuoteTotals } from '../utils/calculations';
import { useState } from 'react';

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useSettings();
  const { getPatient, duplicatePatient, archivePatient, deletePatient } = usePatients();
  const { getQuotesByPatient, createQuote, deleteQuote, duplicateQuote } = useQuotes();

  const [deleteQuoteConfirm, setDeleteQuoteConfirm] = useState<string | null>(null);
  const [deletePatientConfirm, setDeletePatientConfirm] = useState(false);

  const patient = patientId ? getPatient(patientId) : undefined;
  const quotes = patientId ? getQuotesByPatient(patientId) : [];

  if (!patient) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Páciens nem található</h2>
        <Link to="/patients" className="text-dental-600 hover:text-dental-700 mt-4 inline-block">
          Vissza a páciensekhez
        </Link>
      </div>
    );
  }

  const handleNewQuote = () => {
    const quote = createQuote(patient.patientId);
    navigate(`/patients/${patient.patientId}/quotes/${quote.quoteId}`);
  };

  const handleDuplicatePatient = () => {
    const dup = duplicatePatient(patient.patientId);
    if (dup) {
      navigate(`/patients/${dup.patientId}`);
    }
  };

  const handleArchivePatient = () => {
    archivePatient(patient.patientId);
    navigate('/patients');
  };

  const handleDeletePatient = () => {
    deletePatient(patient.patientId);
    navigate('/patients');
  };

  const handleDuplicateQuote = (quoteId: string) => {
    const dup = duplicateQuote(quoteId);
    if (dup) {
      navigate(`/patients/${patient.patientId}/quotes/${dup.quoteId}`);
    }
  };

  const handleDeleteQuote = (quoteId: string) => {
    deleteQuote(quoteId);
    setDeleteQuoteConfirm(null);
  };

  const activeQuotes = quotes.filter((q) => !q.isDeleted);
  const sortedQuotes = [...activeQuotes].sort(
    (a, b) => new Date(b.lastStatusChangeAt).getTime() - new Date(a.lastStatusChangeAt).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/patients" className="hover:text-dental-600">
              {t.patients.title}
            </Link>
            <span>/</span>
            <span>{formatPatientName(patient.lastName, patient.firstName)}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {formatPatientName(patient.lastName, patient.firstName)}
          </h1>
          {patient.isArchived && (
            <Badge variant="warning" size="sm">
              {t.common.archived}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleDuplicatePatient}>
            {t.common.duplicate}
          </Button>
          {!patient.isArchived && (
            <Button variant="secondary" onClick={handleArchivePatient}>
              {t.common.archive}
            </Button>
          )}
          <Button variant="danger" onClick={() => setDeletePatientConfirm(true)}>
            {t.common.delete}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Info */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">{t.patients.patientDetails}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">{t.patients.birthDate}</label>
              <p className="font-medium">{formatDate(patient.birthDate, 'long')}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">{t.patients.sex}</label>
              <p className="font-medium">{t.patients[patient.sex]}</p>
            </div>
            {patient.insuranceNum && (
              <div>
                <label className="text-sm text-gray-500">{t.patients.insuranceNum}</label>
                <p className="font-medium">{patient.insuranceNum}</p>
              </div>
            )}
            {patient.phone && (
              <div>
                <label className="text-sm text-gray-500">{t.patients.phone}</label>
                <p className="font-medium">{patient.phone}</p>
              </div>
            )}
            {patient.email && (
              <div>
                <label className="text-sm text-gray-500">{t.patients.email}</label>
                <p className="font-medium">{patient.email}</p>
              </div>
            )}
            {(patient.zipCode || patient.city || patient.street) && (
              <div>
                <label className="text-sm text-gray-500">Lakcím</label>
                <p className="font-medium">
                  {[patient.zipCode, patient.city].filter(Boolean).join(' ')}
                  {(patient.zipCode || patient.city) && patient.street ? ', ' : ''}
                  {patient.street}
                </p>
              </div>
            )}
            {patient.notes && (
              <div>
                <label className="text-sm text-gray-500">{t.patients.notes}</label>
                <p className="text-gray-700 whitespace-pre-wrap">{patient.notes}</p>
              </div>
            )}
            <div className="pt-4 border-t text-sm text-gray-500">
              <p>
                {t.patients.createdAt}: {formatDate(patient.createdAt)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quotes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.quotes.title}</h2>
            <Button onClick={handleNewQuote}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t.quotes.newQuote}
            </Button>
          </div>

          {sortedQuotes.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<EmptyQuoteIcon />}
                  title={t.quotes.noQuotes}
                  description="Készítsen új árajánlatot a páciensnek"
                  actionLabel={t.quotes.newQuote}
                  onAction={handleNewQuote}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedQuotes.map((quote) => {
                const totals = calculateQuoteTotals(quote);
                return (
                  <Card key={quote.quoteId} hoverable>
                    <CardContent className="flex items-center justify-between">
                      <Link
                        to={`/patients/${patient.patientId}/quotes/${quote.quoteId}`}
                        className="flex-1"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {formatQuoteId(quote.quoteId)}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              <span>{formatDate(quote.createdAt)}</span>
                              <Badge
                                variant={
                                  quote.quoteStatus === 'draft'
                                    ? 'warning'
                                    : quote.quoteStatus === 'completed'
                                    ? 'default'
                                    : quote.quoteStatus === 'rejected'
                                    ? 'danger'
                                    : 'success'
                                }
                                size="sm"
                              >
                                {quote.quoteStatus === 'draft' ? t.quotes.statusDraft :
                                 quote.quoteStatus === 'closed_pending' ? t.quotes.statusClosedPending :
                                 quote.quoteStatus === 'accepted_in_progress' ? t.quotes.statusAcceptedInProgress :
                                 quote.quoteStatus === 'rejected' ? t.quotes.statusRejected :
                                 quote.quoteStatus === 'started' ? t.quotes.statusStarted :
                                 t.quotes.statusCompleted}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(totals.total)}
                          </p>
                          <p className="text-sm text-gray-500">{quote.items.length} tétel</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDuplicateQuote(quote.quoteId);
                            }}
                          >
                            {t.common.duplicate}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setDeleteQuoteConfirm(quote.quoteId);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {t.common.delete}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Quote Confirmation */}
      <ConfirmModal
        isOpen={deleteQuoteConfirm !== null}
        onClose={() => setDeleteQuoteConfirm(null)}
        onConfirm={() => deleteQuoteConfirm && handleDeleteQuote(deleteQuoteConfirm)}
        title={t.common.confirm}
        message={t.quotes.deleteConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Delete Patient Confirmation */}
      <ConfirmModal
        isOpen={deletePatientConfirm}
        onClose={() => setDeletePatientConfirm(false)}
        onConfirm={handleDeletePatient}
        title={t.common.confirm}
        message={t.patients.deleteConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />
    </div>
  );
}

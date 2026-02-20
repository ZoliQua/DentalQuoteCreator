import { useParams, Link, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
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
  Modal,
  Input,
  Select,
  TextArea,
} from '../components/common';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatPatientName,
  formatQuoteId,
  formatInsuranceNum,
  getTajValidationState,
  formatBirthDateForDisplay,
  parseBirthDateFromDisplay,
  getDatePlaceholder,
} from '../utils';
import { postalCodes } from '../data/postalCodes';
import { calculateQuoteTotals } from '../utils/calculations';
import { useEffect, useMemo, useRef, useState } from 'react';
import iconFemale from '../assets/icon-svgs/symbol-female.svg';
import iconMale from '../assets/icon-svgs/symbol-male.svg';
import { OdontogramHost, OdontogramHostHandle } from '../modules/odontogram/OdontogramHost';
import { getInvoicesByPatient, saveInvoice } from '../modules/invoicing/storage';
import { stornoInvoice } from '../modules/invoicing/api';
import type { InvoiceRecord } from '../types/invoice';
import { getChecksByPatient } from '../modules/neak/storage';
import type { JogviszonyCode } from '../modules/neak/types';
import {
  loadCurrent,
} from '../modules/odontogram/odontogramStorage';
import {
  applyTimelineSnapshotAsCurrent,
  createTimelineSnapshot,
  deleteTimelineSnapshot,
  duplicateLatestSnapshot,
  ensureTimelineInitialized,
  listTimelineEntries,
  loadTimelineSnapshot,
  updateTimelineSnapshot,
} from '../modules/odontogram/odontogramTimelineStorage';
import type { OdontogramState, OdontogramTimelineEntry } from '../modules/odontogram/types';
import type { Patient, PatientFormData } from '../types';
import { NeakCheckModal } from '../modules/neak/NeakCheckModal';
import { checkJogviszony, saveCheck } from '../modules/neak';

type TimelineEditorModalProps = {
  isOpen: boolean;
  patientId: string;
  snapshotState: OdontogramState | null;
  onClose: () => void;
  onSave: (state: OdontogramState) => Promise<void>;
};

function TimelineEditorModal({
  isOpen,
  patientId,
  snapshotState,
  onClose,
  onSave,
}: TimelineEditorModalProps) {
  const { t } = useSettings();
  const hostRef = useRef<OdontogramHostHandle | null>(null);
  const [draftState, setDraftState] = useState<OdontogramState | null>(snapshotState);

  useEffect(() => {
    setDraftState(snapshotState);
  }, [snapshotState]);

  const handleSave = async () => {
    const exported = await hostRef.current?.exportState();
    const next = exported ?? draftState;
    if (!next) return;
    await onSave(next);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.patients.statusTimelineEditorTitle}
      size="full"
    >
      <div className="space-y-4">
        <OdontogramHost
          ref={hostRef}
          patientId={patientId}
          mode="edit"
          initialState={draftState}
          onChange={setDraftState}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave}>{t.common.save}</Button>
        </div>
      </div>
    </Modal>
  );
}

function TimelineActionButtons({
  onEdit,
  onDelete,
  editTitle,
  deleteTitle,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editTitle: string;
  deleteTitle: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="rounded-md border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
        title={editTitle}
        aria-label={editTitle}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 3.5a2.121 2.121 0 013 3L8 18l-4 1 1-4 11.5-11.5z" />
        </svg>
      </button>
      <button
        type="button"
        className="rounded-md border border-gray-200 p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        title={deleteTitle}
        aria-label={deleteTitle}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-1 13H6L5 7" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6M14 11v6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7V4h6v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

function TimelinePlusButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded-md border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useSettings();
  const { hasPermission, user } = useAuth();
  const hostRef = useRef<OdontogramHostHandle | null>(null);
  const { getPatient, editPatient, duplicatePatient, archivePatient, deletePatient } = usePatients();
  const { getQuotesByPatient, createQuote, deleteQuote, duplicateQuote, addEventToQuote, getQuote, reopenTreatment } = useQuotes();
  const [deleteQuoteConfirm, setDeleteQuoteConfirm] = useState<string | null>(null);
  const [deletePatientConfirm, setDeletePatientConfirm] = useState(false);
  const [duplicatePatientConfirm, setDuplicatePatientConfirm] = useState(false);
  const [editPatientModalOpen, setEditPatientModalOpen] = useState(false);
  const [initialOdontogramState, setInitialOdontogramState] = useState<OdontogramState | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<OdontogramTimelineEntry[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingSnapshotState, setEditingSnapshotState] = useState<OdontogramState | null>(null);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [pendingDeleteSnapshotId, setPendingDeleteSnapshotId] = useState<string | null>(null);
  const [neakModalOpen, setNeakModalOpen] = useState(false);
  const [stornoConfirmInvoiceId, setStornoConfirmInvoiceId] = useState<string | null>(null);
  const [stornoLoading, setStornoLoading] = useState(false);
  const [stornoError, setStornoError] = useState<string | null>(null);
  const [quoteTypeModalOpen, setQuoteTypeModalOpen] = useState(false);

  const patient = patientId ? getPatient(patientId) : undefined;
  const quotes = patientId ? getQuotesByPatient(patientId) : [];

  if (!patient) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">{t.patients.notFound}</h2>
        <Link to="/patients" className="text-dental-600 hover:text-dental-700 mt-4 inline-block">
          {t.patients.backToPatients}
        </Link>
      </div>
    );
  }

  const handleNewQuote = () => {
    setQuoteTypeModalOpen(true);
  };

  const handleCreateItemizedQuote = async () => {
    const quote = await createQuote(patient.patientId, undefined, 'itemized');
    setQuoteTypeModalOpen(false);
    navigate(`/patients/${patient.patientId}/quotes/${quote.quoteId}`);
  };

  const handleCreateVisualQuote = async () => {
    const quote = await createQuote(patient.patientId, undefined, 'visual');
    setQuoteTypeModalOpen(false);
    navigate(`/patients/${patient.patientId}/visual-quotes/${quote.quoteId}`);
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

  const handleEditPatient = (data: PatientFormData) => {
    editPatient(patient.patientId, data);
    setEditPatientModalOpen(false);
  };

  const handleDuplicateQuote = async (quoteId: string) => {
    const original = quotes.find((q) => q.quoteId === quoteId);
    const dup = await duplicateQuote(quoteId);
    if (dup) {
      navigate(
        original?.quoteType === 'visual'
          ? `/patients/${patient.patientId}/visual-quotes/${dup.quoteId}`
          : `/patients/${patient.patientId}/quotes/${dup.quoteId}`
      );
    }
  };

  const handleDeleteQuote = (quoteId: string) => {
    deleteQuote(quoteId);
    setDeleteQuoteConfirm(null);
  };

  const activeQuotes = quotes.filter((q) => !q.isDeleted);
  const [patientInvoices, setPatientInvoices] = useState(() => getInvoicesByPatient(patient.patientId));
  const refreshPatientInvoices = () => setPatientInvoices(getInvoicesByPatient(patient.patientId));
  useEffect(() => { refreshPatientInvoices(); }, [patient.patientId]);

  const openInvoicePdf = (base64?: string) => {
    if (!base64) return;
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/pdf' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  const handleStorno = async (invoice: InvoiceRecord) => {
    if (!invoice.szamlazzInvoiceNumber) return;
    setStornoLoading(true);
    setStornoError(null);
    try {
      const response = await stornoInvoice(invoice.szamlazzInvoiceNumber);
      if (response.mode === 'live' && !response.success) {
        throw new Error(response.message || t.invoices.errorGeneric);
      }
      const updated: InvoiceRecord = {
        ...invoice,
        status: 'storno',
        stornoInvoiceNumber: response.invoiceNumber || undefined,
        stornoPdfBase64: response.pdfBase64 || undefined,
      };
      saveInvoice(updated);
      refreshPatientInvoices();
      setStornoConfirmInvoiceId(null);
      // Add storno event to quote event log
      if (invoice.quoteId) {
        addEventToQuote(invoice.quoteId, {
          type: 'invoice_storno',
          doctorName: user?.fullName || '',
          invoiceId: invoice.id,
          invoiceAmount: invoice.totalGross || 0,
          invoiceCurrency: invoice.currency,
          stornoInvoiceNumber: response.invoiceNumber || undefined,
          originalInvoiceNumber: invoice.szamlazzInvoiceNumber || undefined,
        });
        // Revert completed quote back to started
        const q = getQuote(invoice.quoteId);
        if (q?.quoteStatus === 'completed') {
          reopenTreatment(invoice.quoteId);
        }
      }
      // Auto-open storno PDF
      if (response.pdfBase64) {
        openInvoicePdf(response.pdfBase64);
      }
    } catch (error) {
      setStornoError(error instanceof Error ? error.message : t.invoices.errorGeneric);
    } finally {
      setStornoLoading(false);
    }
  };

  const neakChecks = useMemo(() => {
    if (!patient.patientType?.toLowerCase().includes('neak')) return [];
    return getChecksByPatient(patient.patientId);
  }, [patient.patientId, patient.patientType]);
  const sortedQuotes = [...activeQuotes].sort(
    (a, b) => new Date(b.lastStatusChangeAt).getTime() - new Date(a.lastStatusChangeAt).getTime()
  );

  const refreshTimeline = (targetPatientId: string) => {
    const entries = listTimelineEntries(targetPatientId);
    setTimelineEntries(entries);
    return entries;
  };

  const loadSnapshotForView = async (snapshotId: string) => {
    if (!patient?.patientId) return;
    const applied = applyTimelineSnapshotAsCurrent(patient.patientId, snapshotId);
    if (!applied?.state) return;
    setInitialOdontogramState(applied.state);
    setActiveSnapshotId(snapshotId);
    await hostRef.current?.importState(applied.state);
    await hostRef.current?.syncViewMode();
  };

  const handleAddTimelineStatus = async () => {
    if (!patient?.patientId) return;
    const exported = await hostRef.current?.exportState();
    const created = duplicateLatestSnapshot(patient.patientId, exported ?? initialOdontogramState);
    if (!created) {
      if (exported) {
        const entry = createTimelineSnapshot(patient.patientId, exported);
        refreshTimeline(patient.patientId);
        await loadSnapshotForView(entry.snapshotId);
      }
      return;
    }
    refreshTimeline(patient.patientId);
    await loadSnapshotForView(created.snapshotId);
  };

  const handleOpenEditSnapshot = (snapshotId: string) => {
    if (!patient?.patientId) return;
    const snapshot = loadTimelineSnapshot(patient.patientId, snapshotId);
    if (!snapshot?.state) return;
    setEditingSnapshotId(snapshotId);
    setEditingSnapshotState(snapshot.state);
    setEditorOpen(true);
  };

  const handleSaveEditedSnapshot = async (state: OdontogramState) => {
    if (!patient?.patientId || !editingSnapshotId) return;
    const updated = updateTimelineSnapshot(patient.patientId, editingSnapshotId, state);
    if (!updated) return;
    refreshTimeline(patient.patientId);
    setEditorOpen(false);
    setEditingSnapshotId(null);
    setEditingSnapshotState(null);
    await loadSnapshotForView(updated.snapshotId);
  };

  const handleDeleteTimelineSnapshot = async (snapshotId: string) => {
    if (!patient?.patientId) return;
    const success = deleteTimelineSnapshot(patient.patientId, snapshotId);
    if (!success) return;
    const entries = refreshTimeline(patient.patientId);
    if (activeSnapshotId === snapshotId) {
      const next = entries[0];
      if (next?.snapshotId) {
        await loadSnapshotForView(next.snapshotId);
      } else {
        setActiveSnapshotId(null);
      }
    }
  };

  useEffect(() => {
    if (!patient?.patientId) return;
    const entries = ensureTimelineInitialized(patient.patientId);
    setTimelineEntries(entries);
    const latest = entries[0];
    if (latest?.snapshotId) {
      const latestSnapshot = loadTimelineSnapshot(patient.patientId, latest.snapshotId);
      if (latestSnapshot?.state) {
        setInitialOdontogramState(latestSnapshot.state);
        setActiveSnapshotId(latest.snapshotId);
        return;
      }
    }
    const stored = loadCurrent(patient.patientId);
    setInitialOdontogramState(stored?.state ?? null);
  }, [patient?.patientId]);

  useEffect(() => {
    if (!initialOdontogramState) return;
    const frame = window.requestAnimationFrame(() => {
      hostRef.current?.syncViewMode();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialOdontogramState]);

  const timelineRows = useMemo(() => {
    return timelineEntries.map((entry) => ({
      ...entry,
      formatted: formatDateTime(entry.updatedAt),
    }));
  }, [timelineEntries]);

  const patientAge = useMemo(() => {
    if (!patient?.birthDate) return null;
    const birth = new Date(patient.birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    const dayDiff = now.getDate() - birth.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }
    return age < 0 ? null : age;
  }, [patient?.birthDate]);

  return (
    <div id="patientDetailPage" className="space-y-6">
      <div id="patientHeader" className="flex items-start justify-between">
        <div id="patientTitleBlock">
          <div id="patientBreadcrumb" className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/patients" className="hover:text-dental-600">
              {t.patients.title}
            </Link>
            <span>/</span>
            <span>{formatPatientName(patient.lastName, patient.firstName, patient.title)}</span>
          </div>
          <h1 id="patientNameDisplay" className="text-2xl font-bold text-gray-900">
            {formatPatientName(patient.lastName, patient.firstName, patient.title)}
            {patientAge !== null && (
              <span className="ml-2 align-middle text-base font-medium text-gray-500">
                ({patientAge}
                {(patient.sex === 'male' || patient.sex === 'female') && (
                  <img
                    src={patient.sex === 'male' ? iconMale : iconFemale}
                    alt={t.patients[patient.sex]}
                    className="ml-1 inline-block h-4 w-4 align-middle"
                  />
                )}
                )
              </span>
            )}
          </h1>
          {patient.isArchived && (
            <div id="patientArchivedBadge">
              <Badge variant="warning" size="sm">
                {t.common.archived}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {!editorOpen && (
        <div id="patientOdontogramSection">
          <OdontogramHost
            ref={hostRef}
            patientId={patient.patientId}
            mode="view"
            initialState={initialOdontogramState}
            onChange={() => {}}
            panelContent={
              <div className="rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <span className="text-sm font-semibold text-gray-900">{t.patients.statusTimeline}</span>
                  <TimelinePlusButton
                    onClick={handleAddTimelineStatus}
                    title={t.patients.statusTimelineAdd}
                  />
                </div>
                <div className="space-y-2 px-4 py-3">
                  {timelineRows.length === 0 ? (
                    <p className="text-sm text-gray-500">{t.patients.noStatusHistory}</p>
                  ) : (
                    timelineRows.map((entry) => (
                      <div
                        key={entry.snapshotId}
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 ${
                          activeSnapshotId === entry.snapshotId
                            ? 'border-dental-300 bg-dental-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                        onClick={() => loadSnapshotForView(entry.snapshotId)}
                      >
                        <span className="text-sm text-gray-700">{entry.formatted}</span>
                        <TimelineActionButtons
                          onEdit={() => handleOpenEditSnapshot(entry.snapshotId)}
                          onDelete={() => setPendingDeleteSnapshotId(entry.snapshotId)}
                          editTitle={t.patients.statusTimelineEdit}
                          deleteTitle={t.common.delete}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            }
          />
        </div>
      )}

      <div id="patientContentGrid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="patientDataCard">
          <Card>
            <div id="patientDataCardHeader">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t.patients.patientDetails}</h2>
                  {hasPermission('patients.update') && (
                  <Button id="patientEditBtn" variant="secondary" size="sm"
                          onClick={() => setEditPatientModalOpen(true)}>
                    {t.common.edit}
                  </Button>
                  )}
                </div>
              </CardHeader>
            </div>
            <div id="patientDataCardContent">
              <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">{t.patients.birthDate}</label>
              <p className="font-medium">{formatDate(patient.birthDate, 'long')}</p>
            </div>
            {patient.birthPlace && (
              <div>
                <label className="text-sm text-gray-500">{t.patients.birthPlace}</label>
                <p className="font-medium">{patient.birthPlace}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-500">{t.patients.sex}</label>
              <p className="font-medium">{t.patients[patient.sex]}</p>
            </div>
            {patient.insuranceNum && (
              <div>
                <label className="text-sm text-gray-500">{t.patients.insuranceNum}</label>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{patient.insuranceNum}</p>
                  {patient.patientType?.toLowerCase().includes('neak') && (
                    <button
                      type="button"
                      onClick={() => setNeakModalOpen(true)}
                      className="rounded-md border border-gray-200 p-1.5 text-dental-600 hover:bg-dental-50 hover:text-dental-700 transition-colors"
                      title={t.neak.checkButton}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                    </button>
                  )}
                </div>
                {neakChecks.length > 0 && neakChecks[0].result.tranKod && (
                  <p className="text-xs text-gray-400 mt-1">
                    {t.neak.transactionCode}: <span className="font-mono">{neakChecks[0].result.tranKod}</span>
                  </p>
                )}
              </div>
            )}
            {(patient.zipCode || patient.city || patient.street) && (
              <div>
                <label className="text-sm text-gray-500">{t.patients.addressSection}</label>
                <p className="font-medium">
                  {patient.country && patient.isForeignAddress ? `${patient.country}, ` : ''}
                  {[patient.zipCode, patient.city].filter(Boolean).join(' ')}
                  {(patient.zipCode || patient.city) && patient.street ? ', ' : ''}
                  {patient.street}
                </p>
                {patient.isForeignAddress && (
                  <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {t.patients.foreignAddress}
                  </span>
                )}
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
            {patient.patientType && (
              <div>
                <label className="text-sm text-gray-500">{t.patients.patientType}</label>
                <p className="font-medium">{patient.patientType}</p>
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
            </div>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <h2 className="text-lg font-semibold">{t.patients.dataSheetActions}</h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {hasPermission('patients.update') && (
              <Button id="patientDuplicateBtn" variant="secondary" className="w-full justify-center"
                      onClick={() => setDuplicatePatientConfirm(true)}>
                {t.patients.duplicateDataSheet}
              </Button>
              )}
              {hasPermission('patients.update') && !patient.isArchived && (
                <Button id="patientArchiveBtn" variant="secondary" className="w-full justify-center"
                        onClick={handleArchivePatient}>
                  {t.common.archive}
                </Button>
              )}
              {hasPermission('patients.delete') && (
              <Button id="patientDeleteBtn" variant="danger" className="w-full justify-center"
                      onClick={() => setDeletePatientConfirm(true)}>
                {t.common.delete}
              </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div id="patientQuotesSection" className="lg:col-span-2 space-y-4">
          <div id="patientQuotesHeader" className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.quotes.title}</h2>
            <Button id="patientNewQuoteBtn" onClick={handleNewQuote} disabled={!hasPermission('quotes.create')}>
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
                  description={t.patients.createQuotePrompt}
                  actionLabel={hasPermission('quotes.create') ? t.quotes.newQuote : undefined}
                  onAction={hasPermission('quotes.create') ? handleNewQuote : undefined}
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
                        to={quote.quoteType === 'visual'
                          ? `/patients/${patient.patientId}/visual-quotes/${quote.quoteId}`
                          : `/patients/${patient.patientId}/quotes/${quote.quoteId}`}
                        className="flex-1"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">{quote.quoteName}</h3>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
                                {quote.quoteNumber || formatQuoteId(quote.quoteId)}
                              </span>
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
                                {quote.quoteStatus === 'draft'
                                  ? t.quotes.statusDraft
                                  : quote.quoteStatus === 'closed'
                                    ? t.quotes.statusClosed
                                    : quote.quoteStatus === 'rejected'
                                      ? t.quotes.statusRejected
                                      : quote.quoteStatus === 'started'
                                        ? t.quotes.statusStarted
                                        : t.quotes.statusCompleted}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(totals.total)}</p>
                          <p className="text-sm text-gray-500">
                            {t.quotes.itemsCount.replace('{count}', String(quote.items.length))}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.preventDefault();
                              handleDuplicateQuote(quote.quoteId);
                            }}
                          >
                            {t.common.duplicate}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.preventDefault();
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

          <h2 className="text-lg font-semibold mt-6">{t.invoices.issuedInvoices}</h2>

          {patientInvoices.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-gray-500">{t.patients.noInvoicesForPatient}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {stornoError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {stornoError}
                </div>
              )}
              {patientInvoices.map((invoice) => (
                <Card key={invoice.id} hoverable>
                  <CardContent className="flex items-center justify-between">
                    <Link to={`/invoices/${invoice.id}`} className="flex-1">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {invoice.szamlazzInvoiceNumber || t.invoices.preview}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>{formatDateTime(invoice.createdAt)}</span>
                          <Badge
                            variant={
                              invoice.status === 'sent' ? 'success' :
                              invoice.status === 'storno' ? 'danger' : 'warning'
                            }
                            size="sm"
                          >
                            {invoice.status === 'sent' ? t.invoices.statusSent :
                             invoice.status === 'draft' ? t.invoices.statusDraft :
                             invoice.status === 'storno' ? t.invoices.statusStorno :
                             invoice.status}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-semibold ${invoice.status === 'storno' ? 'text-red-600' : 'text-gray-900'}`}>
                          {invoice.status === 'storno' ? `-${formatCurrency(invoice.totalGross, invoice.currency)}` : formatCurrency(invoice.totalGross, invoice.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {invoice.pdfBase64 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.preventDefault(); openInvoicePdf(invoice.pdfBase64); }}
                          >
                            {t.invoices.pdf}
                          </Button>
                        )}
                        {invoice.status === 'sent' && invoice.szamlazzInvoiceNumber && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.preventDefault(); setStornoConfirmInvoiceId(invoice.id); }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {t.invoices.storno}
                          </Button>
                        )}
                        {invoice.stornoPdfBase64 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.preventDefault(); openInvoicePdf(invoice.stornoPdfBase64); }}
                          >
                            {t.invoices.stornoNumber}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {patient.patientType?.toLowerCase().includes('neak') && (
            <>
              <h2 className="text-lg font-semibold mt-6">{t.neak.neakData}</h2>
              {neakChecks.length === 0 ? (
                <Card>
                  <CardContent>
                    <p className="text-sm text-gray-500">{t.neak.noHistory}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {neakChecks.map((entry) => {
                    const code = entry.result.jogviszony as JogviszonyCode | undefined;
                    const badgeMap: Record<string, { label: string; color: string }> = {
                      Z: { label: t.neak.resultZ, color: 'bg-green-100 text-green-800' },
                      P: { label: t.neak.resultP, color: 'bg-yellow-100 text-yellow-800' },
                      K: { label: t.neak.resultK, color: 'bg-blue-100 text-blue-800' },
                      N: { label: t.neak.resultN, color: 'bg-red-100 text-red-800' },
                      B: { label: t.neak.resultB, color: 'bg-red-100 text-red-800' },
                      S: { label: t.neak.resultS, color: 'bg-yellow-100 text-yellow-800' },
                    };
                    const badge = code ? badgeMap[code] : null;
                    return (
                      <Card key={entry.id}>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-500">
                                {formatDateTime(entry.checkedAt)}
                              </p>
                              <p className="text-xs text-gray-400">TAJ: {formatInsuranceNum(entry.taj)}</p>
                            </div>
                            <div>
                              {badge ? (
                                <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${badge.color}`}>
                                  {badge.label}
                                </span>
                              ) : (
                                <span className="text-xs text-red-500">
                                  {entry.result.message || entry.result.hibaSzoveg || t.neak.errorGeneric}
                                </span>
                              )}
                            </div>
                          </div>
                          {entry.result.tranKod && (
                            <p className="text-xs text-gray-400 mt-1 font-mono">{t.neak.transactionCode}: {entry.result.tranKod}</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <TimelineEditorModal
        isOpen={editorOpen}
        patientId={patient.patientId}
        snapshotState={editingSnapshotState}
        onClose={() => {
          setEditorOpen(false);
          setEditingSnapshotId(null);
          setEditingSnapshotState(null);
        }}
        onSave={handleSaveEditedSnapshot}
      />

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

      <ConfirmModal
        isOpen={duplicatePatientConfirm}
        onClose={() => setDuplicatePatientConfirm(false)}
        onConfirm={() => { setDuplicatePatientConfirm(false); handleDuplicatePatient(); }}
        title={t.common.confirm}
        message={t.patients.duplicateConfirm}
        confirmText={t.patients.duplicateDataSheet}
        cancelText={t.common.cancel}
        variant="primary"
      />

      <ConfirmModal
        isOpen={pendingDeleteSnapshotId !== null}
        onClose={() => setPendingDeleteSnapshotId(null)}
        onConfirm={() => {
          if (pendingDeleteSnapshotId) {
            handleDeleteTimelineSnapshot(pendingDeleteSnapshotId);
          }
          setPendingDeleteSnapshotId(null);
        }}
        title={t.common.confirm}
        message={t.patients.statusTimelineDeleteConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />

      <ConfirmModal
        isOpen={stornoConfirmInvoiceId !== null}
        onClose={() => { setStornoConfirmInvoiceId(null); setStornoError(null); }}
        onConfirm={() => {
          const inv = patientInvoices.find((i) => i.id === stornoConfirmInvoiceId);
          if (inv) handleStorno(inv);
        }}
        title={t.invoices.storno}
        message={`${t.invoices.stornoConfirm}\n\n${t.invoices.stornoConfirmDetail}`}
        confirmText={stornoLoading ? t.invoices.stornoInProgress : t.invoices.storno}
        cancelText={t.common.cancel}
        variant="danger"
      />

      <PatientEditModal
        isOpen={editPatientModalOpen}
        patient={patient}
        onClose={() => setEditPatientModalOpen(false)}
        onSubmit={handleEditPatient}
      />

      {neakModalOpen && patient.insuranceNum && (
        <NeakCheckModal
          isOpen={neakModalOpen}
          onClose={() => setNeakModalOpen(false)}
          patientId={patient.patientId}
          taj={patient.insuranceNum}
          patientName={formatPatientName(patient.lastName, patient.firstName, patient.title)}
        />
      )}

      <Modal
        isOpen={quoteTypeModalOpen}
        onClose={() => setQuoteTypeModalOpen(false)}
        title={t.quotes.newQuoteTypeTitle}
        size="md"
      >
        <div className="space-y-3">
          <button
            type="button"
            className="w-full rounded-lg border border-gray-200 p-4 text-left hover:border-dental-400 hover:bg-dental-50 transition-colors"
            onClick={handleCreateItemizedQuote}
          >
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-dental-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900">{t.quotes.newQuoteItemized}</p>
                <p className="text-sm text-gray-500">{t.quotes.newQuoteItemizedDesc}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="w-full rounded-lg border border-gray-200 p-4 text-left hover:border-dental-400 hover:bg-dental-50 transition-colors"
            onClick={handleCreateVisualQuote}
          >
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-dental-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900">{t.quotes.newQuoteVisual}</p>
                <p className="text-sm text-gray-500">{t.quotes.newQuoteVisualDesc}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="w-full rounded-lg border border-gray-200 p-4 text-left opacity-50 cursor-not-allowed"
            disabled
          >
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-500">{t.quotes.newQuoteAutomatic}</p>
                  <Badge variant="default" size="sm">{t.common.comingSoon}</Badge>
                </div>
                <p className="text-sm text-gray-400">{t.quotes.newQuoteAutomaticDesc}</p>
              </div>
            </div>
          </button>
        </div>
      </Modal>
    </div>
  );
}

type PatientEditModalProps = {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
  onSubmit: (data: PatientFormData) => void;
};

function PatientEditModal({ isOpen, patient, onClose, onSubmit }: PatientEditModalProps) {
  const { t, settings } = useSettings();
  const [neakModalOpen, setNeakModalOpen] = useState(false);
  const [formData, setFormData] = useState<PatientFormData>({
    title: '',
    lastName: '',
    firstName: '',
    sex: 'male',
    birthDate: '',
    birthPlace: '',
    insuranceNum: '',
    phone: '',
    email: '',
    country: settings.patient.defaultCountry,
    isForeignAddress: false,
    zipCode: '',
    city: '',
    street: '',
    patientType: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [birthDateText, setBirthDateText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      title: patient.title || '',
      lastName: patient.lastName,
      firstName: patient.firstName,
      sex: patient.sex,
      birthDate: patient.birthDate,
      birthPlace: patient.birthPlace || '',
      insuranceNum: patient.insuranceNum || '',
      phone: patient.phone || '',
      email: patient.email || '',
      country: patient.country || settings.patient.defaultCountry,
      isForeignAddress: patient.isForeignAddress || false,
      zipCode: patient.zipCode || '',
      city: patient.city || '',
      street: patient.street || '',
      patientType: patient.patientType || settings.patient.patientTypes[0] || '',
      notes: patient.notes || '',
    });
    setBirthDateText(formatBirthDateForDisplay(patient.birthDate));
    setErrors({});
    setCitySuggestions([]);
  }, [isOpen, patient, settings.patient.defaultCountry, settings.patient.patientTypes]);

  const validateEmail = (email: string): boolean => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!formData.lastName.trim()) nextErrors.lastName = t.validation.required;
    if (!formData.firstName.trim()) nextErrors.firstName = t.validation.required;
    if (!formData.birthDate) nextErrors.birthDate = t.validation.required;
    if (!formData.zipCode?.trim()) nextErrors.zipCode = t.validation.required;
    if (!formData.city?.trim()) nextErrors.city = t.validation.required;
    if (!formData.street?.trim()) nextErrors.street = t.validation.required;

    const tajState = getTajValidationState(formData.insuranceNum || '');
    if (tajState !== 'empty' && tajState !== 'valid') {
      nextErrors.insuranceNum = t.validation.invalidInsuranceNum;
    }

    if (formData.email && !validateEmail(formData.email)) {
      nextErrors.email = t.validation.invalidEmail;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSubmit(formData);
    // Fire-and-forget NEAK auto-check
    const tajDigits = formData.insuranceNum?.replace(/-/g, '') || '';
    if (formData.patientType?.toLowerCase().includes('neak') && tajDigits.length === 9) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      checkJogviszony(tajDigits, date).then(result => {
        saveCheck({ id: nanoid(), patientId: patient.patientId, taj: tajDigits, checkedAt: new Date().toISOString(), date, result });
      }).catch(() => {});
    }
  };

  const handleBirthDateTextChange = (value: string) => {
    setBirthDateText(value);
    const parsed = parseBirthDateFromDisplay(value);
    if (parsed) {
      setFormData((prev) => ({ ...prev, birthDate: parsed }));
    } else if (!value) {
      setFormData((prev) => ({ ...prev, birthDate: '' }));
    }
  };

  const handleZipCodeChange = (value: string) => {
    const zip = value.replace(/\D/g, '').slice(0, 4);
    const next = { ...formData, zipCode: zip };

    if (!formData.isForeignAddress && zip.length === 4) {
      const settlements = postalCodes[zip];
      if (settlements?.length === 1) {
        next.city = settlements[0];
        setCitySuggestions([]);
      } else if (settlements && settlements.length > 1) {
        setCitySuggestions(settlements);
      } else {
        setCitySuggestions([]);
      }
    } else {
      setCitySuggestions([]);
    }

    setFormData(next);
  };

  const handleForeignToggle = (checked: boolean) => {
    setFormData({
      ...formData,
      isForeignAddress: checked,
      country: checked ? '' : settings.patient.defaultCountry,
    });
    setCitySuggestions([]);
  };

  const titleOptions = ['', 'Dr.', 'Prof.', 'id.', 'ifj.', 'özv.'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.patients.editPatient} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Title, Last Name, First Name */}
        <div className="flex gap-4">
          <div className="w-20 shrink-0 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.patients.titleLabel}
            </label>
            <select
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full min-w-0 px-1 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300 text-sm"
            >
              {titleOptions.map((v) => (
                <option key={v} value={v}>{v || '—'}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <Input
              label={t.patients.lastName}
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              error={errors.lastName}
              required
            />
          </div>
          <div className="flex-1 min-w-0">
            <Input
              label={t.patients.firstName}
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              error={errors.firstName}
              required
            />
          </div>
        </div>

        {/* Row 2: Birth Date, Birth Place */}
        <div className="grid grid-cols-2 gap-4">
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.patients.birthDate}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                value={birthDateText}
                onChange={(e) => handleBirthDateTextChange(e.target.value)}
                placeholder={getDatePlaceholder()}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors ${
                  errors.birthDate ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
              />
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setFormData((prev) => ({ ...prev, birthDate: val }));
                    setBirthDateText(formatBirthDateForDisplay(val));
                  }
                }}
                className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer"
                tabIndex={-1}
              />
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            {errors.birthDate && <p className="mt-1 text-sm text-red-600">{errors.birthDate}</p>}
          </div>
          <Input
            label={t.patients.birthPlace}
            value={formData.birthPlace || ''}
            onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
          />
        </div>

        {/* Row 3: Sex, TAJ */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.patients.sex}
            value={formData.sex}
            onChange={(e) =>
              setFormData({ ...formData, sex: e.target.value as PatientFormData['sex'] })
            }
            options={[
              { value: 'male', label: t.patients.male },
              { value: 'female', label: t.patients.female },
              { value: 'other', label: t.patients.other },
            ]}
            required
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.patients.insuranceNum}
            </label>
            <div className="flex gap-1">
              <input
                value={formData.insuranceNum || ''}
                onChange={(e) =>
                  setFormData({ ...formData, insuranceNum: formatInsuranceNum(e.target.value) })
                }
                placeholder={t.patients.insuranceNumPlaceholder}
                maxLength={11}
                className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  (() => {
                    const state = getTajValidationState(formData.insuranceNum || '');
                    if (state === 'empty') return 'border-gray-300 focus:ring-dental-500';
                    if (state === 'incomplete') return 'border-yellow-300 bg-yellow-50 focus:ring-yellow-500';
                    if (state === 'valid') return 'border-green-500 bg-green-50 focus:ring-green-500';
                    return 'border-red-500 bg-red-50 focus:ring-red-500';
                  })()
                }`}
              />
              {formData.patientType?.toLowerCase().includes('neak') &&
                getTajValidationState(formData.insuranceNum || '') === 'valid' && (
                <button
                  type="button"
                  onClick={() => setNeakModalOpen(true)}
                  className="shrink-0 rounded-lg border border-gray-300 p-2 text-dental-600 hover:bg-dental-50 hover:text-dental-700 transition-colors"
                  title={t.neak.checkButton}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </button>
              )}
            </div>
            {getTajValidationState(formData.insuranceNum || '') === 'invalid' && (
              <p className="mt-1 text-sm text-red-600">{t.validation.invalidInsuranceNum}</p>
            )}
            {getTajValidationState(formData.insuranceNum || '') === 'valid' && (
              <p className="mt-1 text-sm text-green-600">{t.patients.tajValid}</p>
            )}
            {errors.insuranceNum && (
              <p className="mt-1 text-sm text-red-600">{errors.insuranceNum}</p>
            )}
          </div>
        </div>

        {/* Address Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.patients.addressSection}</h3>

          <div className="grid grid-cols-[1fr_8rem_1fr_auto] gap-4 items-end">
            <Input
              label={t.patients.country}
              value={formData.country || ''}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              readOnly={!formData.isForeignAddress}
              className={!formData.isForeignAddress ? 'bg-gray-50' : ''}
            />
            <Input
              label={t.patients.zipCode}
              value={formData.zipCode || ''}
              onChange={(e) => handleZipCodeChange(e.target.value)}
              placeholder="9700"
              maxLength={4}
              error={errors.zipCode}
              required
            />
            <div>
              {citySuggestions.length > 1 ? (
                <Select
                  label={t.patients.city}
                  value={formData.city || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, city: e.target.value });
                    setCitySuggestions([]);
                  }}
                  options={citySuggestions.map((s) => ({ value: s, label: s }))}
                  error={errors.city}
                  required
                />
              ) : (
                <Input
                  label={t.patients.city}
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  error={errors.city}
                  required
                />
              )}
            </div>
            <label className="flex items-center gap-2 mb-1 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={formData.isForeignAddress || false}
                onChange={(e) => handleForeignToggle(e.target.checked)}
                className="rounded border-gray-300 text-dental-600 focus:ring-dental-500"
              />
              <span className="text-sm text-gray-700">{t.patients.foreignAddress}</span>
            </label>
          </div>

          <div className="mt-3">
            <Input
              label={t.patients.street}
              value={formData.street || ''}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              placeholder="Fő tér 1."
              error={errors.street}
              required
            />
          </div>
        </div>

        {/* Contact Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.patients.contactInfo}</h3>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.patients.phone}
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              type="email"
              label={t.patients.email}
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
            />
          </div>
        </div>

        {/* Patient Type */}
        {settings.patient.patientTypes.length > 0 && (
          <Select
            label={t.patients.patientType}
            value={formData.patientType || ''}
            onChange={(e) => setFormData({ ...formData, patientType: e.target.value })}
            options={settings.patient.patientTypes.map((pt) => ({ value: pt, label: pt }))}
          />
        )}

        {/* Notes */}
        <TextArea
          label={t.patients.notes}
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />

        {/* Validation warning */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm font-medium text-red-700">{t.patients.missingFieldsTitle}</p>
            <p className="text-sm text-red-600">{t.patients.missingFieldsMessage}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{t.common.save}</Button>
        </div>
      </form>
      {neakModalOpen && (
        <NeakCheckModal
          isOpen={neakModalOpen}
          onClose={() => setNeakModalOpen(false)}
          patientId={patient.patientId}
          taj={formData.insuranceNum || ''}
          patientName={`${formData.lastName} ${formData.firstName}`.trim()}
        />
      )}
    </Modal>
  );
}

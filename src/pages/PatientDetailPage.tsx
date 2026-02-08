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
} from '../utils';
import { calculateQuoteTotals } from '../utils/calculations';
import { useEffect, useMemo, useRef, useState } from 'react';
import iconFemale from '../assets/icon-svgs/symbol-female.svg';
import iconMale from '../assets/icon-svgs/symbol-male.svg';
import { OdontogramHost, OdontogramHostHandle } from '../modules/odontogram/OdontogramHost';
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
  const hostRef = useRef<OdontogramHostHandle | null>(null);
  const { getPatient, editPatient, duplicatePatient, archivePatient, deletePatient } = usePatients();
  const { getQuotesByPatient, createQuote, deleteQuote, duplicateQuote } = useQuotes();
  const [deleteQuoteConfirm, setDeleteQuoteConfirm] = useState<string | null>(null);
  const [deletePatientConfirm, setDeletePatientConfirm] = useState(false);
  const [editPatientModalOpen, setEditPatientModalOpen] = useState(false);
  const [initialOdontogramState, setInitialOdontogramState] = useState<OdontogramState | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<OdontogramTimelineEntry[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingSnapshotState, setEditingSnapshotState] = useState<OdontogramState | null>(null);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [pendingDeleteSnapshotId, setPendingDeleteSnapshotId] = useState<string | null>(null);

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

  const handleEditPatient = (data: PatientFormData) => {
    editPatient(patient.patientId, data);
    setEditPatientModalOpen(false);
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
            <span>{formatPatientName(patient.lastName, patient.firstName)}</span>
          </div>
          <h1 id="patientNameDisplay" className="text-2xl font-bold text-gray-900">
            {formatPatientName(patient.lastName, patient.firstName)}
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
        <div id="patientActions" className="flex items-center gap-2">
          <Button id="patientDuplicateBtn" variant="secondary" onClick={handleDuplicatePatient}>
            {t.common.duplicate}
          </Button>
          <Button id="patientEditBtn" variant="secondary" onClick={() => setEditPatientModalOpen(true)}>
            {t.common.edit}
          </Button>
          {!patient.isArchived && (
            <Button id="patientArchiveBtn" variant="secondary" onClick={handleArchivePatient}>
              {t.common.archive}
            </Button>
          )}
          <Button id="patientDeleteBtn" variant="danger" onClick={() => setDeletePatientConfirm(true)}>
            {t.common.delete}
          </Button>
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
                <h2 className="text-lg font-semibold">{t.patients.patientDetails}</h2>
              </CardHeader>
            </div>
            <div id="patientDataCardContent">
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
                <label className="text-sm text-gray-500">{t.patients.address}</label>
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
            </div>
          </Card>
        </div>

        <div id="patientQuotesSection" className="lg:col-span-2 space-y-4">
          <div id="patientQuotesHeader" className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.quotes.title}</h2>
            <Button id="patientNewQuoteBtn" onClick={handleNewQuote}>
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
                                  : quote.quoteStatus === 'closed_pending'
                                    ? t.quotes.statusClosedPending
                                    : quote.quoteStatus === 'accepted_in_progress'
                                      ? t.quotes.statusAcceptedInProgress
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

      <PatientEditModal
        isOpen={editPatientModalOpen}
        patient={patient}
        onClose={() => setEditPatientModalOpen(false)}
        onSubmit={handleEditPatient}
      />
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
  const { t } = useSettings();
  const [formData, setFormData] = useState<PatientFormData>({
    lastName: '',
    firstName: '',
    sex: 'male',
    birthDate: '',
    insuranceNum: '',
    phone: '',
    email: '',
    zipCode: '',
    city: '',
    street: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      lastName: patient.lastName,
      firstName: patient.firstName,
      sex: patient.sex,
      birthDate: patient.birthDate,
      insuranceNum: patient.insuranceNum || '',
      phone: patient.phone || '',
      email: patient.email || '',
      zipCode: patient.zipCode || '',
      city: patient.city || '',
      street: patient.street || '',
      notes: patient.notes || '',
    });
    setErrors({});
  }, [isOpen, patient]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!formData.lastName.trim()) nextErrors.lastName = t.validation.required;
    if (!formData.firstName.trim()) nextErrors.firstName = t.validation.required;
    if (!formData.birthDate) nextErrors.birthDate = t.validation.required;
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSubmit(formData);
  };

  const tajValidationState = getTajValidationState(formData.insuranceNum || '');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.patients.editPatient} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.patients.lastName}
            value={formData.lastName}
            onChange={(event) => setFormData({ ...formData, lastName: event.target.value })}
            error={errors.lastName}
            required
          />
          <Input
            label={t.patients.firstName}
            value={formData.firstName}
            onChange={(event) => setFormData({ ...formData, firstName: event.target.value })}
            error={errors.firstName}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.patients.sex}
            value={formData.sex}
            onChange={(event) =>
              setFormData({ ...formData, sex: event.target.value as PatientFormData['sex'] })
            }
            options={[
              { value: 'male', label: t.patients.male },
              { value: 'female', label: t.patients.female },
              { value: 'other', label: t.patients.other },
            ]}
          />
          <Input
            type="date"
            label={t.patients.birthDate}
            value={formData.birthDate}
            onChange={(event) => setFormData({ ...formData, birthDate: event.target.value })}
            error={errors.birthDate}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.patients.insuranceNum}
            value={formData.insuranceNum}
            onChange={(event) =>
              setFormData({ ...formData, insuranceNum: formatInsuranceNum(event.target.value) })
            }
            placeholder={t.patients.insuranceNumPlaceholder}
            maxLength={11}
            error={
              formData.insuranceNum && tajValidationState !== 'valid'
                ? t.validation.invalidInsuranceNum
                : undefined
            }
          />
          <Input
            label={t.patients.phone}
            value={formData.phone}
            onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
          />
        </div>

        <Input
          type="email"
          label={t.patients.email}
          value={formData.email}
          onChange={(event) => setFormData({ ...formData, email: event.target.value })}
        />

        <div className="grid grid-cols-3 gap-4">
          <Input
            label={t.patients.zipCode}
            value={formData.zipCode}
            onChange={(event) => setFormData({ ...formData, zipCode: event.target.value })}
          />
          <Input
            label={t.patients.city}
            value={formData.city}
            onChange={(event) => setFormData({ ...formData, city: event.target.value })}
          />
          <Input
            label={t.patients.street}
            value={formData.street}
            onChange={(event) => setFormData({ ...formData, street: event.target.value })}
          />
        </div>

        <TextArea
          label={t.patients.notes}
          value={formData.notes}
          onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
          rows={3}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{t.common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}

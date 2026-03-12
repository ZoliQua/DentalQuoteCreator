import { useParams, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
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
import { PageTabBar } from '../components/common/PageTabBar';
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
import { getAuthHeaders } from '../utils/auth';
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
import type { Patient, PatientFormData, Country, Appointment } from '../types';
import { useAppointments } from '../hooks/useAppointments';
import { useSms } from '../hooks/useSms';
import { SmsSendModal } from '../components/sms/SmsSendModal';
import { SmsHistoryTable } from '../components/sms/SmsHistoryTable';
import { EmailHistoryTable } from '../components/email/EmailHistoryTable';
import { EmailSendModal } from '../components/email/EmailSendModal';
import { NeakCheckModal } from '../modules/neak/NeakCheckModal';
import { checkJogviszony, saveCheck } from '../modules/neak';
import { useLabWorkOrders, LabWorkOrderStatusBadge } from '../modules/dq-techniq';

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
        className="rounded-md border border-theme-primary p-2 text-theme-secondary transition-colors hover:bg-theme-hover hover:text-theme-primary"
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
        className="rounded-md border border-theme-primary p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
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
      className="rounded-md border border-theme-primary p-2 text-theme-secondary transition-colors hover:bg-theme-hover hover:text-theme-primary"
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
  const location = useLocation();
  const { t, appLanguage } = useSettings();
  const { hasPermission, user } = useAuth();
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    fetch('/backend/countries', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCountries(data); })
      .catch(() => {});
  }, []);

  const resolveCountryName = (id: string | undefined) => {
    if (!id) return '';
    const c = countries.find((c) => String(c.countryId) === String(id));
    if (!c) return id;
    return appLanguage === 'de' ? c.countryNameDe : appLanguage === 'en' ? c.countryNameEn : c.countryNameHu;
  };
  const { fetchAppointmentsByPatient } = useAppointments();
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    if (!patientId) return;
    fetchAppointmentsByPatient(patientId).then((data) => {
      if (Array.isArray(data)) setPatientAppointments(data);
    });
  }, [patientId, fetchAppointmentsByPatient]);

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
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const { checkEnabled: checkSmsEnabled } = useSms();
  const [smsEnabled, setSmsEnabled] = useState(false);

  useEffect(() => {
    checkSmsEnabled().then(setSmsEnabled);
  }, [checkSmsEnabled]);

  const patient = patientId ? getPatient(patientId) : undefined;
  const quotes = patientId ? getQuotesByPatient(patientId) : [];

  // All hooks must be before any early return (React Rules of Hooks)
  const [patientInvoices, setPatientInvoices] = useState<InvoiceRecord[]>(() =>
    patient ? getInvoicesByPatient(patient.patientId) : []
  );
  const refreshPatientInvoices = () => {
    if (patient) setPatientInvoices(getInvoicesByPatient(patient.patientId));
  };
  useEffect(() => { if (patient?.patientId) refreshPatientInvoices(); }, [patient?.patientId]);

  const neakChecks = useMemo(() => {
    if (!patient?.patientType?.toLowerCase().includes('neak')) return [];
    return getChecksByPatient(patient.patientId);
  }, [patient?.patientId, patient?.patientType]);

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

  // Determine active tab from URL path
  const basePath = `/patients/${patientId}`;
  const subPath = location.pathname.replace(basePath, '').replace(/^\//, '');
  const activeTab = subPath || 'status';

  if (!patient) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-theme-primary">{t.patients.notFound}</h2>
        <Link to="/patients" className="text-dental-600 hover:text-dental-700 mt-4 inline-block">
          {t.patients.backToPatients}
        </Link>
      </div>
    );
  }

  // Redirect base path to status tab
  const validTabs = ['status', 'treatments', 'card', 'calendar', 'notifications', 'quotes', 'invoices', 'lab', 'neak'];
  if (!subPath || !validTabs.includes(activeTab)) {
    return <Navigate to={`${basePath}/status`} replace />;
  }

  const patientTabs = [
    { key: 'status', to: `${basePath}/status`, label: t.patients.patientTabStatus, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6m-6 0a2 2 0 00-2 2v2a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2m-6 0v2m6-2v2M7 11h10m-9 4h8m-7 4h6" /></svg> },
    { key: 'card', to: `${basePath}/card`, label: t.patients.patientTabCard, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg> },
    { key: 'treatments', to: `${basePath}/treatments`, label: t.patients.patientTabTreatments, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg> },
    { key: 'calendar', to: `${basePath}/calendar`, label: t.patients.patientTabCalendar, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { key: 'notifications', to: `${basePath}/notifications`, label: t.patients.patientTabNotifications, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
    { key: 'quotes', to: `${basePath}/quotes`, label: t.patients.patientTabQuotes, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { key: 'invoices', to: `${basePath}/invoices`, label: t.patients.patientTabInvoices, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { key: 'lab', to: `${basePath}/lab`, label: t.nav?.labWorkOrders ?? 'Munkalapok', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    ...(patient.patientType?.toLowerCase().includes('neak') ? [{ key: 'neak', to: `${basePath}/neak`, label: t.patients.patientTabNeak, icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg> }] : []),
  ];

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

  const handleOdontogramClick = (event: React.MouseEvent) => {
    const target = event.target as Element | null;
    const toothGrid = target?.closest('#toothGrid');
    if (!toothGrid || !activeSnapshotId) return;
    handleOpenEditSnapshot(activeSnapshotId);
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

  return (
    <div id="patientDetailPage" className="space-y-6">
      <div id="patientHeader" className="flex items-start justify-between">
        <div id="patientTitleBlock">
          <div id="patientBreadcrumb" className="flex items-center gap-2 text-sm text-theme-tertiary mb-2">
            <Link to="/patients" className="hover:text-dental-600">
              {t.patients.title}
            </Link>
            <span>/</span>
            <span>{formatPatientName(patient.lastName, patient.firstName, patient.title)}</span>
          </div>
          <h1 id="patientNameDisplay" className="text-2xl font-bold text-theme-primary">
            {formatPatientName(patient.lastName, patient.firstName, patient.title)}
            {patientAge !== null && (
              <span className="ml-2 align-middle text-base font-medium text-theme-tertiary">
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

      <PageTabBar tabs={patientTabs} />

      {activeTab === 'status' && !editorOpen && (
        <div id="patientOdontogramSection" onClick={handleOdontogramClick}>
          <OdontogramHost
            ref={hostRef}
            patientId={patient.patientId}
            mode="view"
            initialState={initialOdontogramState}
            onChange={() => {}}
            panelContent={
              <div className="rounded-lg border border-theme-primary bg-theme-tertiary">
                <div className="flex items-center justify-between border-b border-theme-primary px-4 py-3">
                  <span className="text-sm font-semibold text-theme-primary">{t.patients.statusTimeline}</span>
                  <TimelinePlusButton
                    onClick={handleAddTimelineStatus}
                    title={t.patients.statusTimelineAdd}
                  />
                </div>
                <div className="space-y-2 px-4 py-3">
                  {timelineRows.length === 0 ? (
                    <p className="text-sm text-theme-tertiary">{t.patients.noStatusHistory}</p>
                  ) : (
                    timelineRows.map((entry) => (
                      <div
                        key={entry.snapshotId}
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 ${
                          activeSnapshotId === entry.snapshotId
                            ? 'border-dental-300 bg-dental-50'
                            : 'border-theme-primary bg-theme-secondary hover:bg-theme-tertiary'
                        }`}
                        onClick={() => loadSnapshotForView(entry.snapshotId)}
                      >
                        <span className="text-sm text-theme-secondary">{entry.formatted}</span>
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

      {/* Tab: Karton (Card) */}
      {activeTab === 'card' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t.patients.patientDetails}</h2>
              <div className="flex items-center gap-1">
                {hasPermission('patients.update') && (
                  <button
                    onClick={() => setDuplicatePatientConfirm(true)}
                    className="rounded-lg p-2 text-theme-secondary hover:bg-theme-hover transition-colors"
                    title={t.patients.duplicateDataSheet}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                )}
                {hasPermission('patients.update') && !patient.isArchived && (
                  <button
                    onClick={handleArchivePatient}
                    className="rounded-lg p-2 text-theme-secondary hover:bg-theme-hover transition-colors"
                    title={t.common.archive}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  </button>
                )}
                {hasPermission('patients.delete') && (
                  <button
                    onClick={() => setDeletePatientConfirm(true)}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={t.common.delete}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-1 13H6L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" /></svg>
                  </button>
                )}
                {hasPermission('patients.update') && (
                  <button
                    onClick={() => setEditPatientModalOpen(true)}
                    className="rounded-lg p-2 text-dental-600 hover:bg-dental-50 dark:hover:bg-dental-900/20 transition-colors"
                    title={t.common.edit}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {/* Row 1: Név + Nem, Anyja neve */}
              <div className="flex gap-8">
                <div className="flex-1">
                  <label className="text-sm text-theme-tertiary">{t.patients.name}</label>
                  <p className="font-medium">{formatPatientName(patient.lastName, patient.firstName, patient.title)}</p>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-theme-tertiary">{t.patients.sex}</label>
                  <p className="font-medium">{t.patients[patient.sex]}</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.mothersName}</label>
                <p className="font-medium">{patient.mothersName || '—'}</p>
              </div>

              {/* Row 2: Születési hely, Születési idő */}
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.birthPlace}</label>
                <p className="font-medium">{patient.birthPlace || '—'}</p>
              </div>
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.birthDate}</label>
                <p className="font-medium">{formatDate(patient.birthDate, 'long')}</p>
              </div>

              {/* Row 3: Személyazonosító típus, TAJ szám */}
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.neakDocumentType}</label>
                <p className="font-medium">
                  {t.patients[`neakDocType${patient.neakDocumentType ?? 1}` as keyof typeof t.patients] || t.patients.neakDocumentType}
                </p>
              </div>
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.insuranceNum}</label>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{patient.insuranceNum || '—'}</p>
                  {patient.patientType?.toLowerCase().includes('neak') && patient.insuranceNum && (
                    <button
                      type="button"
                      onClick={() => setNeakModalOpen(true)}
                      className="rounded-md border border-theme-primary p-1 text-dental-600 hover:bg-dental-50 hover:text-dental-700 transition-colors"
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
                  <p className="text-xs text-theme-muted mt-1">
                    {t.neak.transactionCode}: <span className="font-mono">{neakChecks[0].result.tranKod}</span>
                  </p>
                )}
              </div>

              {/* Row 4: Ország, Lakcím */}
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.country}</label>
                <p className="font-medium">
                  {patient.isForeignAddress && patient.country
                    ? resolveCountryName(patient.country)
                    : 'Magyarország'}
                  {patient.isForeignAddress && (
                    <span className="ml-2 text-xs bg-theme-hover text-theme-secondary px-2 py-0.5 rounded">
                      {t.patients.foreignAddress}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.addressSection}</label>
                <p className="font-medium">
                  {[patient.zipCode, patient.city].filter(Boolean).join(' ')}
                  {(patient.zipCode || patient.city) && patient.street ? ', ' : ''}
                  {patient.street || '—'}
                </p>
              </div>

              {/* Row 5: Számlázási név + Adószám, Számlázási cím */}
              <div className="flex gap-8">
                <div className="flex-1">
                  <label className="text-sm text-theme-tertiary">{t.patients.patientVATName}</label>
                  <p className="font-medium">{patient.patientVATName || '—'}</p>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-theme-tertiary">{t.patients.patientVATNumber}</label>
                  <p className="font-medium">{patient.patientVATNumber || '—'}</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.patientVATAddress}</label>
                <p className="font-medium">{patient.patientVATAddress || '—'}</p>
              </div>

              {/* Row 6: Telefonszám, E-mail */}
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.phone}</label>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{patient.phone || '—'}</p>
                  {smsEnabled && hasPermission('sms.send') && patient.phone && (
                    <button
                      onClick={() => setSmsModalOpen(true)}
                      className="rounded-md border border-theme-primary p-1 text-dental-600 hover:bg-dental-50 hover:text-dental-700 transition-colors"
                      title={t.sms.sendSmsToPatient}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.email}</label>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{patient.email || '—'}</p>
                  {patient.email && (
                    <a
                      href={`mailto:${patient.email}`}
                      className="rounded-md border border-theme-primary p-1 text-dental-600 hover:bg-dental-50 hover:text-dental-700 transition-colors"
                      title={t.email.send}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>

              {/* Row 6: Páciens kedvezmény, Páciens típus */}
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.patientDiscount}</label>
                <p className="font-medium">{patient.patientDiscount != null && patient.patientDiscount > 0 ? `${patient.patientDiscount}%` : '—'}</p>
              </div>
              <div>
                <label className="text-sm text-theme-tertiary">{t.patients.patientType}</label>
                <p className="font-medium">{patient.patientType || '—'}</p>
              </div>
            </div>

            {/* Notes */}
            {patient.notes && (
              <div className="mt-4 pt-4 border-t border-theme-primary">
                <label className="text-sm text-theme-tertiary">{t.patients.notes}</label>
                <p className="text-theme-secondary whitespace-pre-wrap mt-1">{patient.notes}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="mt-4 pt-4 border-t border-theme-primary flex gap-6 text-sm text-theme-tertiary">
              <p>{t.patients.createdAt}: {formatDate(patient.createdAt)}</p>
              <p>{t.patients.modifiedAt}: {formatDate(patient.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Naptár (Calendar) */}
      {activeTab === 'calendar' && (() => {
        const now = new Date();
        const upcoming = [...patientAppointments].filter(a => new Date(a.startDateTime) >= now).sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
        const past = [...patientAppointments].filter(a => new Date(a.startDateTime) < now).sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
        const statusColors: Record<string, string> = {
          scheduled: 'bg-blue-100 text-blue-800',
          confirmed: 'bg-green-100 text-green-800',
          completed: 'bg-theme-hover text-theme-secondary',
          cancelled: 'bg-red-100 text-red-700',
          noShow: 'bg-yellow-100 text-yellow-800',
        };
        const statusLabels: Record<string, string> = {
          scheduled: t.calendar.statusScheduled,
          confirmed: t.calendar.statusConfirmed,
          completed: t.calendar.statusCompleted,
          cancelled: t.calendar.statusCancelled,
          noShow: t.calendar.statusNoShow,
        };
        const renderRow = (a: Appointment) => {
          const start = new Date(a.startDateTime);
          return (
            <Link key={a.appointmentId} to={`/calendar/day?date=${start.toISOString().slice(0, 10)}`} className="block">
              <Card hoverable>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {a.appointmentType && (
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.appointmentType.color }} />
                    )}
                    <span className="font-medium text-theme-primary">{a.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-theme-tertiary text-sm">
                    <span>{start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[a.status] || 'bg-theme-hover text-theme-secondary'}`}>
                      {statusLabels[a.status] || a.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        };
        return (
          <div className="space-y-6">
            {/* Upcoming */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t.calendar.upcomingAppointments}</h2>
                  {hasPermission('calendar.create') && (
                    <Button size="sm" onClick={() => navigate(`/calendar/day?action=new&patientId=${patient.patientId}&date=${new Date().toISOString().slice(0, 10)}`)}>
                      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      {t.calendar.newAppointment}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {upcoming.length > 0 ? (
                  <div className="space-y-2">{upcoming.map(renderRow)}</div>
                ) : (
                  <p className="text-sm text-theme-muted">{t.calendar.noUpcomingAppointments}</p>
                )}
              </CardContent>
            </Card>

            {/* Past */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">{t.calendar.pastAppointments}</h2>
              </CardHeader>
              <CardContent>
                {past.length > 0 ? (
                  <div className="space-y-2">{past.map(renderRow)}</div>
                ) : (
                  <p className="text-sm text-theme-muted">{t.calendar.noPastAppointments}</p>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Tab: Árajánlatok (Quotes) */}
      {activeTab === 'quotes' && (
        <div id="patientQuotesSection" className="space-y-4">
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
                            <h3 className="font-semibold text-theme-primary">{quote.quoteName}</h3>
                            <div className="flex items-center gap-3 text-sm text-theme-tertiary">
                              <span className="rounded bg-theme-hover px-2 py-0.5 font-mono text-xs text-theme-secondary">
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
                          <p className="font-semibold text-theme-primary">{formatCurrency(totals.total)}</p>
                          <p className="text-sm text-theme-tertiary">
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
      )}

      {/* Tab: Számlák (Invoices) */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t.invoices.issuedInvoices}</h2>

          {patientInvoices.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-theme-tertiary">{t.patients.noInvoicesForPatient}</p>
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
                    {hasPermission('invoices.view.detail') ? (
                      <Link to={`/invoices/${invoice.id}`} className="flex-1">
                        <div>
                          <h3 className="font-semibold text-theme-primary">
                            {invoice.szamlazzInvoiceNumber || t.invoices.preview}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-theme-tertiary">
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
                    ) : (
                      <div className="flex-1">
                        <h3 className="font-semibold text-theme-primary">
                          {invoice.szamlazzInvoiceNumber || t.invoices.preview}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-theme-tertiary">
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
                    )}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-semibold ${invoice.status === 'storno' ? 'text-red-600' : 'text-theme-primary'}`}>
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
                        {hasPermission('invoices.storno') && invoice.status === 'sent' && invoice.szamlazzInvoiceNumber && (
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
        </div>
      )}

      {/* Tab: NEAK */}
      {activeTab === 'neak' && patient.patientType?.toLowerCase().includes('neak') && (
        <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t.neak.neakData}</h2>
              {neakChecks.length === 0 ? (
                <Card>
                  <CardContent>
                    <p className="text-sm text-theme-tertiary">{t.neak.noHistory}</p>
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
                              <p className="text-sm text-theme-tertiary">
                                {formatDateTime(entry.checkedAt)}
                              </p>
                              <p className="text-xs text-theme-muted">TAJ: {formatInsuranceNum(entry.taj)}</p>
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
                            <p className="text-xs text-theme-muted mt-1 font-mono">{t.neak.transactionCode}: {entry.result.tranKod}</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
        </div>
      )}

      {/* Tab: Értesítések (Notifications) */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* SMS Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  {t.sms.patientSmsHistory}
                </h2>
                {smsEnabled && hasPermission('sms.send') && patient.phone && (
                  <Button size="sm" onClick={() => setSmsModalOpen(true)}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t.sms.sendSmsToPatient}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {smsEnabled && hasPermission('sms.history') ? (
                <SmsHistoryTable patientId={patient.patientId} compact />
              ) : (
                <p className="text-sm text-theme-muted">{t.sms.noHistory}</p>
              )}
            </CardContent>
          </Card>

          {/* Email Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-theme-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {t.email.patientEmailHistory}
                </h2>
                {hasPermission('email.send') && patient.email && (
                  <Button size="sm" onClick={() => setEmailModalOpen(true)}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t.email.sendEmailToPatient}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {hasPermission('email.history') ? (
                <EmailHistoryTable patientId={patient.patientId} compact />
              ) : (
                <p className="text-sm text-theme-muted">{t.email.noHistory}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Kezelések (Treatments) */}
      {activeTab === 'treatments' && (
        <div className="space-y-4">
          {sortedQuotes.filter(q => q.quoteStatus === 'started' || q.quoteStatus === 'completed').length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<EmptyQuoteIcon />}
                  title={t.patients.noTreatmentsYet}
                  description={t.patients.noTreatmentsDesc}
                />
              </CardContent>
            </Card>
          ) : (
            sortedQuotes
              .filter(q => q.quoteStatus === 'started' || q.quoteStatus === 'completed')
              .map((quote) => {
                const totals = calculateQuoteTotals(quote);
                return (
                  <Card key={quote.quoteId} hoverable>
                    <CardContent>
                      <Link
                        to={quote.quoteType === 'visual'
                          ? `/patients/${patient.patientId}/visual-quotes/${quote.quoteId}`
                          : `/patients/${patient.patientId}/quotes/${quote.quoteId}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-theme-primary">{quote.quoteName}</h3>
                            <div className="flex items-center gap-3 text-sm text-theme-tertiary mt-1">
                              <span className="rounded bg-theme-hover px-2 py-0.5 font-mono text-xs text-theme-secondary">
                                {quote.quoteNumber || formatQuoteId(quote.quoteId)}
                              </span>
                              <Badge
                                variant={quote.quoteStatus === 'completed' ? 'default' : 'success'}
                                size="sm"
                              >
                                {quote.quoteStatus === 'completed' ? t.quotes.statusCompleted : t.quotes.statusStarted}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-theme-primary">{formatCurrency(totals.total)}</p>
                            <p className="text-sm text-theme-tertiary">
                              {t.quotes.itemsCount.replace('{count}', String(quote.items.length))}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </div>
      )}

      {activeTab === 'lab' && (
        <PatientLabTab patientId={patient.patientId} />
      )}

      {/* SMS Send Modal */}
      <SmsSendModal
        isOpen={smsModalOpen}
        onClose={() => setSmsModalOpen(false)}
        patientId={patient.patientId}
        patientName={formatPatientName(patient.lastName, patient.firstName, patient.title)}
        phoneNumber={patient.phone || undefined}
        isHungarianPhone={patient.isHungarianPhone ?? true}
        context="patient_detail"
      />

      {/* Email Send Modal */}
      <EmailSendModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        patientId={patient.patientId}
        patientName={formatPatientName(patient.lastName, patient.firstName, patient.title)}
        emailAddress={patient.email || undefined}
        context="patient_detail"
      />

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
            className="w-full rounded-lg border border-theme-primary p-4 text-left hover:border-dental-400 hover:bg-dental-50 transition-colors"
            onClick={handleCreateItemizedQuote}
          >
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-dental-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <div>
                <p className="font-semibold text-theme-primary">{t.quotes.newQuoteItemized}</p>
                <p className="text-sm text-theme-tertiary">{t.quotes.newQuoteItemizedDesc}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="w-full rounded-lg border border-theme-primary p-4 text-left hover:border-dental-400 hover:bg-dental-50 transition-colors"
            onClick={handleCreateVisualQuote}
          >
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-dental-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              <div>
                <p className="font-semibold text-theme-primary">{t.quotes.newQuoteVisual}</p>
                <p className="text-sm text-theme-tertiary">{t.quotes.newQuoteVisualDesc}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="w-full rounded-lg border border-theme-primary p-4 text-left opacity-50 cursor-not-allowed"
            disabled
          >
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-theme-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-theme-tertiary">{t.quotes.newQuoteAutomatic}</p>
                  <Badge variant="default" size="sm">{t.common.comingSoon}</Badge>
                </div>
                <p className="text-sm text-theme-muted">{t.quotes.newQuoteAutomaticDesc}</p>
              </div>
            </div>
          </button>
        </div>
      </Modal>
    </div>
  );
}

function PatientLabTab({ patientId }: { patientId: string }) {
  const { t } = useSettings();
  const navigate = useNavigate();
  const { workOrders, partners, loading, loadPatientWorkOrders, loadPartners } = useLabWorkOrders();

  useEffect(() => {
    loadPatientWorkOrders(patientId);
    loadPartners();
  }, [patientId, loadPatientWorkOrders, loadPartners]);

  const getLabName = (labPartnerId: string) => {
    const lp = partners.find((p) => p.labPartnerId === labPartnerId);
    return lp?.labName ?? labPartnerId;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-theme-primary">
          {t.lab?.workOrders ?? 'Munkalapok'}
        </h2>
        <Button onClick={() => navigate(`/lab/new?patientId=${patientId}`)}>
          {t.lab?.newWorkOrder ?? 'Új munkalap'}
        </Button>
      </div>

      {loading ? (
        <p className="text-theme-secondary text-center py-8">{t.common.loading ?? 'Betöltés...'}</p>
      ) : workOrders.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-theme-secondary text-center py-4">
              {t.lab?.noWorkOrders ?? 'Nincs munkalap.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {workOrders.map((order) => {
            const isOverdue =
              order.requestedDeadline &&
              !['delivered', 'accepted', 'cancelled'].includes(order.status) &&
              new Date(order.requestedDeadline) < new Date();

            return (
              <Card
                key={order.workOrderId}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/lab/${order.workOrderId}`)}
              >
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-medium text-theme-primary text-sm">
                        {order.workOrderNumber}
                      </span>
                      {order.priority === 'urgent' && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 text-xs rounded font-medium">
                          {t.lab?.urgent ?? 'Sürgős'}
                        </span>
                      )}
                      <LabWorkOrderStatusBadge status={order.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-theme-secondary shrink-0">
                      <span>{getLabName(order.labPartnerId)}</span>
                      {order.requestedDeadline && (
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(order.requestedDeadline)}
                          {isOverdue && (
                            <span className="ml-1 text-xs">{t.lab?.overdue ?? '(lejárt)'}</span>
                          )}
                        </span>
                      )}
                      {order.totalPrice != null && (
                        <span className="font-medium text-theme-primary">
                          {formatCurrency(order.totalPrice, order.currency as 'HUF' | 'EUR')}
                        </span>
                      )}
                    </div>
                  </div>
                  {order.toothNotation && (
                    <p className="text-xs text-theme-secondary mt-1">
                      {t.lab?.toothNotation ?? 'Érintett fogak'}: {order.toothNotation}
                      {order.shade && ` · ${t.lab?.shade ?? 'Fogszín'}: ${order.shade}`}
                      {order.material && ` · ${t.lab?.material ?? 'Anyag'}: ${order.material}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatHungarianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('36') ? digits.slice(2) : digits;
  if (local.length <= 2) return local;
  if (local.length <= 5) return local.slice(0, 2) + ' ' + local.slice(2);
  return local.slice(0, 2) + ' ' + local.slice(2, 5) + ' ' + local.slice(5, 9);
}

type PatientEditModalProps = {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
  onSubmit: (data: PatientFormData) => void;
};

function PatientEditModal({ isOpen, patient, onClose, onSubmit }: PatientEditModalProps) {
  const { t, settings, appLanguage } = useSettings();
  const [neakModalOpen, setNeakModalOpen] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    fetch('/backend/countries', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCountries(data); })
      .catch(() => {});
  }, []);

  const countryName = (id: string | undefined) => {
    if (!id) return '';
    const c = countries.find((c) => String(c.countryId) === String(id));
    if (!c) return id;
    return appLanguage === 'de' ? c.countryNameDe : appLanguage === 'en' ? c.countryNameEn : c.countryNameHu;
  };

  const [formData, setFormData] = useState<PatientFormData>({
    title: '',
    lastName: '',
    firstName: '',
    sex: 'male',
    birthDate: '',
    birthPlace: '',
    insuranceNum: '',
    phone: '+36 ',
    email: '',
    country: settings.patient.defaultCountry,
    isForeignAddress: false,
    zipCode: '',
    city: '',
    street: '',
    patientType: '',
    notes: '',
    mothersName: '',
    neakDocumentType: 1,
    patientVATName: '',
    patientVATNumber: '',
    patientVATAddress: '',
    patientDiscount: null,
    isHungarianPhone: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [birthDateText, setBirthDateText] = useState('');
  const [vatChecking, setVatChecking] = useState(false);
  const [vatResult, setVatResult] = useState<string | null>(null);

  const handleVatCheck = async () => {
    const taxNum = formData.patientVATNumber || '';
    const digits = taxNum.replace(/\D/g, '');
    if (digits.length < 8) return;
    setVatChecking(true);
    setVatResult(null);
    try {
      const resp = await fetch('/backend/api/szamlazz/query-taxpayer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxNumber: taxNum }),
      });
      const data = await resp.json();
      if (data.success && data.valid) {
        const name = data.taxpayerShortName || data.taxpayerName || '';
        const addr = data.address;
        const addrStr = addr ? [addr.postalCode, addr.city, addr.street].filter(Boolean).join(' ') : '';
        setVatResult(t.patients.vatValid);
        setFormData(prev => ({
          ...prev,
          patientVATName: name || prev.patientVATName,
          patientVATAddress: addrStr || prev.patientVATAddress,
        }));
      } else if (data.success && !data.valid) {
        setVatResult(t.patients.vatInvalid);
      } else {
        setVatResult(data.message || t.patients.vatCheckFailed);
      }
    } catch {
      setVatResult(t.patients.vatCheckFailed);
    } finally {
      setVatChecking(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const isHu = patient.isHungarianPhone ?? true;
    setFormData({
      title: patient.title || '',
      lastName: patient.lastName,
      firstName: patient.firstName,
      sex: patient.sex,
      birthDate: patient.birthDate,
      birthPlace: patient.birthPlace || '',
      insuranceNum: patient.insuranceNum || '',
      phone: patient.phone || (isHu ? '+36 ' : '+'),
      email: patient.email || '',
      country: patient.country || settings.patient.defaultCountry,
      isForeignAddress: patient.isForeignAddress || false,
      zipCode: patient.zipCode || '',
      city: patient.city || '',
      street: patient.street || '',
      patientType: patient.patientType || settings.patient.patientTypes[0] || '',
      notes: patient.notes || '',
      mothersName: patient.mothersName || '',
      neakDocumentType: patient.neakDocumentType ?? 1,
      patientVATName: patient.patientVATName || '',
      patientVATNumber: patient.patientVATNumber || '',
      patientVATAddress: patient.patientVATAddress || '',
      patientDiscount: patient.patientDiscount ?? null,
      isHungarianPhone: isHu,
    });
    setBirthDateText(formatBirthDateForDisplay(patient.birthDate));
    setErrors({});
    setCitySuggestions([]);
    setVatResult(null);
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

    const tajState = getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType);
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
    // Fire-and-forget NEAK auto-check (only when document type is TAJ)
    const tajDigits = formData.insuranceNum?.replace(/-/g, '') || '';
    if (formData.neakDocumentType === 1 && formData.patientType?.toLowerCase().includes('neak') && tajDigits.length === 9) {
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
            <label className="block text-sm font-medium text-theme-secondary mb-1">
              {t.patients.titleLabel}
            </label>
            <select
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full min-w-0 px-1 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-theme-secondary text-sm"
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

        {/* Row 2: Mother's Name, Sex */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t.patients.mothersName}
            value={formData.mothersName || ''}
            onChange={(e) => setFormData({ ...formData, mothersName: e.target.value })}
          />
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
        </div>

        {/* Row 3: Birth Date, Birth Place */}
        <div className="grid grid-cols-2 gap-4">
          <div className="w-full">
            <label className="block text-sm font-medium text-theme-secondary mb-1">
              {t.patients.birthDate}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                value={birthDateText}
                onChange={(e) => handleBirthDateTextChange(e.target.value)}
                placeholder={getDatePlaceholder()}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors ${
                  errors.birthDate ? 'border-red-500 focus:ring-red-500' : 'border-theme-secondary'
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
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-theme-muted pointer-events-none"
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

        {/* Row 4: NEAK Document Type, TAJ */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.patients.neakDocumentType}
            value={String(formData.neakDocumentType ?? 1)}
            onChange={(e) =>
              setFormData({ ...formData, neakDocumentType: Number(e.target.value) })
            }
            options={[
              { value: '0', label: t.patients.neakDocType0 },
              { value: '1', label: t.patients.neakDocType1 },
              { value: '2', label: t.patients.neakDocType2 },
              { value: '3', label: t.patients.neakDocType3 },
              { value: '5', label: t.patients.neakDocType5 },
              { value: '6', label: t.patients.neakDocType6 },
              { value: '7', label: t.patients.neakDocType7 },
              { value: '8', label: t.patients.neakDocType8 },
              { value: '9', label: t.patients.neakDocType9 },
            ]}
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-theme-secondary mb-1">
              {t.patients.insuranceNum}
            </label>
            <div className="flex gap-1">
              <input
                value={formData.insuranceNum || ''}
                onChange={(e) =>
                  setFormData({ ...formData, insuranceNum: formData.neakDocumentType === 1 ? formatInsuranceNum(e.target.value) : e.target.value })
                }
                placeholder={formData.neakDocumentType === 1 ? t.patients.insuranceNumPlaceholder : ''}
                maxLength={formData.neakDocumentType === 1 ? 11 : undefined}
                className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  (() => {
                    const state = getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType);
                    if (state === 'empty') return 'border-theme-secondary focus:ring-dental-500';
                    if (state === 'incomplete') return 'border-yellow-300 bg-yellow-50 focus:ring-yellow-500';
                    if (state === 'valid') return 'border-green-500 bg-green-50 focus:ring-green-500';
                    return 'border-red-500 bg-red-50 focus:ring-red-500';
                  })()
                }`}
              />
              {formData.neakDocumentType === 1 && formData.patientType?.toLowerCase().includes('neak') &&
                getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType) === 'valid' && (
                <button
                  type="button"
                  onClick={() => setNeakModalOpen(true)}
                  className="shrink-0 rounded-lg border border-theme-secondary p-2 text-dental-600 hover:bg-dental-50 hover:text-dental-700 transition-colors"
                  title={t.neak.checkButton}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </button>
              )}
            </div>
            {formData.neakDocumentType === 1 && getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType) === 'invalid' && (
              <p className="mt-1 text-sm text-red-600">{t.validation.invalidInsuranceNum}</p>
            )}
            {getTajValidationState(formData.insuranceNum || '', formData.neakDocumentType) === 'valid' && (
              <p className="mt-1 text-sm text-green-600">{t.patients.tajValid}</p>
            )}
            {errors.insuranceNum && (
              <p className="mt-1 text-sm text-red-600">{errors.insuranceNum}</p>
            )}
          </div>
        </div>

        {/* Address Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-theme-secondary mb-3">{t.patients.addressSection}</h3>

          <div className="grid grid-cols-[1fr_8rem_1fr] gap-4 items-end">
            <div className="w-full">
              <label className="block text-sm font-medium text-theme-secondary mb-1">{t.patients.country}</label>
              <div className="flex items-center gap-2">
                {formData.isForeignAddress ? (
                  <select
                    className="flex-1 px-3 py-2 border border-theme-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors"
                    value={formData.country || ''}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  >
                    <option value="">{t.common.select}...</option>
                    {countries.map((c) => (
                      <option key={c.countryId} value={String(c.countryId)}>
                        {appLanguage === 'de' ? c.countryNameDe : appLanguage === 'en' ? c.countryNameEn : c.countryNameHu}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="flex-1 px-3 py-2 border border-theme-secondary rounded-lg bg-theme-tertiary transition-colors"
                    value={countryName(formData.country)}
                    readOnly
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleForeignToggle(!formData.isForeignAddress)}
                  className={`px-2 py-2 rounded-lg border transition-colors text-lg leading-none ${
                    formData.isForeignAddress
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-green-500 bg-green-50'
                  }`}
                  title={formData.isForeignAddress ? t.patients.foreignAddress : countryName(settings.patient.defaultCountry)}
                >
                  {formData.isForeignAddress ? '🇪🇺' : '🇭🇺'}
                </button>
              </div>
            </div>
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
          <h3 className="text-sm font-semibold text-theme-secondary mb-3">{t.patients.contactInfo}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="w-full">
              <label className="block text-sm font-medium text-theme-secondary mb-1">{t.patients.phone}</label>
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  className="flex-1 px-3 py-2 border border-theme-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors"
                  value={formData.phone || (formData.isHungarianPhone ? '+36 ' : '+')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (formData.isHungarianPhone) {
                      const stripped = val.replace(/^\+?3?6?\s*/, '').replace(/\D/g, '');
                      setFormData({ ...formData, phone: '+36 ' + formatHungarianPhone(stripped) });
                    } else {
                      const cleaned = val.startsWith('+') ? val : '+' + val.replace(/^\+*/g, '');
                      setFormData({ ...formData, phone: cleaned });
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const newFlag = !formData.isHungarianPhone;
                    if (newFlag) {
                      const digits = (formData.phone || '').replace(/\D/g, '');
                      const local = digits.startsWith('36') ? digits.slice(2) : digits;
                      setFormData({ ...formData, isHungarianPhone: true, phone: '+36 ' + formatHungarianPhone(local) });
                    } else {
                      setFormData({ ...formData, isHungarianPhone: false, phone: formData.phone || '+' });
                    }
                  }}
                  className={`px-2 py-2 rounded-lg border transition-colors text-lg leading-none ${
                    formData.isHungarianPhone
                      ? 'border-green-500 bg-green-50'
                      : 'border-theme-secondary bg-theme-hover grayscale opacity-50'
                  }`}
                  title="Magyar telefonszám"
                >
                  🇭🇺
                </button>
              </div>
            </div>
            <Input
              type="email"
              label={t.patients.email}
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
            />
          </div>
        </div>

        {/* Billing Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-theme-secondary mb-3">{t.patients.billingSection}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t.patients.patientVATName}
              value={formData.patientVATName || ''}
              onChange={(e) => setFormData({ ...formData, patientVATName: e.target.value })}
            />
            <div className="w-full">
              <label className="block text-sm font-medium text-theme-secondary mb-1">
                {t.patients.patientVATNumber}
              </label>
              <div className="flex gap-1">
                <input
                  value={formData.patientVATNumber || ''}
                  onChange={(e) => { setFormData({ ...formData, patientVATNumber: e.target.value }); setVatResult(null); }}
                  placeholder="12345678-1-42"
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-theme-secondary"
                />
                {(formData.patientVATNumber?.replace(/\D/g, '').length ?? 0) >= 8 && (
                  <button
                    type="button"
                    onClick={handleVatCheck}
                    disabled={vatChecking}
                    className="shrink-0 rounded-lg border border-theme-secondary p-2 text-dental-600 hover:bg-dental-50 hover:text-dental-700 transition-colors disabled:opacity-50"
                    title={t.patients.vatCheckButton}
                  >
                    {vatChecking ? (
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              {vatResult && (
                <p className={`mt-1 text-sm ${vatResult === t.patients.vatValid ? 'text-green-600' : vatResult === t.patients.vatInvalid ? 'text-red-600' : 'text-orange-600'}`}>
                  {vatResult}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3">
            <Input
              label={t.patients.patientVATAddress}
              value={formData.patientVATAddress || ''}
              onChange={(e) => setFormData({ ...formData, patientVATAddress: e.target.value })}
            />
          </div>
        </div>

        {/* Patient Characteristics Section */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-theme-secondary mb-3">{t.patients.characteristicsSection}</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t.patients.patientDiscount}
              value={formData.patientDiscount != null ? String(formData.patientDiscount) : ''}
              onChange={(e) =>
                setFormData({ ...formData, patientDiscount: e.target.value ? Number(e.target.value) : null })
              }
              options={[
                { value: '', label: t.patients.noDiscount },
                { value: '5', label: '5%' },
                { value: '10', label: '10%' },
                { value: '15', label: '15%' },
                { value: '20', label: '20%' },
                { value: '25', label: '25%' },
                { value: '30', label: '30%' },
                { value: '50', label: '50%' },
              ]}
            />
            {settings.patient.patientTypes.length > 0 && (
              <Select
                label={t.patients.patientType}
                value={formData.patientType || ''}
                onChange={(e) => setFormData({ ...formData, patientType: e.target.value })}
                options={settings.patient.patientTypes.map((pt) => ({ value: pt, label: pt }))}
              />
            )}
          </div>
        </div>

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

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useQuotes } from '../hooks';
import { Settings, Doctor, DateFormat, PdfFontFamily } from '../types';
import { Button, Card, CardContent, CardHeader, Input, TextArea, Select, ConfirmModal, Modal, PageTabBar } from '../components/common';
import { useAppointments } from '../hooks/useAppointments';
import type { AppointmentType } from '../types';
import type { AppointmentChair } from '../types/appointment';
import type { PageTab } from '../components/common/PageTabBar';
import { formatDateTimeWithPattern } from '../utils';
import { getAuthHeaders } from '../utils/auth';

type SettingsSection = 'general' | 'clinic' | 'patient' | 'quotes' | 'invoicing' | 'neak' | 'calendar';

type DoctorRow = { doctorId: string; doctorName: string; doctorNum: string; doctorEESZTId: string };

const DATE_FORMAT_OPTIONS: DateFormat[] = [
  'YYYY-MM-DD HH:MM:SS',
  'YYYY/MM/DD HH:MM:SS',
  'YYYY.MM.DD HH:MM:SS',
  'DD.MM.YYYY HH:MM:SS',
  'DD/MM/YYYY HH:MM:SS',
  'MM.DD.YYYY HH:MM:SS',
  'MM/DD/YYYY HH:MM:SS',
];

export function SettingsPage({ section }: { section?: SettingsSection }) {
  const {
    t,
    settings,
    updateSettings,
    appLanguage,
    setAppLanguage,
    odontogramNumbering,
    setOdontogramNumbering,
  } = useSettings();
  const { getQuoteStatistics } = useQuotes();
  const [formData, setFormDataRaw] = useState<Settings>(settings);
  const setFormData: typeof setFormDataRaw = (value) => {
    setIsDirty(true);
    setFormDataRaw(value);
  };
  const [saved, setSaved] = useState(false);
  const [resetCounterConfirm, setResetCounterConfirm] = useState(false);
  const [doctorRows, setDoctorRows] = useState<DoctorRow[]>([]);
  const [taxChecking, setTaxChecking] = useState(false);
  const [taxResult, setTaxResult] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; mode: string; message: string; httpStatus?: number } | null>(null);
  // NEAK settings state
  const [neakSettings, setNeakSettings] = useState({ neakOjoteKey: '', neakWssUser: '', neakWssPassword: '' });
  const [neakDepartments, setNeakDepartments] = useState<Array<{ id: string; neakDepartmentNameHu: string; neakDepartmentNameEn: string; neakDepartmentNameDe: string; neakDepartmentCode: string; neakDepartmentHours: number; neakDepartmentMaxPoints: number; neakDepartmentPrefix: string; neakDepartmentLevel: string; neakDepartmentIndicator: string }>>([]);
  const [neakLevels, setNeakLevels] = useState<Array<{ neakLevelCode: string; neakLevelInfoHu: string; neakLevelInfoEn: string; neakLevelInfoDe: string }>>([]);
  const [neakApiTestLoading, setNeakApiTestLoading] = useState(false);
  const [neakApiTestResult, setNeakApiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [deleteDeptConfirm, setDeleteDeptConfirm] = useState<string | null>(null);
  const [neakSaved, setNeakSaved] = useState(false);
  const [showNeakPassword, setShowNeakPassword] = useState(false);
  const [deptSortColumn, setDeptSortColumn] = useState<string>('neakDepartmentNameHu');
  const [deptSortDir, setDeptSortDir] = useState<'asc' | 'desc'>('asc');
  const [newDept, setNewDept] = useState({ neakDepartmentNameHu: '', neakDepartmentNameEn: '', neakDepartmentNameDe: '', neakDepartmentCode: '', neakDepartmentHours: 20, neakDepartmentMaxPoints: 100000, neakDepartmentPrefix: '', neakDepartmentLevel: 'A', neakDepartmentIndicator: 'adult' });
  const [countriesList, setCountriesList] = useState<Array<{ countryId: number; countryNameHu: string; countryNameEn: string; countryNameDe: string }>>([]);
  // Appointment types for calendar settings
  const {
    appointmentTypes,
    fetchAppointmentTypes,
    createAppointmentType,
    updateAppointmentType,
    deleteAppointmentType,
    chairs,
    fetchChairs,
    createChair,
    updateChair,
    deleteChair,
  } = useAppointments();
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AppointmentType | null>(null);
  const [typeForm, setTypeForm] = useState({ nameHu: '', nameEn: '', nameDe: '', color: '#3B82F6', defaultDurationMin: 30, sortOrder: 0, isActive: true });
  const [chairModalOpen, setChairModalOpen] = useState(false);
  const [editingChair, setEditingChair] = useState<AppointmentChair | null>(null);
  const [chairForm, setChairForm] = useState({ chairNameHu: '', chairNameEn: '', chairNameDe: '', isActive: true });
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/backend/countries', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCountriesList(data); })
      .catch(() => {});
  }, []);

  // Warn on browser tab close / refresh when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Intercept in-app link clicks when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNavTarget(href);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isDirty]);

  const quoteStats = getQuoteStatistics();
  const today = new Date();

  const [pdfLangTab, setPdfLangTab] = useState<'hu' | 'en' | 'de'>('hu');
  const [showAgentKeyLive, setShowAgentKeyLive] = useState(false);
  const [showAgentKeyTest, setShowAgentKeyTest] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadInvoiceSettings = useCallback(async () => {
    try {
      const res = await fetch('/backend/invoice-settings', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Sync into formData.invoice
        setFormDataRaw((prev) => ({
          ...prev,
          invoice: {
            ...prev.invoice,
            invoiceType: data.invoiceType || 'paper',
            defaultComment: data.defaultComment || 'A számla a [árajánlat-sorszám] - [árajánlat-neve] árajánlat alapján készült\nA nyújtott szolgáltatás a 2007. évi CXXVII. törvény (Áfa tv.) 85. § (1) bekezdés e) pontja értelmében mentes az adó alól.',
            defaultVatRate: data.defaultVatRate === '0' ? 0 : data.defaultVatRate === '27' ? 27 : 'TAM',
            defaultPaymentMethod: data.defaultPaymentMethod || 'bankkártya',
            invoiceMode: data.invoiceMode || 'test',
            agentKeyLive: data.agentKeyLive || '',
            agentKeyTest: data.agentKeyTest || '',
          },
        }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadInvoiceSettings();
  }, [loadInvoiceSettings]);

  // Load NEAK data when section is neak
  const loadNeakData = useCallback(async () => {
    try {
      const [settingsRes, deptsRes, levelsRes] = await Promise.all([
        fetch('/backend/neak-settings', { headers: getAuthHeaders() }),
        fetch('/backend/neak-departments', { headers: getAuthHeaders() }),
        fetch('/backend/neak-levels', { headers: getAuthHeaders() }),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setNeakSettings({ neakOjoteKey: data.neakOjoteKey || '', neakWssUser: data.neakWssUser || '', neakWssPassword: data.neakWssPassword || '' });
      }
      if (deptsRes.ok) setNeakDepartments(await deptsRes.json());
      if (levelsRes.ok) setNeakLevels(await levelsRes.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (section === 'neak') loadNeakData();
  }, [section, loadNeakData]);

  useEffect(() => {
    if (section === 'calendar') {
      fetchAppointmentTypes();
      fetchChairs();
    }
  }, [section, fetchAppointmentTypes, fetchChairs]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (file.size > 200 * 1024) {
      setLogoError(t.settings.clinicLogoTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > 400 || h > 200) {
          const ratio = Math.min(400 / w, 200 / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
          setFormData({
            ...formData,
            clinic: { ...formData.clinic, logo: dataUrl },
          });
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleLogoDelete = () => {
    setFormData({
      ...formData,
      clinic: { ...formData.clinic, logo: undefined },
    });
  };

  const loadDoctors = useCallback(async () => {
    try {
      const res = await fetch('/backend/doctors', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json() as DoctorRow[];
        setDoctorRows(data);
        const mapped: Doctor[] = data.map((d) => ({ id: d.doctorId, name: d.doctorName, stampNumber: d.doctorNum }));
        setFormDataRaw((prev) => ({ ...prev, doctors: mapped }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    setFormDataRaw(settings);
  }, [settings]);

  const handleSave = async () => {
    await handleSaveDoctors();
    // Save invoice settings to backend
    try {
      await fetch('/backend/invoice-settings', {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceType: formData.invoice.invoiceType,
          defaultComment: formData.invoice.defaultComment,
          defaultVatRate: String(formData.invoice.defaultVatRate),
          defaultPaymentMethod: formData.invoice.defaultPaymentMethod,
          invoiceMode: formData.invoice.invoiceMode || 'test',
          agentKeyLive: formData.invoice.agentKeyLive || '',
          agentKeyTest: formData.invoice.agentKeyTest || '',
        }),
      });
    } catch { /* ignore */ }
    updateSettings({ ...formData, language: appLanguage });
    setIsDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClinicChange = (field: keyof Settings['clinic'], value: string | boolean) => {
    setFormData({
      ...formData,
      clinic: {
        ...formData.clinic,
        [field]: value,
      },
    });
  };

  const handlePdfLangChange = (lang: 'hu' | 'en' | 'de', field: 'footerText' | 'warrantyText', value: string) => {
    setFormData({
      ...formData,
      pdf: {
        ...formData.pdf,
        [lang]: {
          ...formData.pdf[lang],
          [field]: value,
        },
      },
    });
  };

  const handlePatientChange = (field: keyof Settings['patient'], value: string | string[]) => {
    setFormData({
      ...formData,
      patient: {
        ...formData.patient,
        [field]: value,
      },
    });
  };

  const handleInvoiceChange = (field: keyof Settings['invoice'], value: string | number) => {
    setFormData({
      ...formData,
      invoice: {
        ...formData.invoice,
        [field]: value,
      },
    });
  };

  const handleDoctorChange = (doctorId: string, field: 'name' | 'stampNumber', value: string) => {
    setIsDirty(true);  // doctorRows not covered by setFormData wrapper
    setDoctorRows((prev) => prev.map((d) =>
      d.doctorId === doctorId
        ? { ...d, ...(field === 'name' ? { doctorName: value } : { doctorNum: value }) }
        : d
    ));
    setFormData({
      ...formData,
      doctors: formData.doctors.map((doc) =>
        doc.id === doctorId ? { ...doc, [field]: value } : doc
      ),
    });
  };

  const handleAddDoctor = async () => {
    try {
      const res = await fetch('/backend/doctors', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorName: '', doctorNum: '' }),
      });
      if (res.ok) {
        await loadDoctors();
      }
    } catch { /* ignore */ }
  };

  const handleRemoveDoctor = async (doctorId: string) => {
    if (doctorRows.length <= 1) return;
    try {
      await fetch(`/backend/doctors/${encodeURIComponent(doctorId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      await loadDoctors();
    } catch { /* ignore */ }
  };

  const handleSaveDoctors = async () => {
    for (const doc of doctorRows) {
      try {
        await fetch(`/backend/doctors/${encodeURIComponent(doc.doctorId)}`, {
          method: 'PUT',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ doctorName: doc.doctorName, doctorNum: doc.doctorNum }),
        });
      } catch { /* ignore */ }
    }
  };

  const handleTaxCheck = async () => {
    const taxNum = formData.clinic.taxNumber || '';
    const digits = taxNum.replace(/\D/g, '');
    if (digits.length < 8) return;
    setTaxChecking(true);
    setTaxResult(null);
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
        setTaxResult(t.settings.taxValid);
        setFormData(prev => ({
          ...prev,
          clinic: {
            ...prev.clinic,
            name: name || prev.clinic.name,
            address: addrStr || prev.clinic.address,
          },
        }));
      } else if (data.success && !data.valid) {
        setTaxResult(t.settings.taxInvalid);
      } else {
        setTaxResult(data.message || t.settings.taxCheckFailed);
      }
    } catch {
      setTaxResult(t.settings.taxCheckFailed);
    } finally {
      setTaxChecking(false);
    }
  };

  const tabs: PageTab[] = [
    { key: 'overview', to: '/settings', label: t.settings.tabOverview, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
    { key: 'general', to: '/settings/general', label: t.settings.tabGeneral, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { key: 'clinic', to: '/settings/clinic', label: t.settings.tabClinic, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { key: 'patient', to: '/settings/patient', label: t.settings.tabPatient, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { key: 'calendar', to: '/settings/calendar', label: t.settings.tabCalendar, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { key: 'quotes', to: '/settings/quotes', label: t.settings.tabQuotes, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { key: 'invoicing', to: '/settings/invoicing', label: t.settings.tabInvoicing, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { key: 'neak', to: '/settings/neak', label: t.settings.tabNeak, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
  ];

  const overviewCards: Array<{ key: SettingsSection; to: string; title: string; description: string; icon: React.ReactNode }> = [
    {
      key: 'general',
      to: '/settings/general',
      title: t.settings.generalSettings,
      description: t.settings.overviewGeneralDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: 'clinic',
      to: '/settings/clinic',
      title: t.settings.clinicSettings,
      description: t.settings.overviewClinicDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      key: 'patient',
      to: '/settings/patient',
      title: t.settings.patientSettings,
      description: t.settings.overviewPatientDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: 'calendar',
      to: '/settings/calendar',
      title: t.settings.calendarSettings,
      description: t.settings.overviewCalendarDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: 'quotes',
      to: '/settings/quotes',
      title: t.settings.quoteSettings,
      description: t.settings.overviewQuotesDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: 'invoicing',
      to: '/settings/invoicing',
      title: t.settings.invoiceSettings,
      description: t.settings.overviewInvoicingDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      key: 'neak',
      to: '/settings/neak',
      title: t.settings.neakOjoteTitle,
      description: t.settings.overviewNeakDesc,
      icon: (
        <svg className="w-8 h-8 text-dental-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  const taxDigits = (formData.clinic.taxNumber || '').replace(/\D/g, '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.settings.title}</h1>
          <p className="text-gray-500 mt-1">{t.settings.subtitle}</p>
        </div>
        {section && section !== 'neak' && (
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-green-600 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t.settings.saved}
              </span>
            )}
            <Button onClick={handleSave}>{t.common.save}</Button>
          </div>
        )}
      </div>

      <PageTabBar tabs={tabs} />

      <div className={section ? 'max-w-4xl' : ''}>
        {/* Overview card grid */}
        {!section && (
          <div className="max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            {overviewCards.map((card) => (
              <Link
                key={card.key}
                to={card.to}
                className="block rounded-lg border border-gray-200 bg-white p-5 hover:border-dental-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">{card.icon}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{card.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* General section */}
        {section === 'general' && (
          <>
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t.settings.generalSettings}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label={t.settings.language}
                  value={appLanguage}
                  onChange={(e) => { setIsDirty(true); setAppLanguage(e.target.value as 'hu' | 'en' | 'de'); }}
                  options={[
                    { value: 'hu', label: t.settings.hungarian },
                    { value: 'en', label: t.settings.english },
                    { value: 'de', label: t.settings.german },
                  ]}
                />
                <Select
                  label={t.settings.dateFormat}
                  value={formData.dateFormat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dateFormat: e.target.value as DateFormat,
                    })
                  }
                  options={DATE_FORMAT_OPTIONS.map((format) => ({
                    value: format,
                    label: `${formatDateTimeWithPattern(today, format)}`,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6m-6 0a2 2 0 00-2 2v2a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2m-6 0v2m6-2v2M7 11h10m-9 4h8m-7 4h6" />
                  </svg>
                  {t.settings.odontogramSettings}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label={t.settings.odontogramNumbering}
                  value={odontogramNumbering}
                  onChange={(e) =>
                    { setIsDirty(true); setOdontogramNumbering(e.target.value as 'FDI' | 'UNIVERSAL' | 'PALMER'); }
                  }
                  options={[
                    { value: 'FDI', label: t.settings.odontogramNumberingFdi },
                    { value: 'UNIVERSAL', label: t.settings.odontogramNumberingUniversal },
                    { value: 'PALMER', label: t.settings.odontogramNumberingPalmer },
                  ]}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Clinic section */}
        {section === 'clinic' && (
          <>
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {t.settings.clinicSettings}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t.settings.clinicName}
                    value={formData.clinic.name}
                    onChange={(e) => handleClinicChange('name', e.target.value)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.settings.clinicTaxNumber}
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={formData.clinic.taxNumber || ''}
                        onChange={(e) => handleClinicChange('taxNumber', e.target.value)}
                        placeholder={t.settings.taxNumberPlaceholder}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-dental-500"
                      />
                      {taxDigits.length >= 8 && (
                        <button
                          type="button"
                          onClick={handleTaxCheck}
                          disabled={taxChecking}
                          className="px-3 py-2 rounded-lg bg-dental-600 text-white text-sm hover:bg-dental-700 disabled:opacity-50 flex items-center gap-1"
                          title={t.settings.taxCheckButton}
                        >
                          {taxChecking ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                    {taxResult && (
                      <p className={`text-xs mt-1 ${taxResult === t.settings.taxValid || taxResult === t.settings.taxAutoFilled ? 'text-green-600' : 'text-red-600'}`}>
                        {taxResult}
                      </p>
                    )}
                  </div>
                </div>
                <Input
                  label={t.settings.clinicAddress}
                  value={formData.clinic.address}
                  onChange={(e) => handleClinicChange('address', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t.settings.clinicPhone}
                    value={formData.clinic.phone}
                    onChange={(e) => handleClinicChange('phone', e.target.value)}
                  />
                  <Input
                    label={t.settings.clinicEmail}
                    type="email"
                    value={formData.clinic.email}
                    onChange={(e) => handleClinicChange('email', e.target.value)}
                  />
                </div>
                <Input
                  label={t.settings.clinicWebsite}
                  value={formData.clinic.website}
                  onChange={(e) => handleClinicChange('website', e.target.value)}
                />

                {/* Logo section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.settings.clinicLogo}</label>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-16 border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                      {formData.clinic.logo ? (
                        <img src={formData.clinic.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400">{t.settings.clinicLogoNone}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Button variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()}>
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {t.settings.clinicLogoUpload}
                      </Button>
                      {formData.clinic.logo && (
                        <Button variant="danger" size="sm" onClick={handleLogoDelete}>
                          {t.settings.clinicLogoDelete}
                        </Button>
                      )}
                    </div>
                  </div>
                  {logoError && <p className="text-xs text-red-600 mt-1">{logoError}</p>}
                  {formData.clinic.logo && (
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={formData.clinic.showLogoOnQuote ?? false}
                        onChange={(e) => handleClinicChange('showLogoOnQuote', e.target.checked)}
                      />
                      <span className="text-sm text-gray-700">{t.settings.showLogoOnQuote}</span>
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {t.settings.doctorsSettings}
                  </h2>
                  <Button variant="secondary" onClick={handleAddDoctor}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t.settings.addDoctor}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {doctorRows.map((doctor, index) => (
                  <div key={doctor.doctorId} className="flex items-end gap-3">
                    <div className="flex-1">
                      <Input
                        label={`${t.settings.doctorName} ${index + 1}`}
                        value={doctor.doctorName}
                        onChange={(e) => handleDoctorChange(doctor.doctorId, 'name', e.target.value)}
                        placeholder={t.settings.doctorNamePlaceholder}
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        label={t.settings.doctorStampNumber}
                        value={doctor.doctorNum || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          handleDoctorChange(doctor.doctorId, 'stampNumber', value);
                        }}
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>
                    {doctorRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDoctor(doctor.doctorId)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg mb-1"
                        title={t.settings.removeDoctor}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {/* Patient section */}
        {section === 'patient' && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t.settings.patientSettings}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label={t.settings.defaultCountry}
                value={formData.patient.defaultCountry}
                onChange={(e) => handlePatientChange('defaultCountry', e.target.value)}
                options={countriesList.map((c) => ({
                  value: String(c.countryId),
                  label: appLanguage === 'de' ? c.countryNameDe : appLanguage === 'en' ? c.countryNameEn : c.countryNameHu,
                }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.settings.patientTypes}
                </label>
                <div className="space-y-2">
                  {formData.patient.patientTypes.map((pt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={pt}
                        onChange={(e) => {
                          const newTypes = [...formData.patient.patientTypes];
                          newTypes[index] = e.target.value;
                          setFormData({
                            ...formData,
                            patient: { ...formData.patient, patientTypes: newTypes },
                          });
                        }}
                      />
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => {
                          if (index === 0) return;
                          const newTypes = [...formData.patient.patientTypes];
                          const [item] = newTypes.splice(index, 1);
                          newTypes.unshift(item);
                          setFormData({
                            ...formData,
                            patient: { ...formData.patient, patientTypes: newTypes },
                          });
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          index === 0
                            ? 'text-amber-500 cursor-default'
                            : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'
                        }`}
                        title={index === 0 ? t.settings.defaultPatientType : t.settings.setDefaultPatientType}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={index === 0 ? 'currentColor' : 'none'}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                      {formData.patient.patientTypes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newTypes = formData.patient.patientTypes.filter((_, i) => i !== index);
                            setFormData({
                              ...formData,
                              patient: { ...formData.patient, patientTypes: newTypes },
                            });
                          }}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title={t.settings.removePatientType}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      patient: {
                        ...formData.patient,
                        patientTypes: [...formData.patient.patientTypes, ''],
                      },
                    });
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t.settings.addPatientType}
                </Button>
              </div>

              <Select
                label={t.settings.patientsPerPageLabel}
                value={String(formData.patient.perPage || 50)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    patient: { ...formData.patient, perPage: Number(e.target.value) },
                  })
                }
                options={[
                  { value: '20', label: '20' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' },
                ]}
              />
            </CardContent>
          </Card>
        )}

        {/* Quotes section */}
        {section === 'quotes' && (
          <>
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t.settings.quoteSettings}
                </h2>
              </CardHeader>
              <CardContent className="space-y-6">
                <Select
                  label={t.settings.quoteLang}
                  value={formData.quote.quoteLang || 'hu'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quote: { ...formData.quote, quoteLang: e.target.value as 'hu' | 'en' | 'de' },
                    })
                  }
                  options={[
                    { value: 'hu', label: 'Magyar' },
                    { value: 'en', label: 'English' },
                    { value: 'de', label: 'Deutsch' },
                  ]}
                />

                <Input
                  label={t.settings.defaultValidityDays}
                  type="number"
                  value={formData.defaultValidityDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultValidityDays: parseInt(e.target.value) || 60,
                    })
                  }
                  min={1}
                  max={365}
                  helperText={t.settings.defaultValidityDaysHelp}
                />

                <Select
                  label={t.settings.pdfFont}
                  value={formData.pdf.pdfFont || 'Roboto'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pdf: { ...formData.pdf, pdfFont: e.target.value as PdfFontFamily },
                    })
                  }
                  options={[
                    { value: 'Inter', label: 'Inter' },
                    { value: 'JetBrains Mono', label: 'JetBrains Mono' },
                    { value: 'Noto Sans', label: 'Noto Sans' },
                    { value: 'Noto Serif', label: 'Noto Serif' },
                    { value: 'Roboto', label: 'Roboto' },
                    { value: 'Source Sans 3', label: 'Source Sans 3' },
                    { value: 'Source Serif 4', label: 'Source Serif 4' },
                  ]}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      label={t.settings.quotePrefix}
                      value={formData.quote.prefix}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
                        setFormData({
                          ...formData,
                          quote: { ...formData.quote, prefix: value },
                        });
                      }}
                      maxLength={4}
                      placeholder="ABCD"
                      helperText={t.settings.quotePrefixHelp}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.settings.quoteCounter}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">{formData.quote.counter}</span>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setResetCounterConfirm(true)}
                      >
                        {t.settings.resetCounter}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t.settings.quoteCounterHelp}</p>
                  </div>
                </div>

                <Select
                  label={t.settings.quotesPerPageLabel}
                  value={String(formData.quote.perPage || 50)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quote: { ...formData.quote, perPage: Number(e.target.value) },
                    })
                  }
                  options={[
                    { value: '20', label: '20' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                  ]}
                />

                {/* Statistics */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">{t.settings.quoteStatistics}</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1 border-b">
                        <span className="text-gray-600">{t.settings.statTotal}</span>
                        <span className="font-semibold">{quoteStats.total}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b">
                        <span className="text-yellow-600">{t.quotes.statusDraft}</span>
                        <span className="font-semibold">{quoteStats.draft}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b">
                        <span className="text-blue-600">{t.settings.statClosed}</span>
                        <span className="font-semibold">{quoteStats.closed}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b">
                        <span className="text-green-600">{t.settings.statStarted}</span>
                        <span className="font-semibold">{quoteStats.started}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b">
                        <span className="text-gray-600">{t.settings.statCompleted}</span>
                        <span className="font-semibold">{quoteStats.completed}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b">
                        <span className="text-red-600">{t.settings.statRejected}</span>
                        <span className="font-semibold">{quoteStats.rejected}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-400">{t.settings.statDeleted}</span>
                        <span className="font-semibold text-gray-400">{quoteStats.deleted}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="relative w-40 h-40">
                        {quoteStats.total > 0 ? (
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            {(() => {
                              const total = quoteStats.draft + quoteStats.closed +
                                           quoteStats.started + quoteStats.completed + quoteStats.rejected;
                              if (total === 0) return <circle cx="50" cy="50" r="40" fill="#e5e7eb" />;

                              let currentAngle = 0;
                              const segments = [
                                { value: quoteStats.draft, color: '#fbbf24' },
                                { value: quoteStats.closed, color: '#3b82f6' },
                                { value: quoteStats.started, color: '#22c55e' },
                                { value: quoteStats.completed, color: '#9ca3af' },
                                { value: quoteStats.rejected, color: '#ef4444' },
                              ].filter(s => s.value > 0);

                              return segments.map((segment, idx) => {
                                const percentage = (segment.value / total) * 100;
                                const strokeDasharray = `${percentage * 2.51327} ${251.327 - percentage * 2.51327}`;
                                const strokeDashoffset = -currentAngle * 2.51327;
                                currentAngle += percentage;

                                return (
                                  <circle
                                    key={idx}
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="none"
                                    stroke={segment.color}
                                    strokeWidth="20"
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                  />
                                );
                              });
                            })()}
                          </svg>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            {t.settings.noQuotesYet}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {t.settings.pdfSettings}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex border-b border-gray-200">
                  {(['hu', 'en', 'de'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setPdfLangTab(lang)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        pdfLangTab === lang
                          ? 'border-dental-500 text-dental-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {lang === 'hu' ? 'Magyar' : lang === 'en' ? 'English' : 'Deutsch'}
                    </button>
                  ))}
                </div>
                <TextArea
                  label={t.settings.footerText}
                  value={formData.pdf[pdfLangTab]?.footerText || ''}
                  onChange={(e) => handlePdfLangChange(pdfLangTab, 'footerText', e.target.value)}
                  rows={3}
                  helperText={t.settings.footerTextHelp}
                />
                <TextArea
                  label={t.settings.warrantyText}
                  value={formData.pdf[pdfLangTab]?.warrantyText || ''}
                  onChange={(e) => handlePdfLangChange(pdfLangTab, 'warrantyText', e.target.value)}
                  rows={20}
                  helperText={t.settings.warrantyTextHelp}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Invoicing section */}
        {section === 'invoicing' && (
          <>
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t.settings.invoiceSettings}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label={t.settings.invoiceType}
                  value={formData.invoice.invoiceType}
                  onChange={(e) => handleInvoiceChange('invoiceType', e.target.value)}
                  options={[
                    { value: 'paper', label: t.settings.invoiceTypePaper },
                    { value: 'electronic', label: t.settings.invoiceTypeElectronic },
                  ]}
                />
                <TextArea
                  label={t.settings.invoiceComment}
                  value={formData.invoice.defaultComment}
                  onChange={(e) => handleInvoiceChange('defaultComment', e.target.value)}
                  rows={3}
                  helperText={t.settings.invoiceCommentHelp}
                />
                <Select
                  label={t.settings.defaultPaymentMethod}
                  value={formData.invoice.defaultPaymentMethod || 'bankkártya'}
                  onChange={(e) => handleInvoiceChange('defaultPaymentMethod', e.target.value)}
                  options={[
                    { value: 'átutalás', label: t.invoices.paymentTransfer },
                    { value: 'készpénz', label: t.invoices.paymentCash },
                    { value: 'bankkártya', label: t.invoices.paymentCard },
                  ]}
                />
                <Select
                  label={t.settings.defaultVatRate}
                  value={String(formData.invoice.defaultVatRate)}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleInvoiceChange('defaultVatRate', v === 'TAM' ? 'TAM' : Number(v));
                  }}
                  options={[
                    { value: 'TAM', label: 'TAM (tárgyi adómentes)' },
                    { value: '0', label: '0%' },
                    { value: '27', label: '27%' },
                  ]}
                />
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {t.settings.szamlazzSettings}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label={t.settings.invoiceMode}
                  value={formData.invoice.invoiceMode || 'test'}
                  onChange={(e) => { handleInvoiceChange('invoiceMode', e.target.value); setApiTestResult(null); }}
                  options={[
                    { value: 'live', label: t.settings.invoiceModeLive },
                    { value: 'test', label: t.settings.invoiceModeTest },
                  ]}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.agentKeyLive}</label>
                  <div className="flex gap-1">
                    <input
                      type={showAgentKeyLive ? 'text' : 'password'}
                      value={formData.invoice.agentKeyLive || ''}
                      onChange={(e) => handleInvoiceChange('agentKeyLive', e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-dental-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAgentKeyLive(!showAgentKeyLive)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
                    >
                      {showAgentKeyLive ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.agentKeyTest}</label>
                  <div className="flex gap-1">
                    <input
                      type={showAgentKeyTest ? 'text' : 'password'}
                      value={formData.invoice.agentKeyTest || ''}
                      onChange={(e) => handleInvoiceChange('agentKeyTest', e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-dental-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAgentKeyTest(!showAgentKeyTest)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
                    >
                      {showAgentKeyTest ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {t.settings.szamlazzApiTest}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setApiTestLoading(true);
                    setApiTestResult(null);
                    try {
                      const currentMode = formData.invoice.invoiceMode || 'test';
                      const currentKey = currentMode === 'live' ? formData.invoice.agentKeyLive : formData.invoice.agentKeyTest;
                      const res = await fetch('/backend/api/szamlazz/test', {
                        method: 'POST',
                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mode: currentMode, agentKey: currentKey || '' }),
                      });
                      const data = await res.json();
                      setApiTestResult(data);
                    } catch (err) {
                      setApiTestResult({ success: false, mode: '?', message: String(err) });
                    } finally {
                      setApiTestLoading(false);
                    }
                  }}
                  disabled={apiTestLoading}
                >
                  {apiTestLoading ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t.settings.szamlazzApiTesting}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t.settings.szamlazzApiTestButton}
                    </>
                  )}
                </Button>
                {apiTestResult && (
                  <div className={`rounded-lg border p-4 text-sm ${apiTestResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {apiTestResult.success ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      )}
                      <span className={`font-semibold ${apiTestResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {apiTestResult.success ? 'OK' : 'HIBA'}
                      </span>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      <dt className="text-gray-500">{t.settings.szamlazzApiMode}:</dt>
                      <dd className={apiTestResult.success ? 'text-green-800' : 'text-red-800'}>{apiTestResult.mode === 'live' ? t.settings.invoiceModeLive : t.settings.invoiceModeTest}</dd>
                      {apiTestResult.httpStatus && (
                        <>
                          <dt className="text-gray-500">HTTP:</dt>
                          <dd className={apiTestResult.success ? 'text-green-800' : 'text-red-800'}>{apiTestResult.httpStatus}</dd>
                        </>
                      )}
                      <dt className="text-gray-500">{t.settings.szamlazzApiStatus}:</dt>
                      <dd className={apiTestResult.success ? 'text-green-800' : 'text-red-800'}>{apiTestResult.message}</dd>
                    </dl>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* NEAK section */}
        {section === 'neak' && (
          <>
            {/* Card 1: OJOTE Settings */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {t.settings.neakOjoteTitle}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label={t.settings.neakOjoteUsername}
                  value={neakSettings.neakWssUser}
                  onChange={(e) => setNeakSettings({ ...neakSettings, neakWssUser: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.neakOjotePassword}</label>
                  <div className="flex gap-1">
                    <input
                      type={showNeakPassword ? 'text' : 'password'}
                      value={neakSettings.neakWssPassword}
                      onChange={(e) => setNeakSettings({ ...neakSettings, neakWssPassword: e.target.value })}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-dental-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNeakPassword(!showNeakPassword)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
                    >
                      {showNeakPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                <Input
                  label={t.settings.neakProviderCode}
                  value={neakSettings.neakOjoteKey}
                  onChange={(e) => setNeakSettings({ ...neakSettings, neakOjoteKey: e.target.value })}
                />
                <div className="flex items-center gap-3">
                  <Button onClick={async () => {
                    try {
                      await fetch('/backend/neak-settings', {
                        method: 'PUT',
                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify(neakSettings),
                      });
                      setNeakSaved(true);
                      setTimeout(() => setNeakSaved(false), 3000);
                    } catch { /* ignore */ }
                  }}>{t.common.save}</Button>
                  {neakSaved && (
                    <span className="text-green-600 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t.settings.neakSettingsSaved}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card 2: NEAK API Test */}
            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {t.settings.neakApiTestTitle}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setNeakApiTestLoading(true);
                    setNeakApiTestResult(null);
                    try {
                      const res = await fetch('/backend/api/neak/test', {
                        method: 'POST',
                        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                        body: '{}',
                      });
                      const data = await res.json();
                      setNeakApiTestResult(data);
                    } catch (err) {
                      setNeakApiTestResult({ success: false, message: String(err) });
                    } finally {
                      setNeakApiTestLoading(false);
                    }
                  }}
                  disabled={neakApiTestLoading}
                >
                  {neakApiTestLoading ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t.settings.neakApiTesting}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t.settings.neakApiTestButton}
                    </>
                  )}
                </Button>
                {neakApiTestResult && (
                  <div className={`rounded-lg border p-4 text-sm ${neakApiTestResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {neakApiTestResult.success ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      )}
                      <span className={`font-semibold ${neakApiTestResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {neakApiTestResult.success ? 'OK' : 'HIBA'}
                      </span>
                      <span className={neakApiTestResult.success ? 'text-green-700' : 'text-red-700'}>{neakApiTestResult.message}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 3: NEAK Departments */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {t.settings.neakDepartmentsTitle}
                  </h2>
                  <Button size="sm" onClick={() => {
                    setNewDept({ neakDepartmentNameHu: '', neakDepartmentNameEn: '', neakDepartmentNameDe: '', neakDepartmentCode: '', neakDepartmentHours: 20, neakDepartmentMaxPoints: 100000, neakDepartmentPrefix: '', neakDepartmentLevel: 'A', neakDepartmentIndicator: 'adult' });
                    setShowAddDepartment(true);
                  }}>{t.settings.neakDepartmentAdd}</Button>
                </div>
              </CardHeader>
              <CardContent>
                {neakDepartments.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">{t.common.noResults}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {[
                            { col: 'neakDepartmentNameHu', label: t.settings.neakDepartmentNameHu },
                            { col: 'neakDepartmentCode', label: t.settings.neakDepartmentCode },
                            { col: 'neakDepartmentHours', label: t.settings.neakDepartmentHours },
                            { col: 'neakDepartmentMaxPoints', label: t.settings.neakDepartmentMaxPoints },
                            { col: 'neakDepartmentPrefix', label: t.settings.neakDepartmentPrefix },
                          ].map(({ col, label }) => (
                            <th
                              key={col}
                              className="text-left py-2 px-3 font-medium text-gray-600 cursor-pointer hover:text-dental-700 select-none"
                              onClick={() => {
                                if (deptSortColumn === col) setDeptSortDir(deptSortDir === 'asc' ? 'desc' : 'asc');
                                else { setDeptSortColumn(col); setDeptSortDir('asc'); }
                              }}
                            >
                              <span className="flex items-center gap-1">
                                {label}
                                {deptSortColumn === col && (
                                  <svg className={`w-3 h-3 ${deptSortDir === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                )}
                              </span>
                            </th>
                          ))}
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...neakDepartments]
                          .sort((a, b) => {
                            const aVal = (a as Record<string, unknown>)[deptSortColumn];
                            const bVal = (b as Record<string, unknown>)[deptSortColumn];
                            const cmp = typeof aVal === 'number' && typeof bVal === 'number'
                              ? aVal - bVal
                              : String(aVal ?? '').localeCompare(String(bVal ?? ''), 'hu');
                            return deptSortDir === 'asc' ? cmp : -cmp;
                          })
                          .map((dept) => (
                            <tr key={dept.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3">{dept.neakDepartmentNameHu}</td>
                              <td className="py-2 px-3 font-mono">{dept.neakDepartmentCode}</td>
                              <td className="py-2 px-3">{dept.neakDepartmentHours}</td>
                              <td className="py-2 px-3">{dept.neakDepartmentMaxPoints.toLocaleString('hu-HU')}</td>
                              <td className="py-2 px-3 font-mono">{dept.neakDepartmentPrefix}</td>
                              <td className="py-2 px-3">
                                <button
                                  onClick={() => setDeleteDeptConfirm(dept.id)}
                                  className="text-red-400 hover:text-red-600"
                                  title={t.common.delete}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Department Modal */}
            <Modal
              isOpen={showAddDepartment}
              onClose={() => setShowAddDepartment(false)}
              title={t.settings.neakDepartmentAddTitle}
              size="lg"
            >
              <div className="space-y-4">
                <Input
                  label={t.settings.neakDepartmentNameHu}
                  value={newDept.neakDepartmentNameHu}
                  onChange={(e) => setNewDept({ ...newDept, neakDepartmentNameHu: e.target.value })}
                  required
                />
                <Input
                  label={t.settings.neakDepartmentNameEn}
                  value={newDept.neakDepartmentNameEn}
                  onChange={(e) => setNewDept({ ...newDept, neakDepartmentNameEn: e.target.value })}
                />
                <Input
                  label={t.settings.neakDepartmentNameDe}
                  value={newDept.neakDepartmentNameDe}
                  onChange={(e) => setNewDept({ ...newDept, neakDepartmentNameDe: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.neakDepartmentCode}</label>
                  <input
                    type="text"
                    value={newDept.neakDepartmentCode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 9);
                      setNewDept({ ...newDept, neakDepartmentCode: v });
                    }}
                    pattern="[0-9]{9}"
                    maxLength={9}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-dental-500 font-mono"
                    placeholder="000000000"
                  />
                </div>
                <Select
                  label={t.settings.neakDepartmentHours}
                  value={String(newDept.neakDepartmentHours)}
                  onChange={(e) => setNewDept({ ...newDept, neakDepartmentHours: Number(e.target.value) })}
                  options={Array.from({ length: 36 }, (_, i) => ({ value: String(i + 5), label: String(i + 5) }))}
                />
                <Select
                  label={t.settings.neakDepartmentMaxPoints}
                  value={String(newDept.neakDepartmentMaxPoints)}
                  onChange={(e) => setNewDept({ ...newDept, neakDepartmentMaxPoints: Number(e.target.value) })}
                  options={Array.from({ length: 36 }, (_, i) => {
                    const v = (i + 5) * 10000;
                    return { value: String(v), label: v.toLocaleString('hu-HU') };
                  })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.neakDepartmentPrefix}</label>
                  <input
                    type="text"
                    value={newDept.neakDepartmentPrefix}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
                      setNewDept({ ...newDept, neakDepartmentPrefix: v });
                    }}
                    pattern="[A-Z]{0,2}"
                    maxLength={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-dental-500 font-mono uppercase"
                    placeholder="AB"
                  />
                </div>
                <Select
                  label={t.settings.neakDepartmentLevel}
                  value={newDept.neakDepartmentLevel}
                  onChange={(e) => setNewDept({ ...newDept, neakDepartmentLevel: e.target.value })}
                  options={neakLevels.length > 0
                    ? neakLevels.map((lv) => ({ value: lv.neakLevelCode, label: `${lv.neakLevelCode} - ${lv.neakLevelInfoHu}` }))
                    : [{ value: 'A', label: 'A - Alapellátás' }, { value: 'S', label: 'S - Szakellátás' }, { value: 'T', label: 'T - Területi ellátás' }, { value: 'E', label: 'E - Egyéb' }]
                  }
                />
                <Select
                  label={t.settings.neakDepartmentIndicator}
                  value={newDept.neakDepartmentIndicator}
                  onChange={(e) => setNewDept({ ...newDept, neakDepartmentIndicator: e.target.value })}
                  options={[
                    { value: 'adult', label: t.settings.neakIndicatorAdult },
                    { value: 'child', label: t.settings.neakIndicatorChild },
                  ]}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setShowAddDepartment(false)}>{t.common.cancel}</Button>
                  <Button
                    onClick={async () => {
                      if (!newDept.neakDepartmentNameHu.trim()) return;
                      try {
                        const res = await fetch('/backend/neak-departments', {
                          method: 'POST',
                          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                          body: JSON.stringify(newDept),
                        });
                        if (res.ok) {
                          setShowAddDepartment(false);
                          loadNeakData();
                        }
                      } catch { /* ignore */ }
                    }}
                    disabled={!newDept.neakDepartmentNameHu.trim()}
                  >
                    {t.common.save}
                  </Button>
                </div>
              </div>
            </Modal>

            {/* Delete Department Confirmation */}
            <ConfirmModal
              isOpen={deleteDeptConfirm !== null}
              onClose={() => setDeleteDeptConfirm(null)}
              onConfirm={async () => {
                if (!deleteDeptConfirm) return;
                try {
                  await fetch(`/backend/neak-departments/${encodeURIComponent(deleteDeptConfirm)}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders(),
                  });
                  setDeleteDeptConfirm(null);
                  loadNeakData();
                } catch { /* ignore */ }
              }}
              title={t.common.confirm}
              message={t.settings.neakDepartmentDeleteConfirm}
              confirmText={t.common.delete}
              cancelText={t.common.cancel}
              variant="danger"
            />
          </>
        )}

        {section === 'calendar' && (
          <>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {t.calendar.settingsTitle}
                </h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Slot interval + default duration */}
                <div className="grid grid-cols-3 gap-4">
                  <Select
                    label={t.calendar.slotInterval}
                    value={String(formData.calendar?.slotInterval || 15)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        calendar: { ...formData.calendar, slotInterval: Number(e.target.value) },
                      })
                    }
                    options={(formData.calendar?.slotIntervalOptions || [5, 10, 15, 30, 45, 60, 90, 120, 150]).map(
                      (n: number) => ({ value: String(n), label: `${n} ${t.calendar.minutes}` })
                    )}
                  />
                  <Input
                    label={`${t.calendar.defaultDuration} (${t.calendar.minutes})`}
                    type="number"
                    value={String(formData.calendar?.defaultDuration || 30)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        calendar: { ...formData.calendar, defaultDuration: Number(e.target.value) || 30 },
                      })
                    }
                  />
                  <Select
                    label={t.calendar.defaultView}
                    value={formData.calendar?.defaultView || 'week'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        calendar: { ...formData.calendar, defaultView: e.target.value as 'week' | 'day' | 'month' },
                      })
                    }
                    options={[
                      { value: 'week', label: t.calendar.viewWeek },
                      { value: 'day', label: t.calendar.viewDay },
                      { value: 'month', label: t.calendar.viewMonth },
                    ]}
                  />
                </div>

                {/* Show weekends */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.calendar?.showWeekends !== false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          calendar: { ...formData.calendar, showWeekends: e.target.checked },
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{t.calendar.showWeekends}</span>
                  </label>
                </div>

                {/* Working hours */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">{t.calendar.workingHours}</h3>
                  <div className="space-y-2">
                    {(() => {
                      const rawHours = formData.calendar?.workingHours?.length ? formData.calendar.workingHours : [
                        { dayOfWeek: 0, isWorkday: false, startTime: '08:00', endTime: '16:00' },
                        { dayOfWeek: 1, isWorkday: true, startTime: '08:00', endTime: '16:00' },
                        { dayOfWeek: 2, isWorkday: true, startTime: '08:00', endTime: '16:00' },
                        { dayOfWeek: 3, isWorkday: true, startTime: '08:00', endTime: '16:00' },
                        { dayOfWeek: 4, isWorkday: true, startTime: '08:00', endTime: '16:00' },
                        { dayOfWeek: 5, isWorkday: true, startTime: '08:00', endTime: '14:00' },
                        { dayOfWeek: 6, isWorkday: false, startTime: '08:00', endTime: '14:00' },
                      ];
                      // Reorder: Monday(1)..Saturday(6), Sunday(0)
                      const mondayFirst = [...rawHours.filter(h => h.dayOfWeek !== 0), ...rawHours.filter(h => h.dayOfWeek === 0)];
                      return mondayFirst;
                    })().map((wh: { dayOfWeek: number; isWorkday: boolean; startTime: string; endTime: string; breakStartTime?: string; breakEndTime?: string }) => {
                      const dayNames: Record<string, string[]> = {
                        hu: ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'],
                        en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                        de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
                      };
                      const names = dayNames[appLanguage] || dayNames.hu;
                      const updateWh = (field: string, value: unknown) => {
                        const defaults = [
                          { dayOfWeek: 0, isWorkday: false, startTime: '08:00', endTime: '16:00' },
                          { dayOfWeek: 1, isWorkday: true, startTime: '08:00', endTime: '16:00' },
                          { dayOfWeek: 2, isWorkday: true, startTime: '08:00', endTime: '16:00' },
                          { dayOfWeek: 3, isWorkday: true, startTime: '08:00', endTime: '16:00' },
                          { dayOfWeek: 4, isWorkday: true, startTime: '08:00', endTime: '16:00' },
                          { dayOfWeek: 5, isWorkday: true, startTime: '08:00', endTime: '14:00' },
                          { dayOfWeek: 6, isWorkday: false, startTime: '08:00', endTime: '14:00' },
                        ];
                        const hours = formData.calendar?.workingHours?.length
                          ? [...formData.calendar.workingHours]
                          : [...defaults];
                        const arrIdx = hours.findIndex(h => h.dayOfWeek === wh.dayOfWeek);
                        if (arrIdx >= 0) hours[arrIdx] = { ...hours[arrIdx], [field]: value };
                        setFormData({
                          ...formData,
                          calendar: { ...formData.calendar, workingHours: hours },
                        });
                      };
                      return (
                        <div key={wh.dayOfWeek} className="flex items-center gap-3 text-sm">
                          <label className="flex items-center gap-2 w-32">
                            <input
                              type="checkbox"
                              checked={wh.isWorkday}
                              onChange={(e) => updateWh('isWorkday', e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span className={wh.isWorkday ? 'font-medium' : 'text-gray-400'}>{names[wh.dayOfWeek]}</span>
                          </label>
                          <input
                            type="time"
                            value={wh.startTime}
                            onChange={(e) => updateWh('startTime', e.target.value)}
                            className={`px-2 py-1 border border-gray-300 rounded text-sm ${!wh.isWorkday ? 'opacity-40' : ''}`}
                          />
                          <span className="text-gray-400">–</span>
                          <input
                            type="time"
                            value={wh.endTime}
                            onChange={(e) => updateWh('endTime', e.target.value)}
                            className={`px-2 py-1 border border-gray-300 rounded text-sm ${!wh.isWorkday ? 'opacity-40' : ''}`}
                          />
                          <span className="text-gray-300 ml-2">|</span>
                          <span className="text-xs text-gray-400">{t.calendar.breakStart}:</span>
                          <input
                            type="time"
                            value={wh.breakStartTime || ''}
                            onChange={(e) => updateWh('breakStartTime', e.target.value || undefined)}
                            className={`px-2 py-1 border border-gray-300 rounded text-sm w-24 ${!wh.isWorkday ? 'opacity-40' : ''}`}
                          />
                          <span className="text-xs text-gray-400">{t.calendar.breakEnd}:</span>
                          <input
                            type="time"
                            value={wh.breakEndTime || ''}
                            onChange={(e) => updateWh('breakEndTime', e.target.value || undefined)}
                            className={`px-2 py-1 border border-gray-300 rounded text-sm w-24 ${!wh.isWorkday ? 'opacity-40' : ''}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dental Chairs */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {t.calendar.chairsTitle}
                </h2>
                <Button size="sm" disabled={chairs.length >= 7} onClick={() => {
                  setEditingChair(null);
                  setChairForm({ chairNameHu: '', chairNameEn: '', chairNameDe: '', isActive: true });
                  setChairModalOpen(true);
                }}>{t.calendar.addChair}</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.calendar.chairNumber}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.calendar.chairName}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.calendar.status}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t.common.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {chairs.map((chair) => {
                      const name = appLanguage === 'en' && chair.chairNameEn ? chair.chairNameEn : appLanguage === 'de' && chair.chairNameDe ? chair.chairNameDe : chair.chairNameHu;
                      return (
                        <tr key={chair.chairId} className={chair.isActive ? '' : 'opacity-50'}>
                          <td className="px-4 py-3 text-sm text-gray-600">{chair.chairNr}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{name}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs ${chair.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {chair.isActive ? t.common.active : t.common.inactive}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => {
                                setEditingChair(chair);
                                setChairForm({ chairNameHu: chair.chairNameHu, chairNameEn: chair.chairNameEn, chairNameDe: chair.chairNameDe, isActive: chair.isActive });
                                setChairModalOpen(true);
                              }}>{t.common.edit}</Button>
                              <Button variant="danger" size="sm" disabled={chairs.length <= 1} onClick={async () => {
                                if (!confirm(t.calendar.deleteChairConfirm)) return;
                                await deleteChair(chair.chairId);
                                fetchChairs();
                              }}>{t.common.delete}</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {chairs.length >= 7 && (
                <p className="text-xs text-amber-600 mt-2">{t.calendar.maxSevenChairs}</p>
              )}
            </CardContent>
          </Card>

          {/* Chair Edit Modal */}
          <Modal isOpen={chairModalOpen} onClose={() => setChairModalOpen(false)} title={editingChair ? t.calendar.editChair : t.calendar.addChair}>
            <div className="space-y-4">
              <Input label={`${t.calendar.chairName} (HU)`} value={chairForm.chairNameHu} onChange={(e) => setChairForm({ ...chairForm, chairNameHu: e.target.value })} />
              <Input label={`${t.calendar.chairName} (EN)`} value={chairForm.chairNameEn} onChange={(e) => setChairForm({ ...chairForm, chairNameEn: e.target.value })} />
              <Input label={`${t.calendar.chairName} (DE)`} value={chairForm.chairNameDe} onChange={(e) => setChairForm({ ...chairForm, chairNameDe: e.target.value })} />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={chairForm.isActive} onChange={(e) => setChairForm({ ...chairForm, isActive: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">{t.common.active}</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setChairModalOpen(false)}>{t.common.cancel}</Button>
                <Button disabled={!chairForm.chairNameHu} onClick={async () => {
                  if (editingChair) {
                    await updateChair(editingChair.chairId, chairForm);
                  } else {
                    await createChair(chairForm);
                  }
                  setChairModalOpen(false);
                  fetchChairs();
                }}>{t.common.save}</Button>
              </div>
            </div>
          </Modal>

          {/* Appointment Types */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {t.calendar.typesTitle}
                </h2>
                <Button size="sm" onClick={() => {
                  setEditingType(null);
                  setTypeForm({ nameHu: '', nameEn: '', nameDe: '', color: '#3B82F6', defaultDurationMin: 30, sortOrder: (appointmentTypes.length + 1) * 10, isActive: true });
                  setTypeModalOpen(true);
                }}>{t.calendar.addType}</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.calendar.typeColor}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.calendar.typeName}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.calendar.typeDefaultDuration}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.calendar.status}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t.common.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {appointmentTypes.map((type) => {
                      const name = appLanguage === 'en' && type.nameEn ? type.nameEn : appLanguage === 'de' && type.nameDe ? type.nameDe : type.nameHu;
                      return (
                        <tr key={type.typeId} className={type.isActive ? '' : 'opacity-50'}>
                          <td className="px-4 py-3"><div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: type.color }} /></td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {name}
                            {type.isSystem && <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t.calendar.typeSystem}</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{type.defaultDurationMin} {t.calendar.minutes}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs ${type.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {type.isActive ? t.common.active : t.common.inactive}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => {
                                setEditingType(type);
                                setTypeForm({ nameHu: type.nameHu, nameEn: type.nameEn, nameDe: type.nameDe, color: type.color, defaultDurationMin: type.defaultDurationMin, sortOrder: type.sortOrder, isActive: type.isActive });
                                setTypeModalOpen(true);
                              }}>{t.common.edit}</Button>
                              {!type.isSystem && (
                                <Button variant="danger" size="sm" onClick={async () => {
                                  if (!confirm(t.calendar.deleteConfirm)) return;
                                  await deleteAppointmentType(type.typeId);
                                  fetchAppointmentTypes();
                                }}>{t.common.delete}</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Type Edit Modal */}
          <Modal isOpen={typeModalOpen} onClose={() => setTypeModalOpen(false)} title={editingType ? t.calendar.editType : t.calendar.addType}>
            <div className="space-y-4">
              <Input label={`${t.calendar.typeName} (HU)`} value={typeForm.nameHu} onChange={(e) => setTypeForm({ ...typeForm, nameHu: e.target.value })} />
              <Input label={`${t.calendar.typeName} (EN)`} value={typeForm.nameEn} onChange={(e) => setTypeForm({ ...typeForm, nameEn: e.target.value })} />
              <Input label={`${t.calendar.typeName} (DE)`} value={typeForm.nameDe} onChange={(e) => setTypeForm({ ...typeForm, nameDe: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.calendar.typeColor}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={typeForm.color} onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })} className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
                    <input type="text" value={typeForm.color} onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
                <Input label={`${t.calendar.typeDefaultDuration} (${t.calendar.minutes})`} type="number" value={String(typeForm.defaultDurationMin)} onChange={(e) => setTypeForm({ ...typeForm, defaultDurationMin: Number(e.target.value) || 30 })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Sort order" type="number" value={String(typeForm.sortOrder)} onChange={(e) => setTypeForm({ ...typeForm, sortOrder: Number(e.target.value) || 0 })} />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={typeForm.isActive} onChange={(e) => setTypeForm({ ...typeForm, isActive: e.target.checked })} className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">{t.common.active}</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setTypeModalOpen(false)}>{t.common.cancel}</Button>
                <Button disabled={!typeForm.nameHu} onClick={async () => {
                  if (editingType) {
                    await updateAppointmentType(editingType.typeId, typeForm);
                  } else {
                    await createAppointmentType(typeForm);
                  }
                  setTypeModalOpen(false);
                  fetchAppointmentTypes();
                }}>{t.common.save}</Button>
              </div>
            </div>
          </Modal>
          </>
        )}
      </div>

      {/* Reset Counter Confirmation */}
      <ConfirmModal
        isOpen={resetCounterConfirm}
        onClose={() => setResetCounterConfirm(false)}
        onConfirm={() => {
          setFormData({
            ...formData,
            quote: { ...formData.quote, counter: 0 },
          });
          setResetCounterConfirm(false);
        }}
        title={t.common.confirm}
        message={t.settings.resetCounterConfirm}
        confirmText={t.settings.resetCounter}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Unsaved Changes Warning */}
      <Modal
        isOpen={pendingNavTarget !== null}
        onClose={() => setPendingNavTarget(null)}
        title={t.settings.unsavedChangesTitle}
        size="sm"
      >
        <p className="text-gray-600 mb-6">{t.settings.unsavedChangesMessage}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPendingNavTarget(null)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const target = pendingNavTarget;
              setIsDirty(false);
              setPendingNavTarget(null);
              if (target) navigate(target);
            }}
          >
            {t.settings.unsavedChangesDiscard}
          </Button>
          <Button
            onClick={async () => {
              const target = pendingNavTarget;
              await handleSave();
              setIsDirty(false);
              setPendingNavTarget(null);
              if (target) navigate(target);
            }}
          >
            {t.settings.unsavedChangesSave}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

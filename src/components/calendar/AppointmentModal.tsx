import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Input, Select, TextArea } from '../common';
import { useSettings } from '../../context/SettingsContext';
import { formatBirthDateForDisplay, parseBirthDateFromDisplay, getDatePlaceholder } from '../../utils/formatters';
import type { Appointment, AppointmentType, AppointmentStatus } from '../../types';
import type { AppointmentChair } from '../../types/appointment';
import type { Patient } from '../../types';

type RecurrenceScope = 'single' | 'future' | 'all';
type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Appointment>, scope?: RecurrenceScope) => Promise<void>;
  onDelete?: (scope?: RecurrenceScope) => Promise<void>;
  appointment?: Appointment | null;
  defaultStart?: string;
  defaultEnd?: string;
  appointmentTypes: AppointmentType[];
  patients: Patient[];
  chairs: AppointmentChair[];
  defaultChairIndex?: number;
}

const STATUS_OPTIONS: AppointmentStatus[] = ['scheduled', 'confirmed', 'completed', 'cancelled', 'noShow'];

/** Convert a recurrence pattern to an RRULE string (without DTSTART) */
function patternToRRule(pattern: RecurrencePattern, startDate: Date): string | null {
  const dayMap: Record<number, string> = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };
  switch (pattern) {
    case 'daily': return 'RRULE:FREQ=DAILY;COUNT=90';
    case 'weekly': return `RRULE:FREQ=WEEKLY;BYDAY=${dayMap[startDate.getDay()]};COUNT=52`;
    case 'biweekly': return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayMap[startDate.getDay()]};COUNT=26`;
    case 'monthly': return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${startDate.getDate()};COUNT=12`;
    default: return null;
  }
}

export function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  appointment,
  defaultStart,
  defaultEnd,
  appointmentTypes,
  patients,
  chairs,
  defaultChairIndex,
}: AppointmentModalProps) {
  const { t, appLanguage } = useSettings();
  const isEdit = !!appointment;
  const isRecurring = !!(appointment?.recurrenceRule || appointment?.recurrenceParentId);

  const [patientId, setPatientId] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [appointmentTypeId, setAppointmentTypeId] = useState('');
  const [chairIndex, setChairIndex] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('scheduled');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('none');
  // Scope dialog state
  const [scopeAction, setScopeAction] = useState<'edit' | 'delete' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (appointment) {
      setPatientId(appointment.patientId || '');
      setPatientSearch(
        appointment.patient
          ? `${appointment.patient.lastName} ${appointment.patient.firstName}`
          : ''
      );
      setAppointmentTypeId(appointment.appointmentTypeId || '');
      setChairIndex(appointment.chairIndex);
      const { date: sd, time: st } = splitDateTime(appointment.startDateTime);
      const { date: ed, time: et } = splitDateTime(appointment.endDateTime);
      setStartDate(sd);
      setStartTime(st);
      setEndDate(ed);
      setEndTime(et);
      setTitle(appointment.title);
      setStatus(appointment.status);
      setNotes(appointment.notes || '');
      setRecurrencePattern('none');
    } else {
      setPatientId('');
      setPatientSearch('');
      setAppointmentTypeId(appointmentTypes[0]?.typeId || '');
      setChairIndex(defaultChairIndex ?? 0);
      if (defaultStart) {
        const { date: sd, time: st } = splitDateTime(defaultStart);
        setStartDate(sd);
        setStartTime(st);
      } else {
        setStartDate('');
        setStartTime('');
      }
      if (defaultEnd) {
        const { date: ed, time: et } = splitDateTime(defaultEnd);
        setEndDate(ed);
        setEndTime(et);
      } else {
        setEndDate('');
        setEndTime('');
      }
      setTitle('');
      setStatus('scheduled');
      setNotes('');
      setRecurrencePattern('none');
      if (appointmentTypes.length > 0) {
        const t0 = appointmentTypes[0];
        setTitle(getTypeName(t0, appLanguage));
      }
    }
    setScopeAction(null);
  }, [isOpen, appointment, defaultStart, defaultEnd, appointmentTypes, appLanguage]);

  // When type changes, update title and end time
  useEffect(() => {
    if (!appointmentTypeId) return;
    const type = appointmentTypes.find((at) => at.typeId === appointmentTypeId);
    if (!type) return;
    if (!isEdit || !appointment?.title) {
      setTitle(getTypeName(type, appLanguage));
    }
    if (startDate && startTime && !isEdit) {
      const isoDate = parseBirthDateFromDisplay(startDate);
      if (isoDate) {
        const start = new Date(`${isoDate}T${startTime}`);
        const end = new Date(start.getTime() + type.defaultDurationMin * 60000);
        const { date: ed, time: et } = splitDateTime(end.toISOString());
        setEndDate(ed);
        setEndTime(et);
      }
    }
  }, [appointmentTypeId, appointmentTypes, appLanguage]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 10);
    const q = patientSearch.toLowerCase();
    return patients
      .filter(
        (p) =>
          p.lastName.toLowerCase().includes(q) ||
          p.firstName.toLowerCase().includes(q) ||
          `${p.lastName} ${p.firstName}`.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [patients, patientSearch]);

  const statusLabels: Record<AppointmentStatus, string> = {
    scheduled: t.calendar.statusScheduled,
    confirmed: t.calendar.statusConfirmed,
    completed: t.calendar.statusCompleted,
    cancelled: t.calendar.statusCancelled,
    noShow: t.calendar.statusNoShow,
  };

  const recurrenceOptions = [
    { value: 'none', label: t.calendar.recurrence.noRepeat },
    { value: 'daily', label: t.calendar.recurrence.daily },
    { value: 'weekly', label: t.calendar.recurrence.weekly },
    { value: 'biweekly', label: t.calendar.recurrence.biweekly },
    { value: 'monthly', label: t.calendar.recurrence.monthly },
  ];

  const buildSaveData = (): Partial<Appointment> => {
    const startIso = parseBirthDateFromDisplay(startDate);
    const endIso = parseBirthDateFromDisplay(endDate);
    if (!startIso || !endIso || !startTime || !endTime) return {};

    const startDt = new Date(`${startIso}T${startTime}`);
    const data: Partial<Appointment> = {
      patientId: patientId || null,
      chairIndex,
      startDateTime: startDt.toISOString(),
      endDateTime: new Date(`${endIso}T${endTime}`).toISOString(),
      title,
      appointmentTypeId: appointmentTypeId || undefined,
      status,
      notes: notes || undefined,
    };

    // Add recurrence rule for new appointments
    if (!isEdit && recurrencePattern !== 'none') {
      data.recurrenceRule = patternToRRule(recurrencePattern, startDt) ?? undefined;
    }

    return data;
  };

  const executeSave = async (scope?: RecurrenceScope) => {
    const data = buildSaveData();
    if (!data.startDateTime) return;
    setSaving(true);
    try {
      await onSave(data, scope);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (isEdit && isRecurring) {
      // Show scope dialog for recurring event edits
      setScopeAction('edit');
      return;
    }
    await executeSave();
  };

  const executeDelete = async (scope?: RecurrenceScope) => {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete(scope);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isRecurring) {
      setScopeAction('delete');
      return;
    }
    await executeDelete();
  };

  // Scope selection dialog
  if (scopeAction) {
    const isDeleteAction = scopeAction === 'delete';
    const tr = t.calendar.recurrence;
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => setScopeAction(null)}
        title={isDeleteAction ? tr.deleteScope : tr.editScope}
        size="sm"
      >
        <div className="space-y-3 py-2">
          <button
            className="w-full text-left px-4 py-3 rounded-lg border border-theme-primary hover:bg-theme-tertiary transition-colors"
            onClick={() => isDeleteAction ? executeDelete('single') : executeSave('single')}
            disabled={saving}
          >
            <div className="font-medium text-sm">{isDeleteAction ? tr.deleteScopeThis : tr.editScopeThis}</div>
          </button>
          <button
            className="w-full text-left px-4 py-3 rounded-lg border border-theme-primary hover:bg-theme-tertiary transition-colors"
            onClick={() => isDeleteAction ? executeDelete('future') : executeSave('future')}
            disabled={saving}
          >
            <div className="font-medium text-sm">{isDeleteAction ? tr.deleteScopeFuture : tr.editScopeFuture}</div>
          </button>
          <button
            className="w-full text-left px-4 py-3 rounded-lg border border-theme-primary hover:bg-theme-tertiary transition-colors"
            onClick={() => isDeleteAction ? executeDelete('all') : executeSave('all')}
            disabled={saving}
          >
            <div className="font-medium text-sm">{isDeleteAction ? tr.deleteScopeAll : tr.editScopeAll}</div>
          </button>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setScopeAction(null)} disabled={saving}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t.calendar.editAppointment : t.calendar.newAppointment}
      size="lg"
    >
      <div className="space-y-4">
        {/* Patient search */}
        <div className="relative">
          <label className="block text-sm font-medium text-theme-secondary mb-1">
            {t.calendar.patient}
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-theme-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500"
            placeholder={t.calendar.selectPatient}
            value={patientSearch}
            onChange={(e) => {
              setPatientSearch(e.target.value);
              setPatientId('');
              setShowPatientDropdown(true);
            }}
            onFocus={() => setShowPatientDropdown(true)}
            onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
          />
          {showPatientDropdown && filteredPatients.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-theme-secondary border border-theme-primary rounded-lg shadow-lg max-h-48 overflow-auto">
              <button
                className="w-full px-3 py-2 text-left text-sm text-theme-muted hover:bg-theme-tertiary"
                onMouseDown={() => {
                  setPatientId('');
                  setPatientSearch('');
                  setShowPatientDropdown(false);
                }}
              >
                {t.calendar.noPatient}
              </button>
              {filteredPatients.map((p) => (
                <button
                  key={p.patientId}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-dental-50"
                  onMouseDown={() => {
                    setPatientId(p.patientId);
                    setPatientSearch(`${p.lastName} ${p.firstName}`);
                    setShowPatientDropdown(false);
                  }}
                >
                  {p.lastName} {p.firstName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Type + Chair row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <Select
              label={t.calendar.type}
              value={appointmentTypeId}
              onChange={(e) => setAppointmentTypeId(e.target.value)}
              options={appointmentTypes
                .filter((at) => at.isActive)
                .map((at) => ({
                  value: at.typeId,
                  label: getTypeName(at, appLanguage),
                }))}
            />
          </div>
          <div className="min-w-0">
            <Select
              label={t.calendar.chair}
              value={String(chairIndex)}
              onChange={(e) => setChairIndex(Number(e.target.value))}
              options={chairs.filter(c => c.isActive).map((c) => ({
                value: String(c.chairNr - 1),
                label: getChairName(c, appLanguage),
              }))}
            />
          </div>
        </div>

        {/* Start / End */}
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-theme-secondary mb-1">{t.calendar.startTime}</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={getDatePlaceholder()}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  const isoDate = parseBirthDateFromDisplay(e.target.value);
                  if (isoDate && startTime) {
                    const type = appointmentTypes.find((at) => at.typeId === appointmentTypeId);
                    if (type) {
                      const start = new Date(`${isoDate}T${startTime}`);
                      const end = new Date(start.getTime() + type.defaultDurationMin * 60000);
                      const { date: ed, time: et } = splitDateTime(end.toISOString());
                      setEndDate(ed);
                      setEndTime(et);
                    }
                  }
                }}
                className="flex-1 min-w-0 px-3 py-2 border border-theme-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent text-sm"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  const isoDate = parseBirthDateFromDisplay(startDate);
                  if (isoDate && e.target.value) {
                    const type = appointmentTypes.find((at) => at.typeId === appointmentTypeId);
                    if (type) {
                      const start = new Date(`${isoDate}T${e.target.value}`);
                      const end = new Date(start.getTime() + type.defaultDurationMin * 60000);
                      const { date: ed, time: et } = splitDateTime(end.toISOString());
                      setEndDate(ed);
                      setEndTime(et);
                    }
                  }
                }}
                className="w-24 px-2 py-2 border border-theme-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-theme-secondary mb-1">{t.calendar.endTime}</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={getDatePlaceholder()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 border border-theme-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent text-sm"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-24 px-2 py-2 border border-theme-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        {/* Recurrence — only for new appointments */}
        {!isEdit && (
          <Select
            label={t.calendar.recurrence.label}
            value={recurrencePattern}
            onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
            options={recurrenceOptions}
          />
        )}

        {/* Recurring indicator for existing appointments */}
        {isEdit && isRecurring && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 2.1l4 4-4 4"/>
              <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8"/>
              <path d="M7 21.9l-4-4 4-4"/>
              <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/>
            </svg>
            <span>{t.calendar.recurrence.label}</span>
          </div>
        )}

        {/* Title */}
        <Input label={t.calendar.description} value={title} onChange={(e) => setTitle(e.target.value)} />

        {/* Status */}
        <Select
          label={t.calendar.status}
          value={status}
          onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabels[s] }))}
        />

        {/* Notes */}
        <TextArea
          label={t.calendar.notes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        {/* Buttons */}
        <div className="flex justify-between pt-2">
          <div>
            {isEdit && onDelete && (
              <Button variant="danger" onClick={handleDelete} disabled={saving}>
                {t.calendar.deleteAppointment}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving || !startDate || !startTime || !endDate || !endTime}>
              {t.common.save}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function getTypeName(type: AppointmentType, lang: string): string {
  if (lang === 'en' && type.nameEn) return type.nameEn;
  if (lang === 'de' && type.nameDe) return type.nameDe;
  return type.nameHu;
}

function getChairName(chair: AppointmentChair, lang: string): string {
  if (lang === 'en' && chair.chairNameEn) return chair.chairNameEn;
  if (lang === 'de' && chair.chairNameDe) return chair.chairNameDe;
  return chair.chairNameHu;
}

function splitDateTime(isoOrLocal: string): { date: string; time: string } {
  const d = new Date(isoOrLocal);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date: formatBirthDateForDisplay(isoDate), time };
}

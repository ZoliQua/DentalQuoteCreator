import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar } from '@dq-calendar';
import type { CalendarEvent, CalendarView, CalendarConfig, CalendarCallbacks, CalendarLabels, Chair } from '@dq-calendar';
import { useSettings } from '../context/SettingsContext';
import { useAppointments } from '../hooks/useAppointments';
import { useApp } from '../context/AppContext';
import { Card, CardContent } from '../components/common';
import { AppointmentModal } from '../components/calendar/AppointmentModal';
import type { Appointment, CalendarSettings } from '../types';
import type { AppointmentChair } from '../types/appointment';
import { defaultSettings } from '../data/defaultSettings';

// Locale data for CalendarLabels
const LOCALE_DATA: Record<string, { weekdays: string[]; weekdaysFull: string[]; months: string[]; allDay: string; more: string }> = {
  hu: {
    weekdays: ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'],
    weekdaysFull: ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'],
    months: ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'],
    allDay: 'Egész nap',
    more: '+{n} további',
  },
  en: {
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    weekdaysFull: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    allDay: 'All day',
    more: '+{n} more',
  },
  de: {
    weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    weekdaysFull: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    allDay: 'Ganztägig',
    more: '+{n} weitere',
  },
};

interface CalendarPageProps {
  initialView?: string;
}

export function CalendarPage({ initialView: initialViewProp }: CalendarPageProps) {
  const { t, settings, appLanguage } = useSettings();
  const { patients } = useApp();

  // ── data hooks ──
  const {
    appointments,
    appointmentTypes,
    chairs,
    loading,
    fetchAppointments,
    fetchAppointmentTypes,
    fetchChairs,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  } = useAppointments();

  const cal: CalendarSettings = { ...defaultSettings.calendar, ...(settings.calendar || {}) };

  // ── local state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [defaultStart, setDefaultStart] = useState('');
  const [defaultEnd, setDefaultEnd] = useState('');
  const [defaultChairIndex, setDefaultChairIndex] = useState<number | undefined>(undefined);
  const [chairsReady, setChairsReady] = useState(false);

  // Use ref for current range so callbacks stay stable
  const currentRangeRef = useRef<{ start: Date; end: Date } | null>(null);

  // ── derived ──
  const activeChairs = useMemo(() => chairs.filter(c => c.isActive), [chairs]);
  const showWeekends = cal.showWeekends !== false;

  const businessHours = useMemo(
    () => cal.workingHours
      .filter((wh) => wh.isWorkday)
      .map((wh) => ({ daysOfWeek: [wh.dayOfWeek], startTime: wh.startTime, endTime: wh.endTime })),
    [cal.workingHours],
  );

  // Always show full 24h range; business hours are used for visual styling + scroll target
  const slotMinTime = '00:00';
  const slotMaxTime = '24:00';

  const activePatients = patients.filter(p => !p.isArchived);

  const chairName = (c: AppointmentChair) => {
    if (appLanguage === 'en' && c.chairNameEn) return c.chairNameEn;
    if (appLanguage === 'de' && c.chairNameDe) return c.chairNameDe;
    return c.chairNameHu;
  };

  // ── fetch on mount ──
  useEffect(() => {
    fetchAppointmentTypes();
    fetchChairs().then(() => setChairsReady(true));
  }, [fetchAppointmentTypes, fetchChairs]);

  // ── Map appointments → CalendarEvent[] ──
  const events: CalendarEvent[] = useMemo(
    () =>
      appointments.map(appt => {
        const type = appointmentTypes.find(at => at.typeId === appt.appointmentTypeId);
        const bg = appt.color || type?.color || '#6B7280';
        return {
          id: appt.appointmentId,
          title: appt.title + (appt.patient ? ` - ${appt.patient.lastName} ${appt.patient.firstName}` : ''),
          start: new Date(appt.startDateTime),
          end: new Date(appt.endDateTime),
          backgroundColor: bg,
          chairIndex: appt.chairIndex,
          extendedProps: { appointment: appt },
        };
      }),
    [appointments, appointmentTypes],
  );

  // ── Map chairs → Chair[] ──
  const calendarChairs: Chair[] = useMemo(
    () => activeChairs.map(c => ({
      id: c.chairId,
      index: c.chairNr - 1,
      label: chairName(c),
      isActive: c.isActive,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeChairs, appLanguage],
  );

  // ── Map initial view ──
  const defaultView: CalendarView = useMemo(() => {
    if (initialViewProp) {
      if (initialViewProp === 'timeGridDay') return 'day';
      if (initialViewProp === 'dayGridMonth') return 'month';
      return 'week';
    }
    return cal.defaultView || 'week';
  }, [initialViewProp, cal.defaultView]);

  // ── CalendarConfig ──
  const config: CalendarConfig = useMemo(() => ({
    slotDuration: cal.slotInterval,
    slotMinTime,
    slotMaxTime,
    businessHours,
    defaultView,
    weekends: showWeekends,
    events,
    chairs: calendarChairs,
    locale: appLanguage,
    firstDayOfWeek: 1,
    timeFormat: '24h',
    editable: true,
    selectable: true,
    nowIndicator: true,
  }), [cal.slotInterval, slotMinTime, slotMaxTime, businessHours, defaultView, showWeekends, events, calendarChairs, appLanguage]);

  // ── CalendarLabels ──
  const labels: CalendarLabels = useMemo(() => {
    const locale = LOCALE_DATA[appLanguage] || LOCALE_DATA.hu;
    return {
      today: t.calendar.today,
      month: t.calendar.viewMonth,
      week: t.calendar.viewWeek,
      day: t.calendar.viewDay,
      allChairs: t.calendar.allChairs,
      selectChairs: t.calendar.selectChairs,
      allDay: locale.allDay,
      more: locale.more,
      weekdays: locale.weekdays,
      weekdaysFull: locale.weekdaysFull,
      months: locale.months,
    };
  }, [appLanguage, t]);

  // ── Refetch helper (uses ref — stable identity) ──
  const refetch = useCallback(() => {
    const range = currentRangeRef.current;
    if (range) {
      fetchAppointments(range.start.toISOString(), range.end.toISOString());
    }
  }, [fetchAppointments]);

  // ── CalendarCallbacks (stable — only changes when fetchAppointments/updateAppointment change) ──
  const callbacks: CalendarCallbacks = useMemo(() => ({
    onEventClick: (evt: CalendarEvent) => {
      setEditingAppointment(evt.extendedProps?.appointment as Appointment);
      setDefaultStart('');
      setDefaultEnd('');
      setDefaultChairIndex(undefined);
      setModalOpen(true);
    },
    onEventDrop: async (evt: CalendarEvent, newStart: Date, newEnd: Date, newChairIndex?: number) => {
      const appt = evt.extendedProps?.appointment as Appointment;
      const d: Partial<Appointment> = {
        startDateTime: newStart.toISOString(),
        endDateTime: newEnd.toISOString(),
      };
      if (newChairIndex !== undefined) d.chairIndex = newChairIndex;
      await updateAppointment(appt.appointmentId, d);
      refetch();
    },
    onEventResize: async (evt: CalendarEvent, newEnd: Date) => {
      const appt = evt.extendedProps?.appointment as Appointment;
      await updateAppointment(appt.appointmentId, { endDateTime: newEnd.toISOString() });
      refetch();
    },
    onSelect: (start: Date, end: Date, chairIndex?: number) => {
      setEditingAppointment(null);
      setDefaultStart(toLocal(start));
      setDefaultEnd(toLocal(end));
      setDefaultChairIndex(chairIndex);
      setModalOpen(true);
    },
    onDatesChange: (start: Date, end: Date, _view: CalendarView, _title: string) => {
      currentRangeRef.current = { start, end };
      fetchAppointments(start.toISOString(), end.toISOString());
    },
  }), [updateAppointment, fetchAppointments, refetch]);

  // ── Modal handlers ──
  const handleSave = async (data: Partial<Appointment>, scope?: 'single' | 'future' | 'all') => {
    if (editingAppointment) await updateAppointment(editingAppointment.appointmentId, data, scope);
    else await createAppointment(data);
    refetch();
  };

  const handleDelete = async (scope?: 'single' | 'future' | 'all') => {
    if (!editingAppointment) return;
    await deleteAppointment(editingAppointment.appointmentId, scope);
    refetch();
  };

  // ── render ──
  if (!chairsReady) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-theme-primary">{t.calendar.title}</h1>
        </div>
        <Card>
          <CardContent>
            <div className="flex items-center justify-center py-20 text-theme-muted">
              {t.common.loading}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-primary">{t.calendar.title}</h1>
        {loading && <span className="text-sm text-theme-muted">{t.common.loading}</span>}
      </div>

      <Calendar config={config} callbacks={callbacks} labels={labels} />

      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={editingAppointment ? handleDelete : undefined}
        appointment={editingAppointment}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        appointmentTypes={appointmentTypes}
        patients={activePatients}
        chairs={activeChairs}
        defaultChairIndex={defaultChairIndex}
      />
    </div>
  );
}

function toLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

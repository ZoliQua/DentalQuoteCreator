import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventDropArg, LocaleSingularArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import huLocale from '@fullcalendar/core/locales/hu';
import deLocale from '@fullcalendar/core/locales/de';
import { useSettings } from '../context/SettingsContext';
import { useAppointments } from '../hooks/useAppointments';
import { useApp } from '../context/AppContext';
import { Card, CardContent, Select } from '../components/common';
import { AppointmentModal } from '../components/calendar/AppointmentModal';
import type { Appointment, CalendarSettings, DateFormat } from '../types';
import type { AppointmentChair } from '../types/appointment';
import { defaultSettings } from '../data/defaultSettings';

const LOCALE_MAP: Record<string, LocaleSingularArg> = { hu: huLocale, de: deLocale };

interface CalendarPageProps {
  initialView?: string;
}

export function CalendarPage({ initialView: initialViewProp }: CalendarPageProps) {
  const { t, settings, appLanguage } = useSettings();
  const { patients } = useApp();

  // ── refs ──
  const singleRef = useRef<FullCalendar>(null);
  const multiRefs = useRef<(FullCalendar | null)[]>([]);
  const syncingRef = useRef(false);

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
  const [chairFilter, setChairFilter] = useState<number | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [defaultStart, setDefaultStart] = useState('');
  const [defaultEnd, setDefaultEnd] = useState('');
  const [defaultChairIndex, setDefaultChairIndex] = useState<number | undefined>(undefined);
  const [currentViewType, setCurrentViewType] = useState(
    initialViewProp || ({ week: 'timeGridWeek', day: 'timeGridDay', month: 'dayGridMonth' }[cal.defaultView]) || 'timeGridWeek'
  );
  const [selectedChairIds, setSelectedChairIds] = useState<string[]>([]);
  const [sharedTitle, setSharedTitle] = useState('');
  const [chairsReady, setChairsReady] = useState(false);

  // ── derived ──
  const activeChairs = useMemo(() => chairs.filter(c => c.isActive), [chairs]);
  const showWeekends = cal.showWeekends !== false;

  const businessHours = cal.workingHours
    .filter((wh) => wh.isWorkday)
    .map((wh) => ({ daysOfWeek: [wh.dayOfWeek], startTime: wh.startTime, endTime: wh.endTime }));

  const workdayHours = cal.workingHours.filter((wh) => wh.isWorkday);
  const slotMinTime = workdayHours.length > 0
    ? workdayHours.reduce((min, wh) => (wh.startTime < min ? wh.startTime : min), '23:59')
    : '07:00';
  const slotMaxTime = workdayHours.length > 0
    ? workdayHours.reduce((max, wh) => (wh.endTime > max ? wh.endTime : max), '00:00')
    : '20:00';

  const isDayView = currentViewType === 'timeGridDay';
  const isWeekView = currentViewType === 'timeGridWeek';
  const isMonthView = currentViewType === 'dayGridMonth';

  // Multi-chair logic — only kicks in AFTER chairs have loaded (chairsReady)
  const maxSideBySide = isDayView ? 7 : isWeekView ? (showWeekends ? 2 : 3) : 1;

  const chairsToRender = useMemo(() => {
    if (!chairsReady || chairFilter !== 'all' || isMonthView || activeChairs.length <= 1) return [];
    if (activeChairs.length <= maxSideBySide) return activeChairs;
    const selected = activeChairs.filter(c => selectedChairIds.includes(c.chairId));
    return selected.length > 0 ? selected.slice(0, maxSideBySide) : activeChairs.slice(0, maxSideBySide);
  }, [chairsReady, chairFilter, isMonthView, activeChairs, maxSideBySide, selectedChairIds]);

  const showMulti = chairsReady && chairFilter === 'all' && !isMonthView && chairsToRender.length > 1;
  const showChairSelector = showMulti && isWeekView && activeChairs.length > maxSideBySide;

  // ── fetch on mount ──
  useEffect(() => {
    fetchAppointmentTypes();
    fetchChairs().then(() => setChairsReady(true));
  }, [fetchAppointmentTypes, fetchChairs]);

  // Init selectedChairIds when chairs arrive
  useEffect(() => {
    if (activeChairs.length > 0 && selectedChairIds.length === 0) {
      setSelectedChairIds(activeChairs.slice(0, maxSideBySide).map(c => c.chairId));
    }
  }, [activeChairs, maxSideBySide]);

  // Switch view via sidebar links — handles both single and multi mode
  useEffect(() => {
    if (!initialViewProp || initialViewProp === currentViewType) return;
    if (showMulti) {
      const api = multiRefs.current[0]?.getApi();
      if (api) {
        api.changeView(initialViewProp);
        setCurrentViewType(initialViewProp);
        syncAll(api);
      }
    } else {
      const api = singleRef.current?.getApi();
      if (api) {
        api.changeView(initialViewProp);
        setCurrentViewType(initialViewProp);
      }
    }
  }, [initialViewProp]);

  // ── callbacks ──
  const handleDatesSet = useCallback(
    (arg: { startStr: string; endStr: string; view: { type: string; title: string } }) => {
      setCurrentViewType(arg.view.type);
      setSharedTitle(arg.view.title);
      fetchAppointments(arg.startStr, arg.endStr, chairFilter === 'all' ? undefined : chairFilter);
    },
    [fetchAppointments, chairFilter],
  );

  const handleMultiDatesSet = useCallback(
    (arg: { startStr: string; endStr: string; view: { type: string; title: string } }) => {
      if (syncingRef.current) return;
      setCurrentViewType(arg.view.type);
      setSharedTitle(arg.view.title);
      fetchAppointments(arg.startStr, arg.endStr);
    },
    [fetchAppointments],
  );

  // Re-fetch when chair filter changes
  useEffect(() => {
    const api = (showMulti ? multiRefs.current[0] : singleRef.current)?.getApi();
    if (!api) return;
    const v = api.view;
    fetchAppointments(v.activeStart.toISOString(), v.activeEnd.toISOString(), chairFilter === 'all' ? undefined : chairFilter);
  }, [chairFilter, fetchAppointments]);

  // ── events ──
  const eventsForChair = useCallback(
    (chairIndex: number) =>
      appointments
        .filter(a => a.chairIndex === chairIndex)
        .map(appt => {
          const type = appointmentTypes.find(at => at.typeId === appt.appointmentTypeId);
          const bg = appt.color || type?.color || '#6B7280';
          return {
            id: appt.appointmentId,
            title: appt.title + (appt.patient ? ` - ${appt.patient.lastName} ${appt.patient.firstName}` : ''),
            start: appt.startDateTime,
            end: appt.endDateTime,
            backgroundColor: bg,
            borderColor: bg,
            extendedProps: { appointment: appt },
          };
        }),
    [appointments, appointmentTypes],
  );

  const allEvents = useMemo(
    () =>
      appointments.map(appt => {
        const type = appointmentTypes.find(at => at.typeId === appt.appointmentTypeId);
        const bg = appt.color || type?.color || '#6B7280';
        return {
          id: appt.appointmentId,
          title: appt.title + (appt.patient ? ` - ${appt.patient.lastName} ${appt.patient.firstName}` : ''),
          start: appt.startDateTime,
          end: appt.endDateTime,
          backgroundColor: bg,
          borderColor: bg,
          extendedProps: { appointment: appt },
        };
      }),
    [appointments, appointmentTypes],
  );

  // ── handlers ──
  const handleSelect = (info: DateSelectArg, chairIdx?: number) => {
    setEditingAppointment(null);
    setDefaultStart(toLocal(info.startStr));
    setDefaultEnd(toLocal(info.endStr));
    setDefaultChairIndex(chairIdx);
    setModalOpen(true);
  };

  const handleEventClick = (info: EventClickArg) => {
    setEditingAppointment(info.event.extendedProps.appointment as Appointment);
    setDefaultStart('');
    setDefaultEnd('');
    setDefaultChairIndex(undefined);
    setModalOpen(true);
  };

  const handleEventDrop = async (info: EventDropArg, chairIdx?: number) => {
    const appt = info.event.extendedProps.appointment as Appointment;
    try {
      const d: Partial<Appointment> = { startDateTime: info.event.start!.toISOString(), endDateTime: info.event.end!.toISOString() };
      if (chairIdx !== undefined) d.chairIndex = chairIdx;
      await updateAppointment(appt.appointmentId, d);
      refetch();
    } catch { info.revert(); }
  };

  const handleEventResize = async (info: EventResizeDoneArg) => {
    const appt = info.event.extendedProps.appointment as Appointment;
    try {
      await updateAppointment(appt.appointmentId, { endDateTime: info.event.end!.toISOString() });
      refetch();
    } catch { info.revert(); }
  };

  const handleSave = async (data: Partial<Appointment>) => {
    if (editingAppointment) await updateAppointment(editingAppointment.appointmentId, data);
    else await createAppointment(data);
    refetch();
  };

  const handleDelete = async () => {
    if (!editingAppointment) return;
    await deleteAppointment(editingAppointment.appointmentId);
    refetch();
  };

  const refetch = () => {
    const api = (showMulti ? multiRefs.current[0] : singleRef.current)?.getApi();
    if (!api) return;
    const v = api.view;
    fetchAppointments(v.activeStart.toISOString(), v.activeEnd.toISOString(), chairFilter === 'all' ? undefined : chairFilter);
  };

  // ── multi-calendar helpers ──
  const syncAll = (src: { view: { currentStart: Date; type: string } }) => {
    syncingRef.current = true;
    multiRefs.current.forEach((ref, i) => {
      if (i === 0 || !ref) return;
      const api = ref.getApi();
      if (api.view.type !== src.view.type) api.changeView(src.view.type);
      api.gotoDate(src.view.currentStart);
    });
    syncingRef.current = false;
  };

  const nav = (action: 'prev' | 'next' | 'today') => {
    if (showMulti) {
      const api = multiRefs.current[0]?.getApi();
      if (!api) return;
      api[action]();
      syncAll(api);
    } else {
      const api = singleRef.current?.getApi();
      if (!api) return;
      api[action]();
    }
  };

  const changeView = (view: string) => {
    if (showMulti) {
      const api = multiRefs.current[0]?.getApi();
      if (!api) return;
      api.changeView(view);
      setCurrentViewType(view);
      syncAll(api);
    } else {
      const api = singleRef.current?.getApi();
      if (!api) return;
      api.changeView(view);
      setCurrentViewType(view);
    }
  };

  const viewMap: Record<string, string> = { week: 'timeGridWeek', day: 'timeGridDay', month: 'dayGridMonth' };
  const initialView = initialViewProp || viewMap[cal.defaultView] || 'timeGridWeek';
  const timeFormat: Record<string, unknown> = { hour: '2-digit', minute: '2-digit', hour12: false };
  const dayHeaderFmt = buildDayHeaderFormat(settings.dateFormat);
  const activePatients = patients.filter(p => !p.isArchived);

  const chairName = (c: AppointmentChair) => {
    if (appLanguage === 'en' && c.chairNameEn) return c.chairNameEn;
    if (appLanguage === 'de' && c.chairNameDe) return c.chairNameDe;
    return c.chairNameHu;
  };

  const toggleChair = (id: string) => {
    setSelectedChairIds(prev => {
      if (prev.includes(id)) return prev.length <= 1 ? prev : prev.filter(x => x !== id);
      return prev.length >= maxSideBySide ? prev : [...prev, id];
    });
  };

  // ── shared calendar props ──
  const shared = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    locale: LOCALE_MAP[appLanguage] || undefined,
    slotDuration: `00:${String(cal.slotInterval).padStart(2, '0')}:00`,
    slotMinTime,
    slotMaxTime,
    businessHours,
    eventTimeFormat: timeFormat,
    slotLabelFormat: timeFormat,
    dayHeaderFormat: isMonthView ? { weekday: 'short' } : dayHeaderFmt,
    nowIndicator: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    allDaySlot: false,
    weekends: showWeekends,
  };

  // ── render ──

  // Don't render any calendar until chairs are loaded — prevents single→multi mode switch crash
  if (!chairsReady) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t.calendar.title}</h1>
        </div>
        <Card>
          <CardContent>
            <div className="flex items-center justify-center py-20 text-gray-400">
              {t.common.loading}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.calendar.title}</h1>
        <div className="flex items-center gap-3">
          <div className="w-48">
            <Select
              value={chairFilter === 'all' ? 'all' : String(chairFilter)}
              onChange={e => setChairFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              options={[
                { value: 'all', label: t.calendar.allChairs },
                ...activeChairs.map(c => ({ value: String(c.chairNr - 1), label: chairName(c) })),
              ]}
            />
          </div>
          {loading && <span className="text-sm text-gray-400">{t.common.loading}</span>}
        </div>
      </div>

      {/* Chair selector (weekly, too many chairs) */}
      {showChairSelector && (
        <div className="flex items-center gap-3 text-sm bg-white border border-gray-200 rounded-lg px-4 py-2">
          <span className="text-gray-600 font-medium">{t.calendar.selectChairs}:</span>
          {activeChairs.map(c => (
            <label key={c.chairId} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={selectedChairIds.includes(c.chairId)} onChange={() => toggleChair(c.chairId)} className="rounded border-gray-300" />
              <span className={selectedChairIds.includes(c.chairId) ? 'text-gray-900' : 'text-gray-400'}>{chairName(c)}</span>
            </label>
          ))}
        </div>
      )}

      {/* Toolbar — shared across all views */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => nav('prev')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">&lt;</button>
              <button onClick={() => nav('next')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">&gt;</button>
              <button onClick={() => nav('today')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t.calendar.today}</button>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{sharedTitle}</h2>
            <div className="flex items-center gap-1">
              {(['dayGridMonth', 'timeGridWeek', 'timeGridDay'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => changeView(v)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${currentViewType === v ? 'bg-dental-500 text-white border-dental-500' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  {v === 'dayGridMonth' ? t.calendar.viewMonth : v === 'timeGridWeek' ? t.calendar.viewWeek : t.calendar.viewDay}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      {showMulti ? (
        <Card>
          <CardContent>
            <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${chairsToRender.length}, 1fr)` }}>
              {chairsToRender.map((c, idx) => {
                const ci = c.chairNr - 1;
                return (
                  <div key={c.chairId} className={`${idx > 0 ? 'border-l border-gray-200' : ''} min-w-0`}>
                    <div className="text-center text-sm font-semibold text-gray-700 py-2 bg-gray-50 border-b border-gray-200">{chairName(c)}</div>
                    <div className={idx > 0 ? 'multi-cal-hide-time' : ''}>
                      <FullCalendar
                        ref={el => { multiRefs.current[idx] = el; }}
                        {...shared}
                        initialView={currentViewType || initialView}
                        headerToolbar={false}
                        events={eventsForChair(ci)}
                        datesSet={idx === 0 ? handleMultiDatesSet : undefined}
                        select={info => handleSelect(info, ci)}
                        eventClick={handleEventClick}
                        eventDrop={info => handleEventDrop(info, ci)}
                        eventResize={handleEventResize}
                        height="auto"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <FullCalendar
              ref={singleRef}
              {...shared}
              initialView={currentViewType || initialView}
              headerToolbar={false}
              events={allEvents}
              datesSet={handleDatesSet}
              select={info => handleSelect(info)}
              eventClick={handleEventClick}
              eventDrop={info => handleEventDrop(info)}
              eventResize={handleEventResize}
              height="auto"
            />
          </CardContent>
        </Card>
      )}

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

function toLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildDayHeaderFormat(dateFormat?: DateFormat): Record<string, unknown> {
  if (!dateFormat) return { weekday: 'short', month: '2-digit', day: '2-digit' };
  const pattern = dateFormat.split(' ')[0];
  if (pattern.startsWith('DD')) return { weekday: 'short', day: '2-digit', month: '2-digit' };
  if (pattern.startsWith('MM')) return { weekday: 'short', month: '2-digit', day: '2-digit' };
  return { weekday: 'short', month: '2-digit', day: '2-digit' };
}

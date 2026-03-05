import { useMemo, useEffect, useRef } from 'react';
import type { CalendarEvent, Chair, BusinessHours, CalendarCallbacks } from '../types';
import type { InteractionState } from '../hooks/useDragDrop';
import { generateSlots, getWeekDays, isToday, startOfDay, parseTime, minutesSinceMidnight } from '../utils/dateUtils';
import { layoutEvents } from '../utils/eventLayout';
import { TimeAxis } from './TimeAxis';
import { DayHeader } from './DayHeader';
import { ChairColumn } from './ChairColumn';
import { NowIndicator } from './NowIndicator';
import { AllDayRow } from './AllDayRow';
import { DEFAULT_SLOT_HEIGHT } from '../utils/constants';

interface TimeGridProps {
  currentDate: Date;
  view: 'day' | 'week';
  events: CalendarEvent[];
  chairs: Chair[];
  slotDuration: number;
  slotMinTime: string;
  slotMaxTime: string;
  slotHeight?: number;
  businessHours: BusinessHours[];
  weekends: boolean;
  firstDayOfWeek: number;
  editable: boolean;
  selectable: boolean;
  nowIndicator: boolean;
  timeFormat: '12h' | '24h';
  weekdaysShort: string[];
  allDayLabel: string;
  moreLabel: string;
  slotEventOverlap?: boolean;
  eventMaxStack?: number;
  callbacks: CalendarCallbacks;
  interaction: InteractionState | null;
  onDragStart: (e: React.MouseEvent, event: CalendarEvent) => void;
  onTouchStart: (e: React.TouchEvent, event: CalendarEvent) => void;
  onResizeStart: (e: React.MouseEvent, event: CalendarEvent) => void;
  onTouchResizeStart: (e: React.TouchEvent, event: CalendarEvent) => void;
  onSlotSelectStart: (e: React.MouseEvent, day: Date, chairIndex: number, startMinutes: number) => void;
}

export function TimeGrid({
  currentDate,
  view,
  events,
  chairs,
  slotDuration,
  slotMinTime,
  slotMaxTime,
  slotHeight = DEFAULT_SLOT_HEIGHT,
  businessHours,
  weekends,
  firstDayOfWeek,
  editable,
  selectable,
  nowIndicator,
  timeFormat,
  weekdaysShort,
  allDayLabel,
  moreLabel,
  slotEventOverlap = true,
  eventMaxStack,
  callbacks,
  interaction,
  onDragStart,
  onTouchStart,
  onResizeStart,
  onTouchResizeStart,
  onSlotSelectStart,
}: TimeGridProps) {
  const slots = useMemo(
    () => generateSlots(slotMinTime, slotMaxTime, slotDuration),
    [slotMinTime, slotMaxTime, slotDuration],
  );

  const days = useMemo(() => {
    if (view === 'day') return [currentDate];
    return getWeekDays(currentDate, firstDayOfWeek, weekends);
  }, [currentDate, view, firstDayOfWeek, weekends]);

  const activeChairs = useMemo(() => chairs.filter(c => c.isActive), [chairs]);

  // Separate all-day vs timed events
  const { timedEvents, allDayEvents } = useMemo(() => {
    const timed: CalendarEvent[] = [];
    const allDay: CalendarEvent[] = [];
    for (const e of events) {
      if (e.allDay) {
        allDay.push(e);
      } else {
        timed.push(e);
      }
    }
    return { timedEvents: timed, allDayEvents: allDay };
  }, [events]);

  // All-day events grouped by day
  const allDayByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayEvents = allDayEvents.filter(e => e.start < dayEnd && e.end > dayStart);
      if (dayEvents.length > 0) map.set(day.toDateString(), dayEvents);
    }
    return map;
  }, [days, allDayEvents]);

  const hasAllDayEvents = allDayByDay.size > 0;

  // Pre-compute layout for all day x chair combos
  const layoutMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutEvents>>();
    for (const day of days) {
      for (const chair of activeChairs) {
        const key = `${day.toDateString()}_${chair.index}`;
        map.set(key, layoutEvents(timedEvents, day, chair.index, slotEventOverlap, eventMaxStack));
      }
    }
    return map;
  }, [days, activeChairs, timedEvents]);

  const totalHeight = slots.length * slotHeight;
  const showChairHeaders = activeChairs.length > 1;
  const bodyRef = useRef<HTMLDivElement>(null);

  // Scroll to business hours start (or current time if today) on initial render
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const { hours: minH, minutes: minM } = parseTime(slotMinTime);
    const gridStartMin = minH * 60 + minM;
    const pxPerMin = slotHeight / slotDuration;

    // Determine the earliest business-hours start as scroll target
    let scrollTargetMin: number;
    const now = new Date();
    const isViewToday = days.some(d => isToday(d));

    if (isViewToday) {
      // If today is visible, scroll to current time (1/3 from top)
      scrollTargetMin = minutesSinceMidnight(now);
    } else if (businessHours.length > 0) {
      // Scroll to earliest business-hours start
      const bhStartMins = businessHours.map(bh => {
        const t = parseTime(bh.startTime);
        return t.hours * 60 + t.minutes;
      });
      scrollTargetMin = Math.min(...bhStartMins);
    } else {
      scrollTargetMin = 7 * 60; // fallback: 07:00
    }

    const scrollTarget = (scrollTargetMin - gridStartMin) * pxPerMin - body.clientHeight / 3;
    body.scrollTop = Math.max(0, scrollTarget);
  }, [currentDate, view]);

  const getWeekdayShort = (date: Date) => {
    const d = date.getDay();
    const idx = d === 0 ? 6 : d - 1;
    return weekdaysShort[idx] || '';
  };

  return (
    <div className="dqcal-timegrid">
      {/* Scrollable container — header inside for sticky to work */}
      <div className="dqcal-timegrid__body" ref={bodyRef}>
        {/* Sticky header block (header + optional all-day row) */}
        <div className="dqcal-timegrid__header-sticky">
          <div className="dqcal-timegrid__header">
            <div className="dqcal-timegrid__header-axis" />
            {days.map(day => (
              <DayHeader
                key={day.toDateString()}
                date={day}
                weekdayShort={getWeekdayShort(day)}
                chairs={showChairHeaders ? activeChairs.map(c => ({ id: c.id, label: c.label })) : undefined}
                showChairHeaders={showChairHeaders}
              />
            ))}
          </div>

          {/* All-day events row */}
          {hasAllDayEvents && (
            <AllDayRow
              days={days}
              allDayByDay={allDayByDay}
              allDayLabel={allDayLabel}
              moreLabel={moreLabel}
              onEventClick={callbacks.onEventClick}
            />
          )}
        </div>

        {/* Time grid content */}
        <div className="dqcal-timegrid__content" style={{ height: totalHeight }}>
          {/* Time axis */}
          <TimeAxis
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            slotDuration={slotDuration}
            slotHeight={slotHeight}
          />

          {/* Day columns */}
          <div className="dqcal-timegrid__columns">
            {days.map(day => (
              <div
                key={day.toDateString()}
                className={`dqcal-timegrid__day ${isToday(day) ? 'dqcal-timegrid__day--today' : ''}`}
              >
                {activeChairs.map(chair => {
                  const key = `${day.toDateString()}_${chair.index}`;
                  const layouted = layoutMap.get(key) || [];

                  return (
                    <ChairColumn
                      key={chair.id}
                      day={day}
                      chairIndex={chair.index}
                      layoutedEvents={layouted}
                      slots={slots}
                      slotHeight={slotHeight}
                      slotDuration={slotDuration}
                      slotMinTime={slotMinTime}
                      businessHours={businessHours}
                      editable={editable}
                      selectable={selectable}
                      timeFormat={timeFormat}
                      interaction={interaction}
                      onEventClick={callbacks.onEventClick}
                      onDragStart={onDragStart}
                      onTouchStart={onTouchStart}
                      onResizeStart={onResizeStart}
                      onTouchResizeStart={onTouchResizeStart}
                      onSlotSelectStart={onSlotSelectStart}
                    />
                  );
                })}

                {/* Now indicator */}
                {nowIndicator && isToday(day) && (
                  <NowIndicator
                    slotMinTime={slotMinTime}
                    slotMaxTime={slotMaxTime}
                    slotHeight={slotHeight}
                    slotDuration={slotDuration}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

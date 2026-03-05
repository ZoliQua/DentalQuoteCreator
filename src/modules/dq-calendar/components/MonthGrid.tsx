import { useMemo } from 'react';
import type { CalendarEvent, CalendarCallbacks } from '../types';
import { getMonthGridDays, isToday, startOfDay } from '../utils/dateUtils';

interface MonthGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  firstDayOfWeek: number;
  weekdaysShort: string[];
  callbacks: CalendarCallbacks;
  moreLabel: string; // "+{n} more" pattern
}

const DAY_MAX_EVENTS = 3;

export function MonthGrid({
  currentDate,
  events,
  firstDayOfWeek,
  weekdaysShort,
  callbacks,
  moreLabel,
}: MonthGridProps) {
  const days = useMemo(
    () => getMonthGridDays(currentDate, firstDayOfWeek),
    [currentDate, firstDayOfWeek],
  );

  const currentMonth = currentDate.getMonth();

  // Build a map: dateString -> events[]
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      // Add event to each day it spans
      const start = startOfDay(event.start);
      const end = startOfDay(event.end);
      const d = new Date(start);
      while (d <= end) {
        const key = d.toDateString();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(event);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="dqcal-monthgrid">
      {/* Weekday headers */}
      <div className="dqcal-monthgrid__header">
        {weekdaysShort.map((name, i) => (
          <div key={i} className="dqcal-monthgrid__weekday">{name}</div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} className="dqcal-monthgrid__week">
          {week.map(day => {
            const isOtherMonth = day.getMonth() !== currentMonth;
            const today = isToday(day);
            const dayEvents = eventsByDay.get(day.toDateString()) || [];
            const visibleEvents = dayEvents.slice(0, DAY_MAX_EVENTS);
            const overflowCount = dayEvents.length - DAY_MAX_EVENTS;

            return (
              <div
                key={day.toDateString()}
                className={`dqcal-monthgrid__cell ${isOtherMonth ? 'dqcal-monthgrid__cell--other' : ''} ${today ? 'dqcal-monthgrid__cell--today' : ''}`}
                onClick={() => {
                  callbacks.onSelect?.(
                    startOfDay(day),
                    new Date(startOfDay(day).getTime() + 86400000),
                    undefined,
                  );
                }}
              >
                <div className={`dqcal-monthgrid__day-number ${today ? 'dqcal-monthgrid__day-number--today' : ''}`}>
                  {day.getDate()}
                </div>
                <div className="dqcal-monthgrid__events">
                  {visibleEvents.map(event => (
                    <div
                      key={event.id}
                      className="dqcal-monthgrid__event"
                      style={{ backgroundColor: event.backgroundColor || 'var(--dqcal-primary)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        callbacks.onEventClick?.(event);
                      }}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {overflowCount > 0 && (
                    <div className="dqcal-monthgrid__more">
                      {moreLabel.replace('{n}', String(overflowCount))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

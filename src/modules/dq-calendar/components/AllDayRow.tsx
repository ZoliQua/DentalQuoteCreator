import type { CalendarEvent } from '../types';

const ALL_DAY_MAX_VISIBLE = 3;

interface AllDayRowProps {
  days: Date[];
  allDayByDay: Map<string, CalendarEvent[]>;
  allDayLabel: string;
  moreLabel: string;
  onEventClick?: (event: CalendarEvent) => void;
}

export function AllDayRow({
  days,
  allDayByDay,
  allDayLabel,
  moreLabel,
  onEventClick,
}: AllDayRowProps) {
  return (
    <div className="dqcal-allday">
      <div className="dqcal-allday__axis">
        <span className="dqcal-allday__label">{allDayLabel}</span>
      </div>
      <div className="dqcal-allday__columns">
        {days.map(day => {
          const dayEvents = allDayByDay.get(day.toDateString()) || [];
          const visible = dayEvents.slice(0, ALL_DAY_MAX_VISIBLE);
          const overflow = dayEvents.length - ALL_DAY_MAX_VISIBLE;

          return (
            <div key={day.toDateString()} className="dqcal-allday__cell">
              {visible.map(event => (
                <div
                  key={event.id}
                  className="dqcal-allday__event"
                  style={{ backgroundColor: event.backgroundColor || 'var(--dqcal-primary)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                  title={event.title}
                >
                  {event.title}
                </div>
              ))}
              {overflow > 0 && (
                <div className="dqcal-allday__more">
                  {moreLabel.replace('{n}', String(overflow))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

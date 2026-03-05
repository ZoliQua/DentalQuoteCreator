import { isToday } from '../utils/dateUtils';

interface DayHeaderProps {
  date: Date;
  weekdayShort: string;
  chairs?: { id: string; label: string }[];
  showChairHeaders?: boolean;
}

export function DayHeader({ date, weekdayShort, chairs, showChairHeaders }: DayHeaderProps) {
  const today = isToday(date);

  return (
    <div className={`dqcal-day-header ${today ? 'dqcal-day-header--today' : ''}`}>
      <div className="dqcal-day-header__date">
        <span className="dqcal-day-header__weekday">{weekdayShort}</span>
        <span className={`dqcal-day-header__number ${today ? 'dqcal-day-header__number--today' : ''}`}>
          {date.getDate()}
        </span>
      </div>
      {showChairHeaders && chairs && chairs.length > 1 && (
        <div className="dqcal-day-header__chairs">
          {chairs.map(chair => (
            <div key={chair.id} className="dqcal-day-header__chair">
              {chair.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

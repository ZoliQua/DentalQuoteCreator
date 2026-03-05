import { generateSlots } from '../utils/dateUtils';

interface TimeAxisProps {
  slotMinTime: string;
  slotMaxTime: string;
  slotDuration: number;
  slotHeight: number;
}

export function TimeAxis({ slotMinTime, slotMaxTime, slotDuration, slotHeight }: TimeAxisProps) {
  const slots = generateSlots(slotMinTime, slotMaxTime, slotDuration);

  return (
    <div className="dqcal-time-axis">
      {slots.map((slot, i) => {
        // Only show label on hour boundaries (or every 30min if slot >= 30)
        const min = slot.minutes % 60;
        const showLabel = min === 0;

        return (
          <div
            key={slot.time}
            className={`dqcal-time-slot ${i > 0 && min === 0 ? 'dqcal-time-slot--major' : ''}`}
            style={{ height: slotHeight }}
          >
            {showLabel && (
              <span className="dqcal-time-label">{slot.time}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

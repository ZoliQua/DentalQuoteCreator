import { useEffect, useState } from 'react';
import { minutesSinceMidnight, parseTime } from '../utils/dateUtils';
import { NOW_INDICATOR_INTERVAL } from '../utils/constants';

interface NowIndicatorProps {
  slotMinTime: string;
  slotMaxTime: string;
  slotHeight: number;
  slotDuration: number;
}

export function NowIndicator({ slotMinTime, slotMaxTime, slotHeight, slotDuration }: NowIndicatorProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), NOW_INDICATOR_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const min = parseTime(slotMinTime);
  const max = parseTime(slotMaxTime);
  const minMinutes = min.hours * 60 + min.minutes;
  const maxMinutes = max.hours * 60 + max.minutes;
  const nowMinutes = minutesSinceMidnight(now);

  // Don't render if outside visible range
  if (nowMinutes < minMinutes || nowMinutes > maxMinutes) return null;

  const pixelsPerMinute = slotHeight / slotDuration;
  const top = (nowMinutes - minMinutes) * pixelsPerMinute;

  return (
    <div className="dqcal-now-indicator" style={{ top }}>
      <div className="dqcal-now-indicator__dot" />
      <div className="dqcal-now-indicator__line" />
    </div>
  );
}

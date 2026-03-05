import type { CalendarView } from '../types';

/** Parse "HH:mm" string to { hours, minutes } */
export function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h, minutes: m };
}

/** Get minutes since midnight for a Date */
export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Create a Date at specific time on a given day */
export function setTime(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** Get start of day (00:00:00) */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get start of week (based on firstDayOfWeek) */
export function startOfWeek(date: Date, firstDay: number = 1): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day - firstDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Get end of week (based on firstDayOfWeek) */
export function endOfWeek(date: Date, firstDay: number = 1): Date {
  const d = startOfWeek(date, firstDay);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Get start of month */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Get end of month */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/** Check if date is today */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Check if date is a weekend (Sat=6, Sun=0) */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Add days to a date */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Add months to a date */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Get days of the week for a given date */
export function getWeekDays(date: Date, firstDay: number = 1, includeWeekends: boolean = true): Date[] {
  const start = startOfWeek(date, firstDay);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (includeWeekends || !isWeekend(d)) {
      days.push(d);
    }
  }
  return days;
}

/** Get all days for the month grid (6 rows × 7 days, including overflow) */
export function getMonthGridDays(date: Date, firstDay: number = 1): Date[] {
  const monthStart = startOfMonth(date);
  const gridStart = startOfWeek(monthStart, firstDay);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(gridStart, i));
  }
  return days;
}

/** Generate time slots between min and max time */
export function generateSlots(minTime: string, maxTime: string, durationMinutes: number): { time: string; minutes: number }[] {
  const min = parseTime(minTime);
  const max = parseTime(maxTime);
  const startMin = min.hours * 60 + min.minutes;
  const endMin = max.hours * 60 + max.minutes;
  const slots: { time: string; minutes: number }[] = [];

  for (let m = startMin; m < endMin; m += durationMinutes) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push({
      time: `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      minutes: m,
    });
  }
  return slots;
}

/** Format time as HH:mm or h:mm AM/PM */
export function formatTime(date: Date, format: '12h' | '24h' = '24h'): string {
  if (format === '24h') {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  const h = date.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(date.getMinutes()).padStart(2, '0')} ${ampm}`;
}

/** Format date range for view title */
export function formatViewTitle(
  date: Date,
  view: CalendarView,
  months: string[],
  firstDay: number = 1,
  weekends: boolean = true,
): string {
  const year = date.getFullYear();

  if (view === 'day') {
    return `${year}. ${months[date.getMonth()]} ${date.getDate()}.`;
  }

  if (view === 'month') {
    return `${year}. ${months[date.getMonth()]}`;
  }

  // Week view
  const days = getWeekDays(date, firstDay, weekends);
  const first = days[0];
  const last = days[days.length - 1];

  if (first.getMonth() === last.getMonth()) {
    return `${year}. ${months[first.getMonth()]} ${first.getDate()}–${last.getDate()}.`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${year}. ${months[first.getMonth()]} ${first.getDate()}. – ${months[last.getMonth()]} ${last.getDate()}.`;
  }
  return `${first.getFullYear()}. ${months[first.getMonth()]} ${first.getDate()}. – ${last.getFullYear()}. ${months[last.getMonth()]} ${last.getDate()}.`;
}

/** Get visible date range for a view */
export function getViewRange(
  date: Date,
  view: CalendarView,
  firstDay: number = 1,
): { start: Date; end: Date } {
  switch (view) {
    case 'day':
      return { start: startOfDay(date), end: new Date(startOfDay(date).getTime() + 86400000 - 1) };
    case 'week':
      return { start: startOfWeek(date, firstDay), end: endOfWeek(date, firstDay) };
    case 'month': {
      const gridDays = getMonthGridDays(date, firstDay);
      return { start: gridDays[0], end: new Date(gridDays[41].getTime() + 86400000 - 1) };
    }
  }
}

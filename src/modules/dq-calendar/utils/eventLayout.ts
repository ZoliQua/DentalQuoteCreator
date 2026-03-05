import type { CalendarEvent } from '../types';
import { minutesSinceMidnight, isSameDay } from './dateUtils';

export interface LayoutedEvent {
  event: CalendarEvent;
  /** Left position as fraction 0–1 */
  left: number;
  /** Width as fraction 0–1 */
  width: number;
  /** Whether this event is hidden behind +N more */
  hidden?: boolean;
}

/**
 * Layout overlapping events with FullCalendar-style widening.
 *
 * 1. Sort events by start time, then by duration (longer first)
 * 2. Group overlapping events into clusters
 * 3. Assign columns within each cluster
 * 4. If slotEventOverlap: widen events (width = min(1/col, 2/total)) for card overlap effect
 * 5. If eventMaxStack: hide excess events
 */
export function layoutEvents(
  events: CalendarEvent[],
  day: Date,
  chairIndex: number,
  slotEventOverlap: boolean = true,
  eventMaxStack?: number,
): LayoutedEvent[] {
  // Filter events for this day and chair
  const dayEvents = events.filter(e => {
    if (e.chairIndex !== chairIndex) return false;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return e.start <= dayEnd && e.end > dayStart;
  });

  if (dayEvents.length === 0) return [];

  // Sort by start time, then by duration (longer first)
  dayEvents.sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime();
    if (startDiff !== 0) return startDiff;
    const durationA = a.end.getTime() - a.start.getTime();
    const durationB = b.end.getTime() - b.start.getTime();
    return durationB - durationA;
  });

  // Build overlap clusters
  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = 0;

  for (const event of dayEvents) {
    const eventStart = getEventMinutes(event, day, 'start');
    const eventEnd = getEventMinutes(event, day, 'end');

    if (currentCluster.length === 0 || eventStart < clusterEnd) {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, eventEnd);
    } else {
      clusters.push(currentCluster);
      currentCluster = [event];
      clusterEnd = eventEnd;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Assign columns and compute layout within each cluster
  const result: LayoutedEvent[] = [];

  for (const cluster of clusters) {
    const columns: CalendarEvent[][] = [];

    for (const event of cluster) {
      const eventStart = getEventMinutes(event, day, 'start');
      let placed = false;

      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        const lastEnd = getEventMinutes(lastInCol, day, 'end');
        if (eventStart >= lastEnd) {
          columns[col].push(event);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([event]);
      }
    }

    const totalColumns = columns.length;

    // Determine if any events should be hidden (eventMaxStack)
    const hiddenIds = new Set<string>();
    if (eventMaxStack && totalColumns > eventMaxStack) {
      // Hide events in columns beyond maxStack
      for (let col = eventMaxStack; col < columns.length; col++) {
        for (const event of columns[col]) {
          hiddenIds.add(event.id);
        }
      }
    }

    for (let col = 0; col < columns.length; col++) {
      for (const event of columns[col]) {
        let left: number;
        let width: number;

        if (slotEventOverlap && totalColumns > 1) {
          // FullCalendar-style: each event gets wider than its strict column,
          // creating a card-overlap effect. Width = min(2/total, 1 - left).
          left = col / totalColumns;
          const baseWidth = 1 / totalColumns;
          // Widen: try to use up to 2x the base width, but cap at remaining space
          width = Math.min(baseWidth * 1.7, 1 - left);
        } else {
          left = col / totalColumns;
          width = 1 / totalColumns;
        }

        result.push({
          event,
          left,
          width,
          hidden: hiddenIds.has(event.id),
        });
      }
    }
  }

  return result;
}

/** Get event minutes on a specific day (clamped to day boundaries) */
function getEventMinutes(event: CalendarEvent, day: Date, which: 'start' | 'end'): number {
  const d = which === 'start' ? event.start : event.end;
  if (isSameDay(d, day)) {
    return minutesSinceMidnight(d);
  }
  return which === 'start' ? 0 : 24 * 60;
}

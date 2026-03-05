import { useMemo } from 'react';
import type { CalendarEvent, Chair } from '../types';
import { layoutEvents, type LayoutedEvent } from '../utils/eventLayout';

/**
 * Hook that computes event layouts for given days and chairs.
 * Returns a Map keyed by "dateString_chairIndex" → LayoutedEvent[]
 */
export function useEventLayout(
  events: CalendarEvent[],
  days: Date[],
  chairs: Chair[],
): Map<string, LayoutedEvent[]> {
  return useMemo(() => {
    const map = new Map<string, LayoutedEvent[]>();
    const activeChairs = chairs.filter(c => c.isActive);

    for (const day of days) {
      for (const chair of activeChairs) {
        const key = `${day.toDateString()}_${chair.index}`;
        map.set(key, layoutEvents(events, day, chair.index));
      }
    }

    return map;
  }, [events, days, chairs]);
}

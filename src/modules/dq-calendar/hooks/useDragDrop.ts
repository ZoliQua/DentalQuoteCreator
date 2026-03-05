import { useRef, useCallback, useState } from 'react';
import type { CalendarEvent, CalendarCallbacks } from '../types';
import { parseTime, setTime, minutesSinceMidnight } from '../utils/dateUtils';

interface UseDragDropOptions {
  slotDuration: number;
  slotMinTime: string;
  slotHeight: number;
  callbacks: CalendarCallbacks;
  editable: boolean;
}

/** Interaction state that the grid uses to render the placeholder */
export interface InteractionState {
  affectedEventId: string;
  previewEvent: CalendarEvent;
  type: 'drag' | 'resize';
}

const LONG_PRESS_DELAY = 500; // ms before touch drag starts
const TOUCH_MOVE_THRESHOLD = 5; // px — cancel long press if finger moves
const DRAG_THRESHOLD = 4; // px — mouse must move this far before drag activates (otherwise it's a click)

export function useDragDrop({
  slotDuration,
  slotMinTime,
  slotHeight,
  callbacks,
  editable,
}: UseDragDropOptions) {
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const dragStateRef = useRef<{
    event: CalendarEvent;
    offsetY: number;
  } | null>(null);

  const pixelsPerMinute = slotHeight / slotDuration;
  const minTimeMinutes = (() => {
    const t = parseTime(slotMinTime);
    return t.hours * 60 + t.minutes;
  })();

  const snapToSlot = useCallback((minutes: number): number => {
    return Math.round(minutes / slotDuration) * slotDuration;
  }, [slotDuration]);

  // ─── Hit Detection ───

  // Column rect cache — populated once at drag start, cleared at drag end
  const columnCacheRef = useRef<{ rect: DOMRect; day: string; chairIndex: number }[] | null>(null);

  const buildColumnCache = useCallback(() => {
    const columns = document.querySelectorAll<HTMLElement>('.dqcal-chair-column');
    const cache: { rect: DOMRect; day: string; chairIndex: number }[] = [];
    for (const col of columns) {
      const dayStr = col.dataset.day;
      const chairStr = col.dataset.chair;
      if (!dayStr || !chairStr) continue;
      cache.push({
        rect: col.getBoundingClientRect(),
        day: dayStr,
        chairIndex: parseInt(chairStr, 10),
      });
    }
    columnCacheRef.current = cache;
  }, []);

  const clearColumnCache = useCallback(() => {
    columnCacheRef.current = null;
  }, []);

  const hitTest = useCallback((clientX: number, clientY: number): {
    day: Date; chairIndex: number; minutes: number;
  } | null => {
    // Use cached rects during drag, fallback to live query
    const entries = columnCacheRef.current ?? (() => {
      const columns = document.querySelectorAll<HTMLElement>('.dqcal-chair-column');
      const result: { rect: DOMRect; day: string; chairIndex: number }[] = [];
      for (const col of columns) {
        const dayStr = col.dataset.day;
        const chairStr = col.dataset.chair;
        if (!dayStr || !chairStr) continue;
        result.push({ rect: col.getBoundingClientRect(), day: dayStr, chairIndex: parseInt(chairStr, 10) });
      }
      return result;
    })();

    for (const entry of entries) {
      const { rect, day: dayStr, chairIndex } = entry;
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        const day = new Date(dayStr);
        const relativeY = clientY - rect.top;
        const minutes = minTimeMinutes + relativeY / pixelsPerMinute;
        return { day, chairIndex, minutes };
      }
    }
    return null;
  }, [minTimeMinutes, pixelsPerMinute]);

  // ─── Auto-scroll ───

  const autoScrollRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);
  const scrollBodyRef = useRef<HTMLElement | null>(null);

  const startAutoScroll = useCallback((clientY: number) => {
    if (!scrollBodyRef.current) {
      scrollBodyRef.current = document.querySelector('.dqcal-timegrid__body');
    }
    const body = scrollBodyRef.current;
    if (!body) return;

    const rect = body.getBoundingClientRect();
    const edgeZone = 60;
    const maxSpeed = 12;

    let speed = 0;
    if (clientY < rect.top + edgeZone) {
      const proximity = Math.max(0, 1 - (clientY - rect.top) / edgeZone);
      speed = -maxSpeed * proximity * proximity;
    } else if (clientY > rect.bottom - edgeZone) {
      const proximity = Math.max(0, 1 - (rect.bottom - clientY) / edgeZone);
      speed = maxSpeed * proximity * proximity;
    }

    autoScrollSpeedRef.current = speed;

    if (speed === 0) {
      stopAutoScroll();
      return;
    }

    if (autoScrollRef.current === null) {
      const tick = () => {
        if (scrollBodyRef.current && autoScrollSpeedRef.current !== 0) {
          scrollBodyRef.current.scrollTop += autoScrollSpeedRef.current;
        }
        autoScrollRef.current = requestAnimationFrame(tick);
      };
      autoScrollRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }, []);

  // ─── Shared drag logic (mouse + touch) ───

  const executeDrag = useCallback((
    event: CalendarEvent,
    offsetY: number,
    _getXY: () => { x: number; y: number } | null,
    cleanup: () => void,
  ) => {
    dragStateRef.current = { event, offsetY };
    buildColumnCache();

    setInteraction({
      affectedEventId: event.id,
      previewEvent: { ...event },
      type: 'drag',
    });

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const onMove = (clientX: number, clientY: number) => {
      startAutoScroll(clientY);
      const hit = hitTest(clientX, clientY);

      if (hit && dragStateRef.current) {
        const state = dragStateRef.current;
        const offsetMinutes = state.offsetY / pixelsPerMinute;
        const rawMinutes = hit.minutes - offsetMinutes;
        const snappedMinutes = snapToSlot(rawMinutes);
        const duration = state.event.end.getTime() - state.event.start.getTime();

        const newStartHours = Math.floor(snappedMinutes / 60);
        const newStartMins = snappedMinutes % 60;
        const newStart = setTime(hit.day, newStartHours, newStartMins);
        const newEnd = new Date(newStart.getTime() + duration);

        setInteraction({
          affectedEventId: state.event.id,
          previewEvent: { ...state.event, start: newStart, end: newEnd, chairIndex: hit.chairIndex },
          type: 'drag',
        });
        // Valid drop target
        document.body.classList.remove('dqcal-not-allowed');
      } else {
        // Outside grid — invalid drop cursor
        document.body.classList.add('dqcal-not-allowed');
      }
    };

    const onEnd = (clientX: number, clientY: number) => {
      cleanup();
      clearColumnCache();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.body.classList.remove('dqcal-not-allowed');
      stopAutoScroll();

      const state = dragStateRef.current;
      dragStateRef.current = null;

      if (state) {
        const hit = hitTest(clientX, clientY);
        if (hit) {
          const offsetMinutes = state.offsetY / pixelsPerMinute;
          const rawMinutes = hit.minutes - offsetMinutes;
          const snappedMinutes = snapToSlot(rawMinutes);
          const duration = state.event.end.getTime() - state.event.start.getTime();

          const newStartHours = Math.floor(snappedMinutes / 60);
          const newStartMins = snappedMinutes % 60;
          const newStart = setTime(hit.day, newStartHours, newStartMins);
          const newEnd = new Date(newStart.getTime() + duration);

          callbacks.onEventDrop?.(state.event, newStart, newEnd, hit.chairIndex);
        }
      }

      setInteraction(null);
    };

    return { onMove, onEnd };
  }, [hitTest, pixelsPerMinute, snapToSlot, callbacks, startAutoScroll, stopAutoScroll, buildColumnCache, clearColumnCache]);

  // ─── Mouse Drag (with threshold — small moves count as click) ───

  const pendingDragRef = useRef<{ onMove: (x: number, y: number) => void; onEnd: (x: number, y: number) => void } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    if (!editable) return;
    e.stopPropagation(); // prevent slot selection, but do NOT preventDefault — allow click to fire

    const sourceEl = (e.target as HTMLElement).closest('.dqcal-event') as HTMLElement;
    if (!sourceEl) return;
    const rect = sourceEl.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const startX = e.clientX;
    const startY = e.clientY;

    const onMouseMove = (me: MouseEvent) => {
      if (!pendingDragRef.current) {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;

        // Threshold exceeded — start actual drag
        pendingDragRef.current = executeDrag(event, offsetY, () => ({ x: startX, y: startY }), () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        });
      }
      pendingDragRef.current?.onMove(me.clientX, me.clientY);
    };

    const onMouseUp = (me: MouseEvent) => {
      if (pendingDragRef.current) {
        pendingDragRef.current.onEnd(me.clientX, me.clientY);
        pendingDragRef.current = null;
      } else {
        // Mouse didn't move past threshold — this was a click, just clean up
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // The native click event will fire on the EventItem
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [editable, executeDrag]);

  // ─── Touch Drag (long press) ───

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent, event: CalendarEvent) => {
    if (!editable) return;

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    const sourceEl = (e.target as HTMLElement).closest('.dqcal-event') as HTMLElement;
    if (!sourceEl) return;
    const rect = sourceEl.getBoundingClientRect();
    const offsetY = startY - rect.top;

    const cancelLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    // Check if finger moved too much before long press fires
    const onTouchMoveEarly = (te: TouchEvent) => {
      const t = te.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.sqrt(dx * dx + dy * dy) > TOUCH_MOVE_THRESHOLD) {
        cancelLongPress();
        document.removeEventListener('touchmove', onTouchMoveEarly);
        document.removeEventListener('touchend', onTouchEndEarly);
        document.removeEventListener('touchcancel', onTouchEndEarly);
      }
    };

    const onTouchEndEarly = () => {
      cancelLongPress();
      document.removeEventListener('touchmove', onTouchMoveEarly);
      document.removeEventListener('touchend', onTouchEndEarly);
      document.removeEventListener('touchcancel', onTouchEndEarly);
    };

    document.addEventListener('touchmove', onTouchMoveEarly, { passive: false });
    document.addEventListener('touchend', onTouchEndEarly);
    document.addEventListener('touchcancel', onTouchEndEarly);

    longPressTimerRef.current = setTimeout(() => {
      // Long press activated — start drag
      // drag activated
      document.removeEventListener('touchmove', onTouchMoveEarly);
      document.removeEventListener('touchend', onTouchEndEarly);
      document.removeEventListener('touchcancel', onTouchEndEarly);

      // Haptic feedback on supported devices
      if (navigator.vibrate) navigator.vibrate(50);

      const onTouchMoveDrag = (te: TouchEvent) => {
        te.preventDefault(); // prevent scroll during drag
        const t = te.touches[0];
        drag.onMove(t.clientX, t.clientY);
      };

      const onTouchEndDrag = (te: TouchEvent) => {
        const t = te.changedTouches[0];
        drag.onEnd(t.clientX, t.clientY);
      };

      const drag = executeDrag(event, offsetY, () => ({ x: startX, y: startY }), () => {
        document.removeEventListener('touchmove', onTouchMoveDrag);
        document.removeEventListener('touchend', onTouchEndDrag);
        document.removeEventListener('touchcancel', onTouchEndDrag);
      });

      document.addEventListener('touchmove', onTouchMoveDrag, { passive: false });
      document.addEventListener('touchend', onTouchEndDrag);
      document.addEventListener('touchcancel', onTouchEndDrag);
    }, LONG_PRESS_DELAY);
  }, [editable, executeDrag]);

  // ─── Resize (mouse only for now) ───

  const onResizeStart = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const originalEndMinutes = minutesSinceMidnight(event.end);
    const eventStartMinutes = minutesSinceMidnight(event.start);

    setInteraction({
      affectedEventId: event.id,
      previewEvent: { ...event },
      type: 'resize',
    });

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 's-resize';

    const onMouseMove = (me: MouseEvent) => {
      startAutoScroll(me.clientY);

      const deltaY = me.clientY - startY;
      const deltaMinutes = deltaY / pixelsPerMinute;
      const newEndMinutes = snapToSlot(originalEndMinutes + deltaMinutes);

      if (newEndMinutes <= eventStartMinutes + slotDuration) return;

      const newEndHours = Math.floor(newEndMinutes / 60);
      const newEndMins = newEndMinutes % 60;
      const newEnd = setTime(event.end, newEndHours, newEndMins);

      setInteraction({
        affectedEventId: event.id,
        previewEvent: { ...event, end: newEnd },
        type: 'resize',
      });
    };

    const onMouseUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      stopAutoScroll();

      const deltaY = me.clientY - startY;
      const deltaMinutes = deltaY / pixelsPerMinute;
      const newEndMinutes = snapToSlot(originalEndMinutes + deltaMinutes);

      if (newEndMinutes > eventStartMinutes + slotDuration) {
        const newEndHours = Math.floor(newEndMinutes / 60);
        const newEndMins = newEndMinutes % 60;
        const newEnd = setTime(event.end, newEndHours, newEndMins);
        callbacks.onEventResize?.(event, newEnd);
      }

      setInteraction(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [editable, pixelsPerMinute, snapToSlot, slotDuration, callbacks, startAutoScroll, stopAutoScroll]);

  // ─── Touch Resize (long press on resize handle) ───

  const onTouchResizeStart = useCallback((e: React.TouchEvent, event: CalendarEvent) => {
    if (!editable) return;

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const originalEndMinutes = minutesSinceMidnight(event.end);
    const eventStartMinutes = minutesSinceMidnight(event.start);

    const cancelLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onTouchMoveEarly = (te: TouchEvent) => {
      const t = te.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.sqrt(dx * dx + dy * dy) > TOUCH_MOVE_THRESHOLD) {
        cancelLongPress();
        document.removeEventListener('touchmove', onTouchMoveEarly);
        document.removeEventListener('touchend', onTouchEndEarly);
        document.removeEventListener('touchcancel', onTouchEndEarly);
      }
    };

    const onTouchEndEarly = () => {
      cancelLongPress();
      document.removeEventListener('touchmove', onTouchMoveEarly);
      document.removeEventListener('touchend', onTouchEndEarly);
      document.removeEventListener('touchcancel', onTouchEndEarly);
    };

    document.addEventListener('touchmove', onTouchMoveEarly, { passive: false });
    document.addEventListener('touchend', onTouchEndEarly);
    document.addEventListener('touchcancel', onTouchEndEarly);

    longPressTimerRef.current = setTimeout(() => {
      document.removeEventListener('touchmove', onTouchMoveEarly);
      document.removeEventListener('touchend', onTouchEndEarly);
      document.removeEventListener('touchcancel', onTouchEndEarly);

      if (navigator.vibrate) navigator.vibrate(50);

      setInteraction({
        affectedEventId: event.id,
        previewEvent: { ...event },
        type: 'resize',
      });

      document.body.style.userSelect = 'none';

      const onTouchMoveResize = (te: TouchEvent) => {
        te.preventDefault();
        startAutoScroll(te.touches[0].clientY);

        const deltaY = te.touches[0].clientY - startY;
        const deltaMinutes = deltaY / pixelsPerMinute;
        const newEndMinutes = snapToSlot(originalEndMinutes + deltaMinutes);

        if (newEndMinutes <= eventStartMinutes + slotDuration) return;

        const newEndHours = Math.floor(newEndMinutes / 60);
        const newEndMins = newEndMinutes % 60;
        const newEnd = setTime(event.end, newEndHours, newEndMins);

        setInteraction({
          affectedEventId: event.id,
          previewEvent: { ...event, end: newEnd },
          type: 'resize',
        });
      };

      const onTouchEndResize = (te: TouchEvent) => {
        document.removeEventListener('touchmove', onTouchMoveResize);
        document.removeEventListener('touchend', onTouchEndResize);
        document.removeEventListener('touchcancel', onTouchEndResize);
        document.body.style.userSelect = '';
        stopAutoScroll();

        const t = te.changedTouches[0];
        const deltaY = t.clientY - startY;
        const deltaMinutes = deltaY / pixelsPerMinute;
        const newEndMinutes = snapToSlot(originalEndMinutes + deltaMinutes);

        if (newEndMinutes > eventStartMinutes + slotDuration) {
          const newEndHours = Math.floor(newEndMinutes / 60);
          const newEndMins = newEndMinutes % 60;
          const newEnd = setTime(event.end, newEndHours, newEndMins);
          callbacks.onEventResize?.(event, newEnd);
        }

        setInteraction(null);
      };

      document.addEventListener('touchmove', onTouchMoveResize, { passive: false });
      document.addEventListener('touchend', onTouchEndResize);
      document.addEventListener('touchcancel', onTouchEndResize);
    }, LONG_PRESS_DELAY);
  }, [editable, pixelsPerMinute, snapToSlot, slotDuration, callbacks, startAutoScroll, stopAutoScroll]);

  // ─── Slot Selection ───

  const onSlotSelectStart = useCallback((e: React.MouseEvent, day: Date, chairIndex: number, startMinutes: number) => {
    if (!editable) return;
    e.preventDefault();

    const snappedStart = snapToSlot(startMinutes);
    let currentEnd = snappedStart + slotDuration;

    const highlight = document.createElement('div');
    highlight.className = 'dqcal-slot-selection';
    const column = (e.target as HTMLElement).closest('.dqcal-chair-column') as HTMLElement;
    if (!column) return;
    column.appendChild(highlight);

    const minParsed = parseTime(slotMinTime);
    const minMin = minParsed.hours * 60 + minParsed.minutes;

    const updateHighlight = (endMin: number) => {
      const topMin = Math.min(snappedStart, endMin);
      const bottomMin = Math.max(snappedStart + slotDuration, endMin);
      const top = (topMin - minMin) * pixelsPerMinute;
      const height = (bottomMin - topMin) * pixelsPerMinute;
      highlight.style.top = `${top}px`;
      highlight.style.height = `${height}px`;
    };
    updateHighlight(currentEnd);

    document.body.style.userSelect = 'none';

    const onMouseMove = (me: MouseEvent) => {
      const hit = hitTest(me.clientX, me.clientY);
      if (hit && hit.chairIndex === chairIndex) {
        currentEnd = snapToSlot(hit.minutes) + slotDuration;
        updateHighlight(currentEnd);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      highlight.remove();

      const finalStart = Math.min(snappedStart, currentEnd - slotDuration);
      const finalEnd = Math.max(snappedStart + slotDuration, currentEnd);
      const h1 = Math.floor(finalStart / 60);
      const m1 = finalStart % 60;
      const h2 = Math.floor(finalEnd / 60);
      const m2 = finalEnd % 60;
      callbacks.onSelect?.(setTime(day, h1, m1), setTime(day, h2, m2), chairIndex);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [editable, snapToSlot, slotDuration, slotMinTime, pixelsPerMinute, hitTest, callbacks]);

  return {
    interaction,
    onDragStart,
    onTouchStart,
    onResizeStart,
    onTouchResizeStart,
    onSlotSelectStart,
  };
}

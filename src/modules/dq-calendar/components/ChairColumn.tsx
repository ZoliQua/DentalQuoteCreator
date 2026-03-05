import { useCallback } from 'react';
import type { CalendarEvent, BusinessHours } from '../types';
import type { LayoutedEvent } from '../utils/eventLayout';
import type { InteractionState } from '../hooks/useDragDrop';
import { EventItem } from './EventItem';
import { parseTime, minutesSinceMidnight, isSameDay } from '../utils/dateUtils';

interface ChairColumnProps {
  day: Date;
  chairIndex: number;
  layoutedEvents: LayoutedEvent[];
  slots: { time: string; minutes: number }[];
  slotHeight: number;
  slotDuration: number;
  slotMinTime: string;
  businessHours: BusinessHours[];
  editable: boolean;
  selectable: boolean;
  timeFormat: '12h' | '24h';
  interaction: InteractionState | null;
  onEventClick?: (event: CalendarEvent) => void;
  onDragStart?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onTouchStart?: (e: React.TouchEvent, event: CalendarEvent) => void;
  onResizeStart?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onTouchResizeStart?: (e: React.TouchEvent, event: CalendarEvent) => void;
  onSlotSelectStart?: (e: React.MouseEvent, day: Date, chairIndex: number, startMinutes: number) => void;
}

export function ChairColumn({
  day,
  chairIndex,
  layoutedEvents,
  slots,
  slotHeight,
  slotDuration,
  slotMinTime,
  businessHours,
  editable,
  selectable,
  timeFormat,
  interaction,
  onEventClick,
  onDragStart,
  onTouchStart,
  onResizeStart,
  onTouchResizeStart,
  onSlotSelectStart,
}: ChairColumnProps) {
  const pixelsPerMinute = slotHeight / slotDuration;
  const min = parseTime(slotMinTime);
  const startMinutes = min.hours * 60 + min.minutes;
  const dayOfWeek = day.getDay();

  const isNonBusiness = useCallback((slotMinutes: number): boolean => {
    if (businessHours.length === 0) return false;
    return !businessHours.some(bh => {
      if (!bh.daysOfWeek.includes(dayOfWeek)) return true;
      const bhStart = parseTime(bh.startTime);
      const bhEnd = parseTime(bh.endTime);
      const bhStartMin = bhStart.hours * 60 + bhStart.minutes;
      const bhEndMin = bhEnd.hours * 60 + bhEnd.minutes;
      return slotMinutes >= bhStartMin && slotMinutes < bhEndMin;
    });
  }, [businessHours, dayOfWeek]);

  // Check if preview event belongs to this column
  const previewEvent = interaction?.previewEvent;
  const showPreview = previewEvent &&
    previewEvent.chairIndex === chairIndex &&
    isSameDay(previewEvent.start, day);

  // Count hidden events for +N more indicator
  const hiddenCount = layoutedEvents.filter(le => le.hidden).length;

  return (
    <div
      className="dqcal-chair-column"
      data-day={day.toISOString()}
      data-chair={chairIndex}
    >
      {/* Slot backgrounds */}
      {slots.map((slot, i) => (
        <div
          key={slot.time}
          className={`dqcal-slot ${isNonBusiness(slot.minutes) ? 'dqcal-slot--non-business' : ''} ${slot.minutes % 60 === 0 && i > 0 ? 'dqcal-slot--major' : ''}`}
          style={{ height: slotHeight }}
          onMouseDown={(e) => {
            if (!selectable || interaction || e.button !== 0) return;
            onSlotSelectStart?.(e, day, chairIndex, slot.minutes);
          }}
        />
      ))}

      {/* Regular events */}
      {layoutedEvents.map(({ event, left, width, hidden }) => {
        if (hidden) return null;
        const isAffected = interaction?.affectedEventId === event.id;
        const eventStartMin = Math.max(minutesSinceMidnight(event.start), startMinutes);
        const eventEndMin = minutesSinceMidnight(event.end);
        const top = (eventStartMin - startMinutes) * pixelsPerMinute;
        const height = (eventEndMin - eventStartMin) * pixelsPerMinute;

        return (
          <EventItem
            key={event.id}
            event={event}
            top={top}
            height={height}
            left={`${left * 100}%`}
            width={`calc(${width * 100}% - 2px)`}
            editable={editable}
            timeFormat={timeFormat}
            hidden={isAffected}
            onEventClick={onEventClick}
            onMouseDown={onDragStart}
            onTouchStart={onTouchStart}
            onResizeStart={onResizeStart}
            onTouchResizeStart={onTouchResizeStart}
          />
        );
      })}

      {/* +N more indicator for hidden events */}
      {hiddenCount > 0 && (
        <div className="dqcal-event-more">
          +{hiddenCount}
        </div>
      )}

      {/* Preview / placeholder event */}
      {showPreview && (
        <EventItem
          key={`preview-${previewEvent.id}`}
          event={previewEvent}
          top={(Math.max(minutesSinceMidnight(previewEvent.start), startMinutes) - startMinutes) * pixelsPerMinute}
          height={(minutesSinceMidnight(previewEvent.end) - Math.max(minutesSinceMidnight(previewEvent.start), startMinutes)) * pixelsPerMinute}
          left="0%"
          width="calc(100% - 2px)"
          editable={false}
          timeFormat={timeFormat}
          isMirror
        />
      )}
    </div>
  );
}

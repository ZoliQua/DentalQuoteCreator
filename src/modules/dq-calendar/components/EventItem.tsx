import { useRef } from 'react';
import type { CalendarEvent } from '../types';
import { formatTime } from '../utils/dateUtils';
import { RESIZE_HANDLE_HEIGHT, MIN_EVENT_HEIGHT } from '../utils/constants';

interface EventItemProps {
  event: CalendarEvent;
  top: number;
  height: number;
  left: string;
  width: string;
  editable: boolean;
  timeFormat: '12h' | '24h';
  /** Event is being dragged/resized — render invisible but keep layout space */
  hidden?: boolean;
  /** This is the grid placeholder (preview at projected position) */
  isMirror?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onTouchStart?: (e: React.TouchEvent, event: CalendarEvent) => void;
  onResizeStart?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onTouchResizeStart?: (e: React.TouchEvent, event: CalendarEvent) => void;
}

export function EventItem({
  event,
  top,
  height,
  left,
  width,
  editable,
  timeFormat,
  hidden,
  isMirror,
  onEventClick,
  onMouseDown,
  onTouchStart,
  onResizeStart,
  onTouchResizeStart,
}: EventItemProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const renderedHeight = Math.max(height, MIN_EVENT_HEIGHT);
  const isCompact = renderedHeight < 36;
  const bg = event.backgroundColor || 'var(--dqcal-primary)';
  const appt = event.extendedProps?.appointment as { recurrenceRule?: string; recurrenceParentId?: string } | undefined;
  const isRecurring = !!(appt?.recurrenceRule || appt?.recurrenceParentId);

  const classNames = [
    'dqcal-event',
    editable && !isMirror ? 'dqcal-event--editable' : '',
    isCompact ? 'dqcal-event--compact' : '',
    hidden ? 'dqcal-event--hidden' : '',
    isMirror ? 'dqcal-event--placeholder' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={elRef}
      className={classNames}
      style={{
        top,
        height: renderedHeight,
        left,
        width,
        backgroundColor: bg,
      }}
      onMouseDown={(e) => {
        if (isMirror || !editable) return;
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).classList.contains('dqcal-event__resize-handle')) return;
        onMouseDown?.(e, event);
      }}
      onTouchStart={(e) => {
        if (isMirror || !editable) return;
        onTouchStart?.(e, event);
      }}
      onClick={(e) => {
        if (isMirror) return;
        e.stopPropagation();
        onEventClick?.(event);
      }}
    >
      <div className="dqcal-event__content">
        {isCompact ? (
          <>
            {isRecurring && <span className="dqcal-event__recurrence-icon" title="Recurring"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h13"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H4"/></svg></span>}
            <span className="dqcal-event__title">{event.title}</span>
          </>
        ) : (
          <>
            <span className="dqcal-event__time">
              {isRecurring && <span className="dqcal-event__recurrence-icon" title="Recurring"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h13"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H4"/></svg></span>}
              {formatTime(event.start, timeFormat)} – {formatTime(event.end, timeFormat)}
            </span>
            <span className="dqcal-event__title">{event.title}</span>
          </>
        )}
      </div>
      {editable && !isMirror && renderedHeight > MIN_EVENT_HEIGHT && (
        <div
          className="dqcal-event__resize-handle"
          style={{ height: RESIZE_HANDLE_HEIGHT }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart?.(e, event);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onTouchResizeStart?.(e, event);
          }}
        />
      )}
    </div>
  );
}

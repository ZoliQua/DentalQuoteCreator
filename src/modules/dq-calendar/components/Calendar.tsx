import { useEffect, useMemo, useState } from 'react';
import type { CalendarConfig, CalendarCallbacks, CalendarLabels, Chair, CalendarHeightMode } from '../types';
import { useCalendarNav } from '../hooks/useCalendarNav';
import { useDragDrop } from '../hooks/useDragDrop';
import { Toolbar } from './Toolbar';
import { TimeGrid } from './TimeGrid';
import { MonthGrid } from './MonthGrid';
import { PIXELS_PER_HOUR_XSMALL, PIXELS_PER_HOUR_SMALL, PIXELS_PER_HOUR_MEDIUM, PIXELS_PER_HOUR_LONG, DEFAULT_SLOT_DURATION } from '../utils/constants';

const HEIGHT_MODE_PX: Record<CalendarHeightMode, number> = {
  xsmall: PIXELS_PER_HOUR_XSMALL,
  small: PIXELS_PER_HOUR_SMALL,
  medium: PIXELS_PER_HOUR_MEDIUM,
  long: PIXELS_PER_HOUR_LONG,
};

interface CalendarProps {
  config: CalendarConfig;
  callbacks: CalendarCallbacks;
  labels: CalendarLabels;
}

export function Calendar({ config, callbacks, labels }: CalendarProps) {
  const {
    slotDuration = DEFAULT_SLOT_DURATION,
    slotMinTime = '07:00',
    slotMaxTime = '20:00',
    businessHours = [],
    defaultView = 'week',
    weekends = true,
    events = [],
    chairs = [],
    firstDayOfWeek = 1,
    timeFormat = '24h',
    editable = false,
    selectable = false,
    nowIndicator = true,
    slotEventOverlap = true,
    eventMaxStack,
    maxSideBySide,
  } = config;

  // Height mode state
  const [heightMode, setHeightMode] = useState<CalendarHeightMode>('long');

  // Dynamic slot height based on height mode
  const slotsPerHour = 60 / slotDuration;
  const pixelsPerHour = HEIGHT_MODE_PX[heightMode];
  const slotHeight = pixelsPerHour / slotsPerHour;

  const nav = useCalendarNav({
    defaultView,
    firstDayOfWeek,
    weekends,
    labels,
    callbacks,
  });

  const dragDrop = useDragDrop({
    slotDuration,
    slotMinTime,
    slotHeight,
    callbacks,
    editable: editable ?? false,
  });

  // Multi-chair selection logic
  const activeChairs = useMemo(() => chairs.filter(c => c.isActive), [chairs]);

  const maxVisible = useMemo(() => {
    if (!maxSideBySide) {
      return nav.currentView === 'day' ? 7 : 3;
    }
    switch (nav.currentView) {
      case 'day': return maxSideBySide.day;
      case 'week': return weekends ? maxSideBySide.weekWithWeekends : maxSideBySide.weekWithoutWeekends;
      case 'month': return 1;
    }
  }, [nav.currentView, weekends, maxSideBySide]);

  const showChairSelector = activeChairs.length > 1 && nav.currentView !== 'month';

  const [selectedChairIds, setSelectedChairIds] = useState<Set<string>>(() => {
    return new Set(activeChairs.slice(0, maxVisible).map(c => c.id));
  });

  // Trim selection when maxVisible decreases (e.g. switching day→week)
  useEffect(() => {
    setSelectedChairIds(prev => {
      if (prev.size <= maxVisible) return prev;
      const trimmed = new Set([...prev].slice(0, maxVisible));
      return trimmed;
    });
  }, [maxVisible]);

  const visibleChairs = useMemo((): Chair[] => {
    if (nav.currentView === 'month') {
      return activeChairs.length > 0 ? [activeChairs[0]] : [];
    }
    // Always filter by selection
    const selected = activeChairs.filter(c => selectedChairIds.has(c.id));
    return selected.length > 0 ? selected : activeChairs.slice(0, 1);
  }, [nav.currentView, activeChairs, selectedChairIds]);

  const toggleChair = (chairId: string) => {
    setSelectedChairIds(prev => {
      const next = new Set(prev);
      if (next.has(chairId)) {
        if (next.size > 1) next.delete(chairId);
      } else if (next.size < maxVisible) {
        next.add(chairId);
      }
      return next;
    });
  };

  return (
    <div className="dqcal">
      <Toolbar
        title={nav.title}
        currentView={nav.currentView}
        heightMode={heightMode}
        labels={labels}
        onPrev={nav.prev}
        onNext={nav.next}
        onToday={nav.today}
        onViewChange={nav.changeView}
        onHeightModeChange={setHeightMode}
      />

      {/* Chair selector */}
      {showChairSelector && (
        <div className="dqcal-chair-selector">
          <span className="dqcal-chair-selector__label">{labels.selectChairs}:</span>
          {activeChairs.map(chair => (
            <label key={chair.id} className="dqcal-chair-selector__item">
              <input
                type="checkbox"
                checked={selectedChairIds.has(chair.id)}
                onChange={() => toggleChair(chair.id)}
              />
              <span>{chair.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Calendar view */}
      {nav.currentView === 'month' ? (
        <MonthGrid
          currentDate={nav.currentDate}
          events={events}
          firstDayOfWeek={firstDayOfWeek}
          weekdaysShort={labels.weekdays}
          callbacks={callbacks}
          moreLabel={labels.more}
        />
      ) : (
        <TimeGrid
          currentDate={nav.currentDate}
          view={nav.currentView}
          events={events}
          chairs={visibleChairs}
          slotDuration={slotDuration}
          slotMinTime={slotMinTime}
          slotMaxTime={slotMaxTime}
          slotHeight={slotHeight}
          businessHours={businessHours}
          weekends={weekends}
          firstDayOfWeek={firstDayOfWeek}
          editable={editable ?? false}
          selectable={selectable ?? false}
          nowIndicator={nowIndicator ?? true}
          timeFormat={timeFormat}
          weekdaysShort={labels.weekdays}
          allDayLabel={labels.allDay}
          moreLabel={labels.more}
          slotEventOverlap={slotEventOverlap}
          eventMaxStack={eventMaxStack}
          callbacks={callbacks}
          interaction={dragDrop.interaction}
          onDragStart={dragDrop.onDragStart}
          onTouchStart={dragDrop.onTouchStart}
          onResizeStart={dragDrop.onResizeStart}
          onTouchResizeStart={dragDrop.onTouchResizeStart}
          onSlotSelectStart={dragDrop.onSlotSelectStart}
        />
      )}
    </div>
  );
}

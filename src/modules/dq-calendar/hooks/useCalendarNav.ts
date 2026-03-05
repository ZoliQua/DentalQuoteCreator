import { useState, useCallback, useEffect, useRef } from 'react';
import type { CalendarView, CalendarCallbacks, CalendarLabels } from '../types';
import { addDays, addMonths, startOfDay, formatViewTitle, getViewRange } from '../utils/dateUtils';

interface UseCalendarNavOptions {
  defaultView: CalendarView;
  defaultDate?: Date;
  firstDayOfWeek: number;
  weekends: boolean;
  labels: CalendarLabels;
  callbacks: CalendarCallbacks;
}

export function useCalendarNav({
  defaultView,
  defaultDate,
  firstDayOfWeek,
  weekends,
  labels,
  callbacks,
}: UseCalendarNavOptions) {
  const [currentView, setCurrentView] = useState<CalendarView>(defaultView);
  const [currentDate, setCurrentDate] = useState<Date>(defaultDate || startOfDay(new Date()));

  const title = formatViewTitle(currentDate, currentView, labels.months, firstDayOfWeek, weekends);

  // Notify parent of date/view changes
  const notifyDatesChange = useCallback((date: Date, view: CalendarView) => {
    const { start, end } = getViewRange(date, view, firstDayOfWeek);
    const t = formatViewTitle(date, view, labels.months, firstDayOfWeek, weekends);
    callbacks.onDatesChange?.(start, end, view, t);
  }, [firstDayOfWeek, weekends, labels.months, callbacks]);

  // Initial notification + sync when defaultView changes (e.g. sidebar/route navigation)
  const prevDefaultViewRef = useRef<CalendarView | null>(null);
  useEffect(() => {
    if (prevDefaultViewRef.current === null) {
      // First render — initial notification
      prevDefaultViewRef.current = defaultView;
      notifyDatesChange(currentDate, currentView);
    } else if (defaultView !== prevDefaultViewRef.current) {
      // defaultView prop changed (sidebar link clicked)
      prevDefaultViewRef.current = defaultView;
      setCurrentView(defaultView);
      notifyDatesChange(currentDate, defaultView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultView]);

  const goToDate = useCallback((date: Date) => {
    setCurrentDate(date);
    notifyDatesChange(date, currentView);
  }, [currentView, notifyDatesChange]);

  const prev = useCallback(() => {
    setCurrentDate(d => {
      let newDate: Date;
      switch (currentView) {
        case 'day':
          newDate = addDays(d, -1);
          break;
        case 'week':
          newDate = addDays(d, -7);
          break;
        case 'month':
          newDate = addMonths(d, -1);
          break;
      }
      notifyDatesChange(newDate, currentView);
      return newDate;
    });
  }, [currentView, notifyDatesChange]);

  const next = useCallback(() => {
    setCurrentDate(d => {
      let newDate: Date;
      switch (currentView) {
        case 'day':
          newDate = addDays(d, 1);
          break;
        case 'week':
          newDate = addDays(d, 7);
          break;
        case 'month':
          newDate = addMonths(d, 1);
          break;
      }
      notifyDatesChange(newDate, currentView);
      return newDate;
    });
  }, [currentView, notifyDatesChange]);

  const today = useCallback(() => {
    const now = startOfDay(new Date());
    setCurrentDate(now);
    notifyDatesChange(now, currentView);
  }, [currentView, notifyDatesChange]);

  const changeView = useCallback((view: CalendarView) => {
    setCurrentView(view);
    callbacks.onViewChange?.(view);
    notifyDatesChange(currentDate, view);
  }, [currentDate, callbacks, notifyDatesChange]);

  return {
    currentView,
    currentDate,
    title,
    prev,
    next,
    today,
    changeView,
    goToDate,
  };
}

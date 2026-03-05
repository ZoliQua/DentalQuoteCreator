// ── Event ──
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  backgroundColor?: string;
  chairIndex?: number;
  extendedProps?: Record<string, unknown>;
}

// ── View ──
export type CalendarView = 'day' | 'week' | 'month';

// ── Height mode ──
export type CalendarHeightMode = 'xsmall' | 'small' | 'medium' | 'long';

// ── Business Hours ──
export interface BusinessHours {
  daysOfWeek: number[];
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

// ── Chair ──
export interface Chair {
  id: string;
  index: number;    // 0-based chairIndex
  label: string;    // Localized name
  isActive: boolean;
}

// ── Calendar Config (props) ──
export interface CalendarConfig {
  // Time
  slotDuration: number;           // in minutes (5, 10, 15, 30...)
  slotMinTime: string;            // "07:00"
  slotMaxTime: string;            // "20:00"
  businessHours: BusinessHours[];

  // View
  defaultView: CalendarView;
  weekends: boolean;

  // Data
  events: CalendarEvent[];
  chairs: Chair[];

  // Locale
  locale: string;                 // "hu" | "en" | "de"
  firstDayOfWeek?: number;        // 0=Sunday, 1=Monday (default: 1)

  // Formatting
  timeFormat?: '12h' | '24h';    // Default: 24h

  // Feature flags
  editable?: boolean;             // Drag & drop + resize
  selectable?: boolean;           // Click on empty slots
  nowIndicator?: boolean;         // Current time indicator
  slotEventOverlap?: boolean;     // Overlapping events use card-style overlap (default: true)
  eventMaxStack?: number;         // Max visible events per slot, rest hidden behind +N more

  // Multi-chair
  maxSideBySide?: {
    day: number;                  // Default: 7
    weekWithWeekends: number;     // Default: 2
    weekWithoutWeekends: number;  // Default: 3
  };
}

// ── Labels (i18n via parent) ──
export interface CalendarLabels {
  today: string;
  month: string;
  week: string;
  day: string;
  allChairs: string;
  selectChairs: string;
  allDay: string;         // "Egész nap" / "All day" / "Ganztägig"
  more: string;           // "+{n} more" pattern — use {n} placeholder
  weekdays: string[];     // Short names ["H","K","Sze","Cs","P","Szo","V"]
  weekdaysFull: string[]; // Full names
  months: string[];       // 12 month names
}

// ── Callbacks ──
export interface CalendarCallbacks {
  onEventClick?: (event: CalendarEvent) => void;
  onEventDrop?: (event: CalendarEvent, newStart: Date, newEnd: Date, newChairIndex?: number) => void;
  onEventResize?: (event: CalendarEvent, newEnd: Date) => void;
  onSelect?: (start: Date, end: Date, chairIndex?: number) => void;
  onDatesChange?: (start: Date, end: Date, view: CalendarView, title: string) => void;
  onViewChange?: (view: CalendarView) => void;
}

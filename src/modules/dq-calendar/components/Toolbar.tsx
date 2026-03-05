import type { CalendarView, CalendarHeightMode } from '../types';

interface ToolbarProps {
  title: string;
  currentView: CalendarView;
  heightMode: CalendarHeightMode;
  labels: {
    today: string;
    month: string;
    week: string;
    day: string;
  };
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onHeightModeChange: (mode: CalendarHeightMode) => void;
}

const HEIGHT_MODES: { mode: CalendarHeightMode; lines: number }[] = [
  { mode: 'xsmall', lines: 1 },
  { mode: 'small', lines: 2 },
  { mode: 'medium', lines: 3 },
  { mode: 'long', lines: 4 },
];

function HeightIcon({ lines }: { lines: number }) {
  // Horizontal bars indicating density — fewer bars = more compact
  const gap = 12 / (lines + 1);
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      {Array.from({ length: lines }, (_, i) => (
        <line
          key={i}
          x1="2" y1={gap * (i + 1) + 1}
          x2="12" y2={gap * (i + 1) + 1}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function Toolbar({
  title,
  currentView,
  heightMode,
  labels,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onHeightModeChange,
}: ToolbarProps) {
  const viewButtons: { view: CalendarView; label: string }[] = [
    { view: 'month', label: labels.month },
    { view: 'week', label: labels.week },
    { view: 'day', label: labels.day },
  ];

  return (
    <div className="dqcal-toolbar">
      <div className="dqcal-toolbar__left">
        <button className="dqcal-btn dqcal-btn--nav" onClick={onPrev} aria-label="Previous">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="dqcal-btn dqcal-btn--nav" onClick={onNext} aria-label="Next">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="dqcal-btn dqcal-btn--today" onClick={onToday}>
          {labels.today}
        </button>
      </div>

      <div className="dqcal-toolbar__center">
        <h2 className="dqcal-toolbar__title">{title}</h2>
      </div>

      <div className="dqcal-toolbar__right">
        {currentView !== 'month' && (
          <div className="dqcal-btn-group dqcal-height-selector">
            {HEIGHT_MODES.map(({ mode, lines }) => (
              <button
                key={mode}
                className={`dqcal-btn dqcal-btn--view dqcal-btn--height ${heightMode === mode ? 'dqcal-btn--active' : ''}`}
                onClick={() => onHeightModeChange(mode)}
                title={mode}
              >
                <HeightIcon lines={lines} />
              </button>
            ))}
          </div>
        )}
        <div className="dqcal-btn-group">
          {viewButtons.map(({ view, label }) => (
            <button
              key={view}
              className={`dqcal-btn dqcal-btn--view ${currentView === view ? 'dqcal-btn--active' : ''}`}
              onClick={() => onViewChange(view)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

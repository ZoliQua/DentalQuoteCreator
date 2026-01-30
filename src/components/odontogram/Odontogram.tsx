import React from 'react';
import { FDITooth, ToothState, ToothStatus } from '../../types';

const TOOTH_ICON_FILES = import.meta.glob('../../assets/teeth/*.svg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const TOOTH_ICON_MAP = Object.entries(TOOTH_ICON_FILES).reduce((acc, [path, url]) => {
  const match = path.match(/\/(\d{2})\.svg$/);
  if (match) {
    acc[match[1] as FDITooth] = url;
  }
  return acc;
}, {} as Record<FDITooth, string>);

const UPPER_TEETH: FDITooth[] = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
];

const LOWER_TEETH: FDITooth[] = [
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
];

const STATUS_DOT_CLASS: Record<ToothState, string> = {
  healthy: 'bg-transparent',
  caries: 'bg-rose-500',
  filled: 'bg-sky-500',
  endo: 'bg-purple-500',
  crown: 'bg-amber-400',
  implant: 'bg-slate-400',
  prosthesis: 'bg-emerald-500',
  missing: 'bg-gray-400',
};

interface OdontogramProps {
  teeth: Record<FDITooth, ToothStatus>;
  selectedTooth?: FDITooth;
  onSelect?: (toothId: FDITooth) => void;
}

export function Odontogram({ teeth, selectedTooth, onSelect }: OdontogramProps) {
  const renderTooth = (toothId: FDITooth) => {
    const status = teeth[toothId];
    const isSelected = selectedTooth === toothId;
    const isMissing = status.state === 'missing';
    const isHealthy = status.state === 'healthy';
    const isInteractive = Boolean(onSelect);

    return (
      <div key={toothId} className="flex flex-col items-center">
        <button
          type="button"
          className={`group relative w-20 h-24 rounded-md overflow-hidden p-1 transition-colors focus:outline-none ${
            isSelected ? 'bg-gray-300' : 'hover:bg-gray-300'
          } ${isInteractive ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => onSelect && onSelect(toothId)}
          disabled={!isInteractive}
          aria-pressed={isSelected}
          aria-label={`Fog ${toothId}`}
        >
          <img
            src={TOOTH_ICON_MAP[toothId]}
            alt=""
            className={`w-full h-full object-contain transition ${isMissing ? 'opacity-30 grayscale' : ''} ${
              isSelected ? 'brightness-90' : 'group-hover:brightness-90'
            }`}
          />
          {!isHealthy && !isMissing && (
            <span
              className={`absolute top-1 right-1 w-3 h-3 rounded-full ${STATUS_DOT_CLASS[status.state]}`}
            />
          )}
          {status.state === 'endo' && (
            <span className="absolute left-1/2 top-1 w-0.5 h-8 bg-purple-600 -translate-x-1/2" />
          )}
          {status.state === 'crown' && (
            <span className="absolute left-1/2 bottom-1 w-4 h-1.5 bg-amber-400 -translate-x-1/2 rounded-full" />
          )}
          {status.state === 'implant' && (
            <span className="absolute bottom-1 right-1 text-slate-500">
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2v9" />
                <path d="M5 11h6" />
                <path d="M6 14h4" />
              </svg>
            </span>
          )}
          {status.state === 'prosthesis' && (
            <span className="absolute bottom-1 right-1 text-emerald-500">
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 10h10" />
                <path d="M4 6h2v4H4z" />
                <path d="M10 6h2v4h-2z" />
              </svg>
            </span>
          )}
          {isMissing && (
            <span className="absolute inset-0">
              <span className="absolute inset-1 border-t-2 border-gray-400 rotate-45" />
            </span>
          )}
        </button>
        <span className="text-xs text-gray-600 mt-0.5">{toothId}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-8 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
        {UPPER_TEETH.map(renderTooth)}
      </div>
      <div className="grid grid-cols-8 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
        {LOWER_TEETH.map(renderTooth)}
      </div>
    </div>
  );
}

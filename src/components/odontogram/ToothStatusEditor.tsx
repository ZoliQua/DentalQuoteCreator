import { useMemo } from 'react';
import { TextArea } from '../common';
import { FDITooth, ToothState, ToothStatus } from '../../types';
import { getCurrentDateString } from '../../utils';

const STATUS_OPTIONS: { value: ToothState; label: string; className: string }[] = [
  { value: 'healthy', label: 'Egészséges', className: 'border-gray-300 text-gray-700' },
  { value: 'filled', label: 'Tömött', className: 'border-sky-400 text-sky-700' },
  { value: 'caries', label: 'Szuvas', className: 'border-rose-400 text-rose-700' },
  { value: 'endo', label: 'Gyökérkezelt', className: 'border-purple-400 text-purple-700' },
  { value: 'crown', label: 'Korona', className: 'border-amber-400 text-amber-700' },
  { value: 'implant', label: 'Implantátum', className: 'border-slate-400 text-slate-700' },
  { value: 'prosthesis', label: 'Protézis', className: 'border-emerald-400 text-emerald-700' },
  { value: 'missing', label: 'Hiány', className: 'border-gray-400 text-gray-700' },
];

interface ToothStatusEditorProps {
  toothId?: FDITooth;
  status?: ToothStatus;
  readOnly?: boolean;
  onChange?: (next: ToothStatus) => void;
}

export function ToothStatusEditor({ toothId, status, readOnly, onChange }: ToothStatusEditorProps) {
  const currentStatus = useMemo(() => {
    if (!status) {
      return {
        state: 'healthy' as ToothState,
        updatedAt: getCurrentDateString(),
      };
    }
    return status;
  }, [status]);

  if (!toothId) {
    return (
      <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-4">
        Válasszon ki egy fogat a státusz módosításához.
      </div>
    );
  }

  const handleStatusChange = (state: ToothState) => {
    if (readOnly || !onChange) return;
    onChange({
      ...currentStatus,
      state,
      updatedAt: getCurrentDateString(),
    });
  };

  const handleSurfaceNoteChange = (value: string) => {
    if (readOnly || !onChange) return;
    onChange({
      ...currentStatus,
      surfaceNote: value,
      updatedAt: getCurrentDateString(),
    });
  };

  const handleCommentChange = (value: string) => {
    if (readOnly || !onChange) return;
    onChange({
      ...currentStatus,
      comment: value,
      updatedAt: getCurrentDateString(),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500 mb-2">Kiválasztott fog</p>
        <p className="text-lg font-semibold text-gray-900">{toothId}</p>
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-2">Státusz</p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map((option) => {
            const isActive = option.value === currentStatus.state;
            return (
              <button
                key={option.value}
                type="button"
                className={`px-3 py-2 rounded-md border text-sm font-medium transition ${
                  option.className
                } ${isActive ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'} ${
                  readOnly ? 'cursor-default' : 'cursor-pointer'
                }`}
                onClick={() => handleStatusChange(option.value)}
                disabled={readOnly}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <TextArea
        label="Felszínek (pl. MOD, O, B)"
        value={currentStatus.surfaceNote || ''}
        onChange={(event) => handleSurfaceNoteChange(event.target.value)}
        placeholder="Szabad szöveg"
        rows={2}
        disabled={readOnly}
      />

      <TextArea
        label="Megjegyzés"
        value={currentStatus.comment || ''}
        onChange={(event) => handleCommentChange(event.target.value)}
        placeholder="Opcionális megjegyzés"
        rows={3}
        disabled={readOnly}
      />
    </div>
  );
}

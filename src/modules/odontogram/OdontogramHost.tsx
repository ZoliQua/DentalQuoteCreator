import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import OdontogramApp from '@odontogram-shell';
import type { OdontogramState } from './types';
import './odontogramHost.css';
import '../../../test_uis/odontogram_editor_v4/src/index.css';
import { useSettings } from '../../context/SettingsContext';

export type OdontogramHostProps = {
  patientId: string;
  mode: 'view' | 'edit';
  initialState: OdontogramState | null;
  onChange: (nextState: OdontogramState) => void;
};

export type OdontogramHostHandle = {
  importState: (state: OdontogramState) => Promise<void>;
  exportState: () => Promise<OdontogramState | null>;
  syncViewMode: () => Promise<void>;
};

const EXPORT_BUTTON_ID = 'btnStatusExport';
const IMPORT_INPUT_ID = 'statusImportInput';

const waitForElement = async (
  root: HTMLElement | null,
  selector: string,
  attempts = 12
) => {
  for (let i = 0; i < attempts; i += 1) {
    if (root?.querySelector(selector)) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

const captureExportState = async (root: HTMLElement | null): Promise<OdontogramState | null> => {
  const exportBtn = root?.querySelector(`#${EXPORT_BUTTON_ID}`) as HTMLButtonElement | null;
  if (!exportBtn) return null;

  let capturedBlob: Blob | null = null;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  URL.createObjectURL = (blob: Blob) => {
    capturedBlob = blob;
    return 'blob:odontogram-capture';
  };

  HTMLAnchorElement.prototype.click = () => {};

  try {
    exportBtn.click();
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }

  if (!capturedBlob) return null;
  try {
    const blob = capturedBlob as Blob;
    const text = await blob.text();
    return JSON.parse(text) as OdontogramState;
  } catch {
    return null;
  }
};

const importStateIntoOdontogram = async (root: HTMLElement | null, state: OdontogramState) => {
  await waitForElement(root, `#${IMPORT_INPUT_ID}`);
  const input = root?.querySelector(`#${IMPORT_INPUT_ID}`) as HTMLInputElement | null;
  if (!input) return;
  const file = new File([JSON.stringify(state)], 'odontogram.json', {
    type: 'application/json',
  });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

export const OdontogramHost = forwardRef<OdontogramHostHandle, OdontogramHostProps>(
  ({ mode, initialState, onChange, patientId }, ref) => {
    const {
      appLanguage,
      setAppLanguage,
      odontogramNumbering,
      setOdontogramNumbering,
    } = useSettings();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const mutationTimerRef = useRef<number | null>(null);
    const suppressMutationsRef = useRef(false);
    const lastImportedRef = useRef<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        importState: (state) => importStateIntoOdontogram(rootRef.current, state),
        exportState: () => captureExportState(rootRef.current),
        syncViewMode: async () => {
          const root = rootRef.current;
          if (!root) return;
          const clearButton = root.querySelector('#btnSelectNoneChart') as HTMLButtonElement | null;
          clearButton?.click();
          const state = await captureExportState(root);
          if (state) {
            await importStateIntoOdontogram(root, state);
          }
        },
      }),
      []
    );

    useEffect(() => {
      if (!initialState) return;
      const serialized = JSON.stringify(initialState);
      if (lastImportedRef.current === serialized) return;
      lastImportedRef.current = serialized;

      let cancelled = false;
      suppressMutationsRef.current = true;
      const run = async () => {
        await importStateIntoOdontogram(rootRef.current, initialState);
        if (!cancelled) {
          window.setTimeout(() => {
            suppressMutationsRef.current = false;
          }, 0);
        }
      };
      run();

      return () => {
        cancelled = true;
        suppressMutationsRef.current = false;
      };
    }, [initialState, patientId]);

    useEffect(() => {
      const target = rootRef.current;
      if (!target) return;

      const observer = new MutationObserver(() => {
        if (mode !== 'edit' || suppressMutationsRef.current) return;
        if (mutationTimerRef.current) {
          window.clearTimeout(mutationTimerRef.current);
        }
        mutationTimerRef.current = window.setTimeout(async () => {
          const state = await captureExportState(rootRef.current);
          if (state) {
            onChange(state);
          }
        }, 200);
      });

      observer.observe(target, {
        attributes: true,
        childList: true,
        subtree: true,
      });

      return () => {
        observer.disconnect();
        if (mutationTimerRef.current) {
          window.clearTimeout(mutationTimerRef.current);
        }
      };
    }, [mode, onChange]);

    useEffect(() => {
      if (mode !== 'view') return;
      const clearSelection = async () => {
        const root = rootRef.current;
        if (!root) return;
        const clearButton = root.querySelector('#btnSelectNoneChart') as HTMLButtonElement | null;
        clearButton?.click();
        const state = await captureExportState(root);
        if (state) {
          await importStateIntoOdontogram(root, state);
        }
      };
      clearSelection();
    }, [mode]);

    return (
      <div
        className={`odontogram-host odontogram-host--embedded ${
          mode === 'view' ? 'odontogram-host--view' : 'odontogram-host--edit'
        }`}
        ref={rootRef}
      >
        <div className="odontogram-host__content">
          <OdontogramApp
            language={appLanguage}
            onLanguageChange={setAppLanguage}
            numberingSystem={odontogramNumbering}
            onNumberingChange={setOdontogramNumbering}
          />
        </div>
      </div>
    );
  }
);

OdontogramHost.displayName = 'OdontogramHost';

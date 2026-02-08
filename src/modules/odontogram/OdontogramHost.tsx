import { type ReactNode, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import OdontogramApp from '@odontogram-shell';
import { createPortal } from 'react-dom';
import type { OdontogramState } from './types';
import './odontogramHost.css';
import '../../../test_uis/odontogram_editor_v4/src/index.css';
import { useSettings } from '../../context/SettingsContext';

export type OdontogramHostProps = {
  patientId: string;
  mode: 'view' | 'edit';
  initialState: OdontogramState | null;
  onChange: (nextState: OdontogramState) => void;
  panelContent?: ReactNode;
  hidePanel?: boolean;
};

export type OdontogramHostHandle = {
  importState: (state: OdontogramState) => Promise<void>;
  exportState: () => Promise<OdontogramState | null>;
  syncViewMode: () => Promise<void>;
};

const EXPORT_BUTTON_ID = 'btnStatusExport';
const IMPORT_INPUT_ID = 'statusImportInput';
const TOGGLE_TARGETS: Record<string, { selector: string; collapsedClass: string }> = {
  btnToggleControlsCard: { selector: '#controlsActions', collapsedClass: 'hidden' },
  btnToggleStatusCard: { selector: '#statusCard', collapsedClass: 'collapsed' },
  btnToggleCariesCard: { selector: '#cariesSection', collapsedClass: 'collapsed' },
  btnToggleFillingCard: { selector: '#fillingSection', collapsedClass: 'collapsed' },
  btnToggleEndoCard: { selector: '#endoSection', collapsedClass: 'collapsed' },
  btnToggleInflammationCard: { selector: '#inflammationSection', collapsedClass: 'collapsed' },
};

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

const setToggleIcon = (button: HTMLElement, collapsed: boolean) => {
  const icon = button.querySelector('.toggle-icon');
  if (icon) {
    icon.textContent = collapsed ? '+' : '−';
  }
};

const togglePanelSection = (root: HTMLElement | null, buttonId: string): boolean => {
  if (!root) return false;
  const targetCfg = TOGGLE_TARGETS[buttonId];
  if (!targetCfg) return false;
  const target = root.querySelector(targetCfg.selector) as HTMLElement | null;
  const button = root.querySelector(`#${buttonId}`) as HTMLElement | null;
  if (!target || !button) return false;
  const collapsed = target.classList.toggle(targetCfg.collapsedClass);
  setToggleIcon(button, collapsed);
  return true;
};

const collapsePanelSectionsByDefault = (root: HTMLElement | null) => {
  if (!root) return;
  Object.entries(TOGGLE_TARGETS).forEach(([buttonId, cfg]) => {
    const target = root.querySelector(cfg.selector) as HTMLElement | null;
    const button = root.querySelector(`#${buttonId}`) as HTMLElement | null;
    if (!target || !button) return;
    if (!target.classList.contains(cfg.collapsedClass)) {
      target.classList.add(cfg.collapsedClass);
    }
    setToggleIcon(button, true);
  });
};

export const OdontogramHost = forwardRef<OdontogramHostHandle, OdontogramHostProps>(
  ({ mode, initialState, onChange, patientId, panelContent, hidePanel = false }, ref) => {
    const {
      appLanguage,
      setAppLanguage,
      odontogramNumbering,
      setOdontogramNumbering,
    } = useSettings();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [panelSlotRoot, setPanelSlotRoot] = useState<HTMLElement | null>(null);
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

    useEffect(() => {
      if (mode !== 'edit') return;
      const frame = window.requestAnimationFrame(() => {
        collapsePanelSectionsByDefault(rootRef.current);
      });
      return () => window.cancelAnimationFrame(frame);
    }, [mode]);

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      const onClickCapture = (event: Event) => {
        if (mode !== 'edit') return;
        const target = event.target as Element | null;
        const button = target?.closest('button[id]') as HTMLButtonElement | null;
        if (!button) return;
        if (!TOGGLE_TARGETS[button.id]) return;
        event.preventDefault();
        event.stopPropagation();
        togglePanelSection(rootRef.current, button.id);
      };
      root.addEventListener('click', onClickCapture, true);
      return () => root.removeEventListener('click', onClickCapture, true);
    }, [mode]);

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      const updatePanelRoot = () => {
        const panel = root.querySelector('.panel') as HTMLElement | null;
        if (!panel) {
          setPanelSlotRoot(null);
          return;
        }
        let slot = panel.querySelector('.odontogram-host__panel-slot') as HTMLElement | null;
        if (!slot) {
          slot = document.createElement('div');
          slot.className = 'odontogram-host__panel-slot';
        }
        if (panel.firstElementChild !== slot) {
          panel.prepend(slot);
        }
        setPanelSlotRoot(slot);
      };
      updatePanelRoot();
      const observer = new MutationObserver(updatePanelRoot);
      observer.observe(root, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        const slot = root.querySelector('.odontogram-host__panel-slot');
        slot?.remove();
      };
    }, []);

    return (
      <div
        className={`odontogram-host odontogram-host--embedded ${
          mode === 'view' ? 'odontogram-host--view' : 'odontogram-host--edit'
        } ${hidePanel ? 'odontogram-host--no-panel' : ''}`}
        ref={rootRef}
      >
        <div className="odontogram-host__content">
          <OdontogramApp
            language={appLanguage}
            onLanguageChange={setAppLanguage}
            numberingSystem={odontogramNumbering}
            onNumberingChange={setOdontogramNumbering}
          />
          {panelSlotRoot && panelContent ? createPortal(panelContent, panelSlotRoot) : null}
        </div>
      </div>
    );
  }
);

OdontogramHost.displayName = 'OdontogramHost';

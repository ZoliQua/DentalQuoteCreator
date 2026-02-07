import { useEffect, useRef, useState } from 'react';
import { Button, Card, CardContent, CardHeader, TextArea } from '../components/common';
import { OdontogramHost, OdontogramHostHandle } from '../modules/odontogram/OdontogramHost';
import { loadCurrent } from '../modules/odontogram/odontogramStorage';
import { useOdontogramAutosave } from '../modules/odontogram/useOdontogramAutosave';
import type { OdontogramState } from '../modules/odontogram/types';
import { useSettings } from '../context/SettingsContext';

const LAB_PATIENT_ID = 'lab';

export function OdontogramLabPage() {
  const { t } = useSettings();
  const hostRef = useRef<OdontogramHostHandle | null>(null);
  const [initialState, setInitialState] = useState<OdontogramState | null>(null);
  const [odontogramState, setOdontogramState] = useState<OdontogramState | null>(null);
  const [importJson, setImportJson] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadCurrent(LAB_PATIENT_ID);
    setInitialState(stored?.state ?? null);
    setOdontogramState(stored?.state ?? null);
  }, []);

  useOdontogramAutosave({
    patientId: LAB_PATIENT_ID,
    state: odontogramState,
    enabled: true,
  });

  const handleExport = async () => {
    const latest = (await hostRef.current?.exportState()) ?? odontogramState;
    if (!latest) {
      setStatusMessage(t.lab.noExportableState);
      return;
    }
    const text = JSON.stringify(latest, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage(t.lab.exportCopied);
    } catch {
      setStatusMessage(t.lab.exportCopyFailed);
    }
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importJson) as OdontogramState;
      await hostRef.current?.importState(parsed);
      setOdontogramState(parsed);
      setStatusMessage(t.lab.importSuccess);
    } catch {
      setStatusMessage(t.lab.importInvalidJson);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.nav.lab}</h1>
        <p className="text-sm text-gray-500">{t.lab.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.lab.odontogramTitle}</h2>
            <span className="text-xs text-gray-500">{t.lab.defaultModeEdit}</span>
          </div>
        </CardHeader>
        <CardContent>
          <OdontogramHost
            ref={hostRef}
            patientId={LAB_PATIENT_ID}
            mode="edit"
            initialState={initialState}
            onChange={setOdontogramState}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold">{t.lab.debugPanelTitle}</h2>
            {statusMessage && <span className="text-sm text-gray-500">{statusMessage}</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleExport}>
              {t.lab.exportJson}
            </Button>
            <Button onClick={handleImport}>{t.lab.importJson}</Button>
          </div>
          <TextArea
            label={t.lab.importJson}
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
            rows={8}
            placeholder={t.lab.importPlaceholder}
          />
        </CardContent>
      </Card>
    </div>
  );
}

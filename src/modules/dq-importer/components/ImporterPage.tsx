import { useState, useEffect, useRef } from 'react';
import type { FetchedPatient } from '../lib/types';
import { fetchPatients, getMode, exportToJson, downloadJson } from '../lib/api';
import { PatientCard } from './PatientCard';

interface Props {
  /** Base URL for DentalQuoteCreator links (default: http://localhost:5173) */
  dentalBaseUrl?: string;
  /** Optional OdontogramHost wrapper from DentalQuoteCreator for visual odontogram display */
  OdontogramViewer?: React.ComponentType<{ initialState: unknown }>;
}

export function ImporterPage({ dentalBaseUrl = 'http://localhost:5173', OdontogramViewer }: Props) {
  const [patients, setPatients] = useState<FetchedPatient[]>([]);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [mode, setMode] = useState<string>('integrated');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMode().then((data) => setMode(data.mode)).catch(() => setMode('standalone'));
  }, []);

  const handleFetch = async () => {
    const raw = inputRef.current?.value.trim();
    if (!raw) return;
    const ids = raw.split(/[\s,;]+/).filter(Boolean);
    if (!ids.length) return;

    setStatus({ type: 'loading', message: 'Páciens adatok lekérése a Flexi-dent-ből... Ez néhány másodpercig tarthat.' });
    try {
      const data = await fetchPatients(ids);
      setPatients(data.patients);
      setStatus({ type: 'success', message: `${data.patients.length} páciens lekérdezve.` });
    } catch (err: unknown) {
      setStatus({ type: 'error', message: (err as Error).message });
    }
  };

  const handleExportAll = () => {
    const items = patients.filter((p) => p._status === 'ok').map((p) => {
      const { _rawFields, _status, _error, nonHealthyTeeth, odontogram, flexiId, ...patientData } = p;
      patientData.notes = `Importálva Flexi-dent-ből (ID: ${flexiId})`;
      return { patient: patientData, odontogram };
    });
    if (!items.length) return;
    const data = exportToJson(items);
    downloadJson(data, `flexi-export-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFetch();
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>Flexi-dent Páciens Import</h1>
      <p style={styles.subtitle}>
        Páciens adatok és odontogram áthozása a DentalQuoteCreator rendszerbe
        {mode === 'standalone' && <span style={{ color: '#e67e22' }}> (Standalone mód – csak JSON export)</span>}
      </p>

      <div style={styles.inputSection}>
        <label style={styles.label} htmlFor="flexi-ids">Flexi-dent páciens ID-k (szóközzel elválasztva)</label>
        <div style={styles.inputRow}>
          <input
            ref={inputRef}
            id="flexi-ids"
            style={styles.textInput}
            placeholder="pl. 21787252 18053294"
            autoComplete="off"
            onKeyDown={handleKeyDown}
          />
          <button style={styles.btnPrimary} onClick={handleFetch} disabled={status.type === 'loading'}>
            {status.type === 'loading' ? 'Lekérés...' : 'Lekérés'}
          </button>
        </div>
        <p style={styles.hint}>Több páciens esetén az ID-ket szóközzel vagy vesszővel válaszd el.</p>
      </div>

      {status.type !== 'idle' && (
        <div style={{ ...styles.statusBar, ...statusStyles[status.type] }}>
          {status.type === 'loading' && <span style={styles.spinner} />}
          {status.message}
        </div>
      )}

      {patients.length > 0 && mode === 'standalone' && (
        <div style={{ marginBottom: 16, textAlign: 'right' as const }}>
          <button style={styles.btnOutline} onClick={handleExportAll}>Összes exportálása JSON-ba</button>
        </div>
      )}

      <div style={styles.cards}>
        {patients.map((p, i) => (
          <PatientCard key={p.flexiId + '-' + i} patient={p} mode={mode} dentalBaseUrl={dentalBaseUrl} OdontogramViewer={OdontogramViewer} />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  h1: { fontSize: 24, marginBottom: 8, color: 'rgb(var(--color-text-primary))' },
  subtitle: { color: 'rgb(var(--color-text-secondary))', marginBottom: 24, fontSize: 14 },
  inputSection: { background: 'rgb(var(--color-bg-secondary))', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 },
  label: { display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14, color: 'rgb(var(--color-text-primary))' },
  inputRow: { display: 'flex', gap: 12 },
  textInput: { flex: 1, padding: '10px 14px', border: '1px solid rgb(var(--color-border-secondary))', borderRadius: 6, fontSize: 15, outline: 'none', background: 'rgb(var(--color-bg-input))', color: 'rgb(var(--color-text-primary))' },
  hint: { fontSize: 12, color: 'rgb(var(--color-text-muted))', marginTop: 8 },
  btnPrimary: { padding: '10px 24px', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer', background: '#4a90d9', color: '#fff' },
  btnOutline: { padding: '8px 16px', border: '1px solid rgb(var(--color-border-secondary))', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgb(var(--color-bg-secondary))', color: 'rgb(var(--color-text-primary))' },
  statusBar: { padding: '12px 16px', borderRadius: 6, marginBottom: 16, fontSize: 14 },
  spinner: { display: 'inline-block', width: 16, height: 16, border: '2px solid #c5ddf5', borderTopColor: '#2c5ea0', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle', marginRight: 8 },
  cards: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
};

const statusStyles: Record<string, React.CSSProperties> = {
  loading: { background: '#eef6ff', color: '#2c5ea0', border: '1px solid #c5ddf5' },
  error: { background: '#fdecea', color: '#a33', border: '1px solid #f5c6cb' },
  success: { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' },
};

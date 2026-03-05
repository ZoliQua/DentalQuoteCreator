import { useState, useRef } from 'react';
import type { FetchedPatient } from '../lib/types';
import { importPatient as apiImportPatient, exportToJson, downloadJson } from '../lib/api';
import { OdontogramSummary } from './OdontogramSummary';

const COUNTRY_NAMES: Record<string, string> = { '96': 'Magyarország' };
const PATIENT_TYPE_NAMES: Record<string, string> = { private: 'Magán', insurance: 'TB', company: 'Céges' };
const NEAK_DOC_NAMES: Record<number, string> = { 1: 'TAJ kártya', 2: 'Útlevél', 3: 'Személyi igazolvány' };

interface Props {
  patient: FetchedPatient;
  mode: string;
  dentalBaseUrl: string;
  OdontogramViewer?: React.ComponentType<{ initialState: unknown }>;
}

export function PatientCard({ patient, mode, dentalBaseUrl, OdontogramViewer }: Props) {
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string; patientId?: string }>({ type: 'idle', message: '' });
  const [showRaw, setShowRaw] = useState(false);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const birthDateRef = useRef<HTMLInputElement>(null);
  const sexRef = useRef<HTMLSelectElement>(null);

  if (patient._status === 'error') {
    return (
      <div style={styles.card}>
        <div style={styles.header}><h3>Flexi ID: {patient.flexiId}</h3></div>
        <div style={styles.error}>Hiba: {patient._error}</div>
      </div>
    );
  }

  const name = [patient.lastName, patient.firstName].filter(Boolean).join(' ') || '(Ismeretlen név)';

  const getEditedPatient = () => ({
    ...patient,
    lastName: lastNameRef.current?.value || patient.lastName,
    firstName: firstNameRef.current?.value || patient.firstName,
    birthDate: birthDateRef.current?.value || patient.birthDate,
    sex: (sexRef.current?.value as 'male' | 'female' | 'other') || patient.sex,
  });

  const handleImport = async () => {
    const edited = getEditedPatient();
    if (!edited.lastName || !edited.firstName || !edited.birthDate || !edited.sex) {
      setImportStatus({ type: 'error', message: 'Töltsd ki a kötelező mezőket!' });
      return;
    }
    setImportStatus({ type: 'loading', message: 'Importálás...' });
    try {
      const { _rawFields, _status, _error, nonHealthyTeeth, odontogram, flexiId, ...patientData } = edited;
      patientData.notes = `Importálva Flexi-dent-ből (ID: ${flexiId})`;
      const result = await apiImportPatient(patientData, odontogram);
      setImportStatus({ type: 'success', message: 'Sikeres import!', patientId: result.patientId });
    } catch (err: unknown) {
      setImportStatus({ type: 'error', message: (err as Error).message });
    }
  };

  const handleExportJson = () => {
    const edited = getEditedPatient();
    const { _rawFields, _status, _error, nonHealthyTeeth, odontogram, flexiId, ...patientData } = edited;
    patientData.notes = `Importálva Flexi-dent-ből (ID: ${flexiId})`;
    const data = exportToJson([{ patient: patientData, odontogram }]);
    downloadJson(data, `flexi-${flexiId}.json`);
  };

  const fieldOrEmpty = (val: string) => val || <span style={{ color: '#ccc', fontStyle: 'italic' }}>–</span>;

  const duplicates = patient._duplicates;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h3 style={{ fontSize: 16, color: 'rgb(var(--color-text-primary))' }}>
          {name} <span style={{ fontSize: 12, color: 'rgb(var(--color-text-muted))', fontWeight: 'normal' }}>Flexi ID: {patient.flexiId}</span>
        </h3>
        {duplicates && duplicates.length > 0 && (
          <div style={styles.duplicateWarning}>
            Már létező páciens az adatbázisban!
            {duplicates.map((d, i) => (
              <div key={i} style={{ marginTop: 4 }}>
                <a href={`${dentalBaseUrl}/patients/${d.patientId}`} target="_blank" rel="noreferrer" style={{ color: '#a33', fontWeight: 600 }}>
                  {d.patientId}
                </a>
                {' '}{d.name} — {d.reason === 'taj' ? 'egyező TAJ szám' : 'egyező név + születési dátum'}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={styles.body}>
        <table style={styles.table}>
          <tbody>
            <Row label="Titulus">{fieldOrEmpty(patient.title)}</Row>
            <Row label="Vezetéknév *"><input ref={lastNameRef} style={styles.input} defaultValue={patient.lastName} placeholder="Kötelező" /></Row>
            <Row label="Keresztnév *"><input ref={firstNameRef} style={styles.input} defaultValue={patient.firstName} placeholder="Kötelező" /></Row>
            <Row label="Születési dátum *"><input ref={birthDateRef} style={styles.input} type="date" defaultValue={patient.birthDate || ''} /></Row>
            <Row label="Nem *">
              <select ref={sexRef} style={styles.select} defaultValue={patient.sex}>
                <option value="male">Férfi</option>
                <option value="female">Nő</option>
                <option value="other">Egyéb</option>
              </select>
            </Row>
            <Row label="TAJ szám">{fieldOrEmpty(patient.insuranceNum)}</Row>
            <Row label="NEAK dok. típus">{NEAK_DOC_NAMES[patient.neakDocumentType] || String(patient.neakDocumentType)}</Row>
            <Row label="Telefon">{fieldOrEmpty(patient.phone)}</Row>
            <Row label="Email">{fieldOrEmpty(patient.email)}</Row>
            <Row label="Irányítószám">{fieldOrEmpty(patient.zipCode)}</Row>
            <Row label="Város">{fieldOrEmpty(patient.city)}</Row>
            <Row label="Utca, házszám">{fieldOrEmpty(patient.street)}</Row>
            <Row label="Ország">{COUNTRY_NAMES[patient.country] || patient.country}</Row>
            <Row label="Anyja neve">{fieldOrEmpty(patient.mothersName)}</Row>
            <Row label="Születési hely">{fieldOrEmpty(patient.birthPlace)}</Row>
            <Row label="Páciens típus">{PATIENT_TYPE_NAMES[patient.patientType] || patient.patientType}</Row>
          </tbody>
        </table>

        {OdontogramViewer ? (
          <div style={styles.odontogramContainer}>
            <h4 style={styles.odontogramTitle}>Odontogram</h4>
            <OdontogramViewer initialState={patient.odontogram} />
          </div>
        ) : (
          <OdontogramSummary odontogram={patient.odontogram} nonHealthyTeeth={patient.nonHealthyTeeth} />
        )}

        <span style={styles.rawToggle} onClick={() => setShowRaw(!showRaw)}>
          Nyers Flexi-dent mezők {showRaw ? 'elrejtése' : 'megtekintése'}
        </span>
        {showRaw && <pre style={styles.rawFields}>{JSON.stringify(patient._rawFields, null, 2)}</pre>}
      </div>
      <div style={styles.footer}>
        <div style={{ fontSize: 13 }}>
          {importStatus.type === 'loading' && <span>Importálás...</span>}
          {importStatus.type === 'error' && <span style={{ color: '#c0392b' }}>{importStatus.message}</span>}
          {importStatus.type === 'success' && (
            <span style={{ color: '#27ae60' }}>
              {importStatus.message} Páciens:{' '}
              <a href={`${dentalBaseUrl}/patients/${importStatus.patientId}`} target="_blank" rel="noreferrer" style={{ color: '#27ae60', fontWeight: 600 }}>
                {importStatus.patientId}
              </a>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.btnOutline} onClick={handleExportJson}>JSON export</button>
          {mode === 'integrated' && (
            <button
              style={styles.btnSuccess}
              onClick={handleImport}
              disabled={importStatus.type === 'loading' || importStatus.type === 'success'}
            >
              {importStatus.type === 'success' ? 'Importálva' : 'Importálás'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th style={styles.th}>{label}</th>
      <td style={styles.td}>{children}</td>
    </tr>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: 'rgb(var(--color-bg-secondary))', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' },
  header: { padding: '16px 20px', background: 'rgb(var(--color-bg-tertiary))', borderBottom: '1px solid rgb(var(--color-border-primary))' },
  duplicateWarning: { marginTop: 8, padding: '8px 12px', background: '#fdecea', border: '2px solid #e74c3c', borderRadius: 6, fontSize: 13, color: '#a33', fontWeight: 600 },
  body: { padding: '16px 20px' },
  error: { padding: '16px 20px', color: '#a33', background: '#fdecea' },
  footer: { padding: '12px 20px', borderTop: '1px solid rgb(var(--color-border-primary))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14, marginBottom: 12 },
  th: { textAlign: 'left' as const, padding: '6px 12px 6px 0', color: 'rgb(var(--color-text-tertiary))', fontWeight: 500, width: 160, verticalAlign: 'top' },
  td: { padding: '6px 0', color: 'rgb(var(--color-text-primary))' },
  input: { padding: '4px 8px', border: '1px solid rgb(var(--color-border-secondary))', borderRadius: 4, fontSize: 14, fontFamily: 'inherit', width: '100%', maxWidth: 300, background: 'rgb(var(--color-bg-input))', color: 'rgb(var(--color-text-primary))' },
  select: { padding: '4px 8px', border: '1px solid rgb(var(--color-border-secondary))', borderRadius: 4, fontSize: 14, fontFamily: 'inherit', background: 'rgb(var(--color-bg-input))', color: 'rgb(var(--color-text-primary))' },
  odontogramContainer: { marginTop: 12, padding: '12px 0', borderTop: '1px solid rgb(var(--color-border-primary))' },
  odontogramTitle: { fontSize: 14, marginBottom: 8, color: 'rgb(var(--color-text-tertiary))', fontWeight: 600 },
  rawToggle: { fontSize: 12, color: '#4a90d9', cursor: 'pointer', marginTop: 8, display: 'inline-block' },
  rawFields: { marginTop: 8, padding: 12, background: 'rgb(var(--color-bg-tertiary))', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', maxHeight: 300, overflowY: 'auto' as const, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const, color: 'rgb(var(--color-text-primary))' },
  btnSuccess: { padding: '6px 16px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#27ae60', color: '#fff' },
  btnOutline: { padding: '6px 16px', border: '1px solid rgb(var(--color-border-secondary))', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgb(var(--color-bg-secondary))', color: 'rgb(var(--color-text-primary))' },
};

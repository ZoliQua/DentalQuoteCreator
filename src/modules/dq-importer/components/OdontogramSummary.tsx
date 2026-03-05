import type { OdontogramState } from '../lib/types';

interface Props {
  odontogram: OdontogramState | null;
  nonHealthyTeeth: string[];
}

export function OdontogramSummary({ odontogram, nonHealthyTeeth }: Props) {
  if (!odontogram || nonHealthyTeeth.length === 0) {
    return (
      <div style={styles.container}>
        <h4 style={styles.title}>Odontogram</h4>
        <p>Minden fog egészséges, vagy nincs odontogram adat.</p>
      </div>
    );
  }

  const teeth = odontogram.teeth;

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>Odontogram – {nonHealthyTeeth.length} fog érintett</h4>
      <div style={styles.toothList}>
        {nonHealthyTeeth.map((id) => {
          const t = teeth[id];
          let cls: 'missing' | 'treated' | 'default' = 'default';
          const titleParts = [id];

          if (t.toothSelection === 'none') {
            cls = 'missing';
            titleParts.push('(hiányzik)');
          } else if (t.crownMaterial !== 'natural' || t.fillingSurfaces.length > 0 || t.endo !== 'none') {
            cls = 'treated';
            const parts: string[] = [];
            if (t.crownMaterial !== 'natural') parts.push('korona: ' + t.crownMaterial);
            if (t.fillingSurfaces.length > 0) parts.push('tömés: ' + t.fillingMaterial);
            if (t.endo !== 'none') parts.push('endo: ' + t.endo);
            if (t.caries.length > 0) parts.push('szuvasodás');
            titleParts.push('(' + parts.join(', ') + ')');
          }

          return (
            <span key={id} style={{ ...styles.badge, ...badgeStyles[cls] }} title={titleParts.join(' ')}>
              {id}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { marginTop: 12, padding: '12px 16px', background: '#f8f9fa', borderRadius: 6, fontSize: 13 },
  title: { fontSize: 14, marginBottom: 8, color: '#555', fontWeight: 600 },
  toothList: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  badge: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    fontSize: 12, fontWeight: 600, border: '1px solid #ffc107',
    background: '#fff3cd', color: '#856404',
  },
};

const badgeStyles: Record<string, React.CSSProperties> = {
  default: {},
  missing: { background: '#f8d7da', borderColor: '#f5c6cb', color: '#721c24' },
  treated: { background: '#d4edda', borderColor: '#c3e6cb', color: '#155724' },
};

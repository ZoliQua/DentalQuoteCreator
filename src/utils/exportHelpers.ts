import * as XLSX from 'xlsx';

export function downloadAsCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[], filename: string) {
  const escape = (val: unknown): string => {
    const s = val == null ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(','))
    .join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAsXlsx(rows: Record<string, unknown>[], columns: { key: string; label: string }[], filename: string) {
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((c) => {
      obj[c.label] = row[c.key] ?? '';
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

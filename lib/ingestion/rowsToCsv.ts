function escapeCell(value: string): string {
  const v = String(value ?? '');
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function rowsToCsv(headers: string[], rows: Record<string, string>[]): string {
  const headerLine = headers.map(escapeCell).join(',');
  const lines = rows.map((row) => headers.map((h) => escapeCell(row[h] ?? '')).join(','));
  return [headerLine, ...lines].join('\n');
}

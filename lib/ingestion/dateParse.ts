/** Parse common date strings into YYYY-MM-DD (ISO day). */
export function parseFlexibleDate(val: string): string | null {
  if (val == null || val === '') return null;
  const s = String(val).trim().split(/\s+/)[0] ?? '';

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function looksLikeDate(val: string): boolean {
  return parseFlexibleDate(val) !== null;
}

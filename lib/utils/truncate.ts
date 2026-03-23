/**
 * Truncate text with ellipsis. Use for long names in table cells and chart labels.
 * Full text should be shown in tooltip on hover.
 */
export function truncate(text: string, maxLength: number): string {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

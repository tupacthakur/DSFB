/**
 * Validate that content looks like CSV (comma or tab delimiters, at least one newline).
 * Use first 500 chars to avoid loading huge files.
 */
export function validateCsvContent(content: string): boolean {
  const sample = content.slice(0, 500);
  const hasDelimiter = /[,\t]/.test(sample);
  const hasNewline = /\n/.test(sample);
  return hasDelimiter && hasNewline;
}

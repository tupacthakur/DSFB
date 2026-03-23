/**
 * Decode file content: try UTF-8 first, fallback to windows-1252 if replacement chars appear.
 */
export type DecodeResult = { text: string; encoding: 'utf-8' | 'windows-1252' };

export function decodeWithFallback(buffer: ArrayBuffer): DecodeResult {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (!utf8.includes('\uFFFD')) return { text: utf8, encoding: 'utf-8' };
  try {
    const win = new TextDecoder('windows-1252').decode(buffer);
    return { text: win, encoding: 'windows-1252' };
  } catch {
    return { text: utf8, encoding: 'utf-8' };
  }
}

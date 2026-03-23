import { randomUUID } from 'crypto';

export function getRequestId(headers: Headers): string {
  const existing = headers.get('x-request-id')?.trim();
  if (existing) return existing;
  return randomUUID();
}

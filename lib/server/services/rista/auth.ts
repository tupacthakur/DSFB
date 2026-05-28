import { createHmac } from 'crypto';
import { ApiError } from '@/lib/server/api/errors';
import { getServerEnv } from '@/lib/server/config/env';

export interface RistaCredentials {
  apiKey: string;
  secretKey: string;
}

function base64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** HS256 JWT for Rista API (iss = API key, iat = epoch seconds). */
export function createRistaToken(apiKey: string, secretKey: string, jti?: string): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: Record<string, string | number> = {
    iss: apiKey,
    iat: Math.floor(Date.now() / 1000),
  };
  if (jti) payload.jti = jti;
  const body = base64Url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secretKey).update(data).digest();
  return `${data}.${base64Url(sig)}`;
}

export function resolveRistaCredentials(client?: {
  apiKey?: string;
  secretKey?: string;
}): RistaCredentials {
  const env = getServerEnv();
  const apiKey = env.ristaApiKey ?? client?.apiKey?.trim();
  const secretKey = env.ristaSecretKey ?? client?.secretKey?.trim();
  if (!apiKey || !secretKey) {
    throw new ApiError(
      503,
      'NO_RISTA_KEYS',
      'Rista API credentials are not configured. Set RISTA_API_KEY and RISTA_SECRET_KEY in environment or Settings.'
    );
  }
  return { apiKey, secretKey };
}

export function isRistaConfigured(): boolean {
  const env = getServerEnv();
  return !!(env.ristaApiKey && env.ristaSecretKey);
}

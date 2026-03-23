import { ApiError } from '@/lib/server/api/errors';
import { getServerEnv } from '@/lib/server/config/env';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function assertAllowedOrigin(origin: string | null): void {
  const { allowedOrigin, nodeEnv } = getServerEnv();
  if (!allowedOrigin || nodeEnv !== 'production') return;
  if (!origin || origin !== allowedOrigin) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed');
  }
}

export function assertRateLimit(clientId: string): void {
  const { apiRateLimitMax, apiRateLimitWindowMs } = getServerEnv();
  const now = Date.now();
  const current = buckets.get(clientId);
  if (!current || current.resetAt <= now) {
    buckets.set(clientId, { count: 1, resetAt: now + apiRateLimitWindowMs });
    return;
  }
  if (current.count >= apiRateLimitMax) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests', { retryAfter });
  }
  current.count += 1;
}

export function getClientIdentifier(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

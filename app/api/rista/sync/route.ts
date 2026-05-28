import { NextRequest } from 'next/server';
import { ApiError, toApiError } from '@/lib/server/api/errors';
import { fail, ok } from '@/lib/server/api/responses';
import {
  assertAllowedOrigin,
  assertRateLimit,
  getClientIdentifier,
} from '@/lib/server/security/request';
import { getRequestId } from '@/lib/server/http/requestContext';
import { resolveRistaCredentials } from '@/lib/server/services/rista/auth';
import { syncRistaSales } from '@/lib/server/services/rista/sync';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  try {
    assertAllowedOrigin(request.headers.get('origin'));
    assertRateLimit(getClientIdentifier(request.headers));
    const body = (await request.json().catch(() => ({}))) as {
      apiKey?: string;
      secretKey?: string;
      days?: number;
    };
    const creds = resolveRistaCredentials(body);
    const days = typeof body.days === 'number' && body.days > 0 && body.days <= 90 ? body.days : 30;
    const result = await syncRistaSales(creds, days);
    const response = ok(result);
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (err: unknown) {
    const apiErr = err instanceof ApiError ? err : toApiError(err);
    const response = fail(apiErr);
    response.headers.set('X-Request-Id', requestId);
    return response;
  }
}

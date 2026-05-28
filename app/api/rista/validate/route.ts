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
import { listRistaBranches } from '@/lib/server/services/rista/client';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  try {
    assertAllowedOrigin(request.headers.get('origin'));
    assertRateLimit(getClientIdentifier(request.headers));
    const body = (await request.json().catch(() => ({}))) as {
      apiKey?: string;
      secretKey?: string;
    };
    const creds = resolveRistaCredentials(body);
    const branches = await listRistaBranches(creds);
    const response = ok({
      valid: true,
      branchCount: branches.length,
      branches: branches.slice(0, 12).map((b) => ({
        branchCode: b.branchCode,
        branchName: b.branchName,
        status: b.status,
      })),
    });
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.code === 'NO_RISTA_KEYS') {
        const response = fail(
          new ApiError(503, 'NO_RISTA_KEYS', err.message, { valid: false, reason: 'NO_RISTA_KEYS' })
        );
        response.headers.set('X-Request-Id', requestId);
        return response;
      }
      const response = ok({ valid: false, reason: err.message });
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
    const response = fail(toApiError(err));
    response.headers.set('X-Request-Id', requestId);
    return response;
  }
}

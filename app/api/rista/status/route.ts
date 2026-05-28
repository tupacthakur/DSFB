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
import { getRistaLiveStatus } from '@/lib/server/services/rista/liveStatus';

async function handleStatus(
  request: NextRequest,
  credsBody?: { apiKey?: string; secretKey?: string }
) {
  const requestId = getRequestId(request.headers);
  try {
    assertAllowedOrigin(request.headers.get('origin'));
    assertRateLimit(getClientIdentifier(request.headers));
    const creds = resolveRistaCredentials(credsBody);
    const status = await getRistaLiveStatus(creds);
    const response = ok({
      ...status,
      branches: status.branches.map((b) => ({
        branchCode: b.branchCode,
        branchName: b.branchName,
        status: b.status,
        businessName: b.businessName,
      })),
    });
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (err: unknown) {
    const apiErr = err instanceof ApiError ? err : toApiError(err);
    const response = fail(apiErr);
    response.headers.set('X-Request-Id', requestId);
    return response;
  }
}

export async function GET(request: NextRequest) {
  return handleStatus(request);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: string;
    secretKey?: string;
  };
  return handleStatus(request, body);
}

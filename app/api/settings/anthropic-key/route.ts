import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/server/api/errors';
import { fail, ok } from '@/lib/server/api/responses';
import { logger } from '@/lib/server/observability/logger';
import { getRequestId } from '@/lib/server/http/requestContext';

/**
 * POST: Sync the API Key Vault value to the server (in-memory + .env.local).
 * Body: { key: string } — the Anthropic API key the user entered. Use ANTHROPIC_API_KEY=<key> in .env.local.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  let body: { key?: string } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    // no body
  }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key) {
    const response = fail(new ApiError(400, 'INVALID_KEY', 'Key must be a non-empty string'));
    response.headers.set('X-Request-Id', requestId);
    return response;
  }
  logger.info('Anthropic key sync endpoint called', {
    persisted: false,
    reason: 'serverless_stateless',
  });
  const response = ok({
    ok: true,
    persisted: false,
    message:
      'Server-side key persistence is disabled for serverless security. Configure ANTHROPIC_API_KEY in deployment environment variables.',
  });
  response.headers.set('X-Request-Id', requestId);
  return response;
}

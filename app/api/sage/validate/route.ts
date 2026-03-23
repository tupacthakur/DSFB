import { Anthropic } from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { SAGE_MODEL } from '@/lib/api/sage';
import { ApiError, toApiError } from '@/lib/server/api/errors';
import { fail, ok } from '@/lib/server/api/responses';
import {
  assertAllowedOrigin,
  assertRateLimit,
  getClientIdentifier,
} from '@/lib/server/security/request';
import { resolveAnthropicApiKey } from '@/lib/server/services/anthropic';
import { logger } from '@/lib/server/observability/logger';
import { getRequestId } from '@/lib/server/http/requestContext';

/**
 * Validates an API key by sending a minimal message. Used by Settings "Test Connection".
 * TIER 1: env. TIER 2: body.clientApiKey from Settings.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  try {
    assertAllowedOrigin(request.headers.get('origin'));
    assertRateLimit(getClientIdentifier(request.headers));
    const body = (await request.json().catch(() => ({}))) as { clientApiKey?: string };
    const key = resolveAnthropicApiKey(body.clientApiKey);
    const anthropic = new Anthropic({ apiKey: key });
    await anthropic.messages.create({
      model: SAGE_MODEL,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    const response = ok({ valid: true });
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.code === 'NO_API_KEY') {
        const response = fail(new ApiError(503, 'NO_API_KEY', 'No API key configured', { valid: false, reason: 'NO_API_KEY' }));
        response.headers.set('X-Request-Id', requestId);
        return response;
      }
      const response = fail(err);
      response.headers.set('X-Request-Id', requestId);
      return response;
    }

    const errObj = err as { status?: number; name?: string };
    // Only treat explicit auth failure as invalid key. Valid keys can still hit 429, 5xx, timeouts.
    if (errObj?.status === 401 || errObj?.name === 'AuthenticationError') {
      const response = ok({ valid: false, reason: 'Invalid key' });
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
    // Rate limit, server error, network: assume key is valid so we don't block the user.
    if (errObj?.status === 429) {
      const response = ok({ valid: true, reason: 'Rate limited; key accepted' });
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
    logger.warn('Validate key temporary error', {
      status: errObj?.status,
      name: errObj?.name,
    });
    const apiErr = toApiError(err);
    if (apiErr.status >= 500) {
      const response = ok({
        valid: true,
        reason: 'Key accepted; validation request had a temporary issue',
      });
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
    const response = fail(apiErr);
    response.headers.set('X-Request-Id', requestId);
    return response;
  }
}

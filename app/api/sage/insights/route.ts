import { NextRequest } from 'next/server';
import { SAGE_MODEL, type SageInsightItem } from '@/lib/api/sage';
import { evaluateRules, metricsVsBenchmarksTable } from '@/lib/symbolic/engine';
import { ApiError, toApiError } from '@/lib/server/api/errors';
import { fail, ok } from '@/lib/server/api/responses';
import { logger } from '@/lib/server/observability/logger';
import {
  assertAllowedOrigin,
  assertRateLimit,
  getClientIdentifier,
} from '@/lib/server/security/request';
import { createAnthropicClient } from '@/lib/server/services/anthropic';
import { getRequestId } from '@/lib/server/http/requestContext';

const DEFAULT_METRICS: Record<string, number> = {
  food_cost: 30, labor_cost: 30, bev_margin: 65, table_turns: 2.5, avg_check: 25,
  waste_pct: 5, prime_cost: 60, sat_score: 4.2, no_shows: 10, repeat_rate: 35,
};

/**
 * POST: Get context-aware insights from SAGE (metrics + data + chat summary).
 * Body: { dataContext?, ingestedSummary?, chatSummary?, metrics?, clientApiKey? }
 * Returns: { insights: InsightItem[] }
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request.headers);
  let body: {
    dataContext?: string;
    ingestedSummary?: string;
    chatSummary?: string;
    metrics?: Record<string, number>;
    clientApiKey?: string;
  } = {};
  try {
    assertAllowedOrigin(request.headers.get('origin'));
    assertRateLimit(getClientIdentifier(request.headers));
    body = await request.json().catch(() => ({}));
  } catch {
    return fail(new ApiError(400, 'INVALID_BODY', 'Invalid body'));
  }

  const metrics = body.metrics && typeof body.metrics === 'object' && Object.keys(body.metrics).length > 0
    ? { ...DEFAULT_METRICS, ...body.metrics }
    : DEFAULT_METRICS;

  const result = evaluateRules(metrics);
  const metricsTable = metricsVsBenchmarksTable(metrics);

  let contextBlock = `Symbolic layer (rules and benchmarks):\n${result.symCtx}\n\n${metricsTable}`;
  if (body.dataContext?.trim()) {
    contextBlock += `\n\nData context:\n${body.dataContext.slice(0, 1600)}`;
  }
  if (body.ingestedSummary?.trim()) {
    contextBlock += `\n\nIngested data summary:\n${body.ingestedSummary.slice(0, 900)}`;
  }
  if (body.chatSummary?.trim()) {
    contextBlock += `\n\nRecent chat summary:\n${body.chatSummary.slice(0, 700)}`;
  }

  const systemPrompt = `You are SAGE, an F&B intelligence assistant. Based ONLY on the context below, output a JSON array of 2 to 3 insights. Be fault-driven: focus on what is wrong, at risk, or underperforming — anomalies, missed benchmarks, and concrete fixes. Only mention positives when they directly contrast with a fault.

Context:
${contextBlock}

Output rules:
- Reply with ONLY a JSON array. No markdown, no code fence, no explanation.
- Each element must be an object with exactly: "title" (string), "summary" (string), "query" (string).
- title: short headline for the fault or risk (e.g. "Gross margin below benchmark").
- summary: a short paragraph (3 to 5 sentences) explaining the issue, why it matters, and what to do. Go deeper than one or two sentences.
- query: a short question the user could ask SAGE to go deeper (e.g. "How can I reduce food cost without hurting quality?").
- Keep insights grounded in the context above. Prefer fewer, longer, fault-focused insights over many short ones.`;

  const userMessage = `Output the JSON array of insights now.`;

  try {
    const anthropic = createAnthropicClient(body.clientApiKey);
    const anthropicResponse = await anthropic.messages.create({
      model: SAGE_MODEL,
      max_tokens: 1536,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = anthropicResponse.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim();

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned) as unknown;

    if (!Array.isArray(parsed)) {
      return ok({ insights: [] });
    }

    const insights: SageInsightItem[] = parsed
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
      .map((item) => ({
        title: typeof item.title === 'string' ? item.title : 'Insight',
        summary: typeof item.summary === 'string' ? item.summary : '',
        query: typeof item.query === 'string' ? item.query : '',
      }))
      .filter((i) => i.title && i.summary && i.query);

    const apiResponse = ok({ insights });
    apiResponse.headers.set('X-Request-Id', requestId);
    return apiResponse;
  } catch (err) {
    const errObj = err as { status?: number; message?: string };
    if (err instanceof ApiError) {
      const apiResponse = fail(err);
      apiResponse.headers.set('X-Request-Id', requestId);
      return apiResponse;
    }
    if (errObj?.status === 401) {
      const apiResponse = fail(new ApiError(401, 'INVALID_API_KEY', 'Invalid API key'));
      apiResponse.headers.set('X-Request-Id', requestId);
      return apiResponse;
    }
    logger.error('Sage insights failed', { status: errObj?.status, message: errObj?.message });
    const apiResponse = fail(
      toApiError(
        new ApiError(502, 'API_ERROR', errObj?.message ?? 'Failed to generate insights')
      )
    );
    apiResponse.headers.set('X-Request-Id', requestId);
    return apiResponse;
  }
}

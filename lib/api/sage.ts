/**
 * Client API wrapper for SAGE. This is the ONLY file that should call /api/sage.
 * No component should call /api/sage directly.
 */

import { useSettingsStore } from '@/lib/store/settingsStore';

/** Single source of truth for Anthropic model; update here when changing models. */
export const SAGE_MODEL = 'claude-sonnet-4-20250514' as const;

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface FiredRule {
  id: string;
  metric: string;
  op: '>' | '<';
  threshold: number;
  tag: string;
  confidence: number;
  actualValue: number;
}

export interface SAGEContext {
  /** Summary of ingested CSV/uploaded data for context-aware reasoning */
  ingestedSummary?: string;
  /** Current app data context (menu, KPIs, trends) for chat awareness */
  dataContext?: string;
}

/** One insight item returned by /api/sage/insights */
export interface SageInsightItem {
  title: string;
  summary: string;
  query: string;
}

export interface SAGERequest {
  messages: Message[];
  metrics: Record<string, number>;
  sessionId: string;
  context?: SAGEContext;
  /** Optional system prompt addition (e.g. executive briefing instruction). */
  systemAddition?: string;
}

export interface SAGEResponse {
  text: string;
  firedRules: FiredRule[];
  domains: string[];
  error?: string;
  errorCode?: string;
}

export interface SAGEStreamCallbacks {
  onToken: (token: string) => void;
  onDone: (result: { firedRules: FiredRule[]; domains: string[] }) => void;
  onError: (error: SAGEError) => void;
}

export class SAGEError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'SAGEError';
  }
}

export async function callSAGE(
  request: SAGERequest,
  callbacks: SAGEStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const { keySource, anthropicKey, restaurantProfile } = useSettingsStore.getState();
  const clientApiKey = keySource === 'settings' ? anthropicKey : undefined;

  const body = {
    messages: request.messages,
    metrics: request.metrics,
    sessionId: request.sessionId,
    stream: true,
    context: request.context ?? undefined,
    systemAddition: request.systemAddition ?? undefined,
    restaurantProfile: restaurantProfile ?? undefined,
    ...(clientApiKey?.trim() ? { clientApiKey: clientApiKey.trim() } : {}),
  };

  const res = await fetch('/api/sage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 400) {
      throw new SAGEError('VALIDATION_ERROR', data.detail ?? 'Validation failed', false);
    }
    if (res.status === 401) {
      throw new SAGEError('INVALID_API_KEY', 'Check your API key in Settings', false);
    }
    if (res.status === 429) {
      throw new SAGEError('RATE_LIMITED', 'Too many requests', true, data.retryAfter);
    }
    if (res.status === 503 && data.error === 'NO_API_KEY') {
      throw new SAGEError('NO_API_KEY', 'Add your Anthropic API key in Settings', false);
    }
    if (res.status === 503) {
      throw new SAGEError('NETWORK_ERROR', 'Connection failed. Check your internet.', true);
    }
    throw new SAGEError(data.error ?? 'UNKNOWN', data.message ?? 'Request failed', false);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError(new SAGEError('NETWORK_ERROR', 'No response body', true));
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as { type: string; text?: string; firedRules?: FiredRule[]; domains?: string[]; error?: string };
          if (chunk.type === 'delta' && chunk.text) {
            callbacks.onToken(chunk.text);
          } else if (chunk.type === 'done') {
            callbacks.onDone({
              firedRules: chunk.firedRules ?? [],
              domains: chunk.domains ?? [],
            });
          } else if (chunk.type === 'error') {
            callbacks.onError(new SAGEError('STREAM_ERROR', chunk.error ?? 'Stream error', false));
          }
        } catch {
          // skip malformed line
        }
      }
    }
  } catch (err) {
    if (err instanceof SAGEError) throw err;
    if ((err as Error)?.name === 'AbortError') return;
    callbacks.onError(new SAGEError('NETWORK_ERROR', 'Connection failed. Check your internet.', true));
  }
}

export async function validateAPIKey(): Promise<{
  valid: boolean;
  source: 'env' | 'settings' | 'none';
  reason?: string;
}> {
  const { keySource, anthropicKey } = useSettingsStore.getState();
  const clientApiKey = keySource === 'settings' ? anthropicKey : undefined;

  const res = await fetch('/api/sage/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientApiKey?.trim() ? { clientApiKey: clientApiKey.trim() } : {}),
  });

  const data = await res.json().catch(() => ({}));
  return {
    valid: data.valid === true,
    source: keySource,
    reason: data.reason,
  };
}

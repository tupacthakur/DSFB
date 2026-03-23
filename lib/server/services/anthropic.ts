import { Anthropic } from '@anthropic-ai/sdk';
import { ApiError } from '@/lib/server/api/errors';
import { getServerEnv } from '@/lib/server/config/env';

export function resolveAnthropicApiKey(clientApiKey?: string): string {
  const envKey = getServerEnv().anthropicApiKey;
  if (envKey && envKey.length > 10) return envKey;
  const clientKey = clientApiKey?.trim();
  if (clientKey && clientKey.length > 10) return clientKey;
  throw new ApiError(503, 'NO_API_KEY', 'No API key configured.');
}

export function createAnthropicClient(clientApiKey?: string): Anthropic {
  const apiKey = resolveAnthropicApiKey(clientApiKey);
  return new Anthropic({ apiKey });
}

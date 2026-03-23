import { ok } from '@/lib/server/api/responses';
import { getServerEnv } from '@/lib/server/config/env';

/**
 * Tells the client WHERE the key is coming from without ever exposing the key.
 * Called on app load to determine Settings UI state (locked vs editable).
 */
export async function GET() {
  const envKey = getServerEnv().anthropicApiKey;
  const hasEnvKey = !!envKey && envKey.trim().length > 10;

  return ok({
    source: hasEnvKey ? 'env' : 'none',
    configured: hasEnvKey,
  });
}

import { ApiError } from '@/lib/server/api/errors';
import { fail, ok } from '@/lib/server/api/responses';
import { getServerEnv } from '@/lib/server/config/env';
import { checkDatabaseReadiness } from '@/lib/server/services/analyticsService';

export async function GET() {
  const env = getServerEnv();
  const dbReady = await checkDatabaseReadiness();
  const ready = !!env.anthropicApiKey && dbReady;

  if (!ready) {
    return fail(
      new ApiError(503, 'NOT_READY', 'Service is not ready', {
        checks: {
          anthropicApiKey: !!env.anthropicApiKey,
          database: dbReady,
        },
      })
    );
  }

  return ok({
    status: 'ready',
    checks: {
      anthropicApiKey: true,
      database: true,
    },
  });
}

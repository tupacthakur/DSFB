import { ok } from '@/lib/server/api/responses';
import { getServerEnv } from '@/lib/server/config/env';

export async function GET() {
  const env = getServerEnv();
  return ok({
    status: 'ok',
    service: env.appName,
    timestamp: new Date().toISOString(),
  });
}

import { ok } from '@/lib/server/api/responses';
import { isRistaConfigured } from '@/lib/server/services/rista/auth';

export async function GET() {
  const configured = isRistaConfigured();
  return ok({
    source: configured ? 'env' : 'none',
    configured,
  });
}

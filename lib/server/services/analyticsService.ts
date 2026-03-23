import { getServerEnv } from '@/lib/server/config/env';
import {
  insertInteractionAudit,
  pingDatabase,
} from '@/lib/server/db/repositories/analyticsRepository';
import { logger } from '@/lib/server/observability/logger';

interface AuditEventInput {
  requestId: string;
  sessionId: string;
  route: string;
  model: string;
  promptChars: number;
  responseChars: number;
  status: 'ok' | 'error';
  errorCode?: string;
}

export async function recordInteractionAudit(input: AuditEventInput): Promise<void> {
  if (!getServerEnv().dbUrl) return;
  try {
    await insertInteractionAudit(input);
  } catch (error) {
    logger.warn('Failed to persist audit event', {
      requestId: input.requestId,
      route: input.route,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function checkDatabaseReadiness(): Promise<boolean> {
  if (!getServerEnv().dbUrl) return false;
  try {
    return await pingDatabase();
  } catch {
    return false;
  }
}

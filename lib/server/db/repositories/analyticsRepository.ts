import { query } from '@/lib/server/db/client';

interface InteractionAuditInput {
  requestId: string;
  sessionId: string;
  route: string;
  model: string;
  promptChars: number;
  responseChars: number;
  status: 'ok' | 'error';
  errorCode?: string;
}

export async function insertInteractionAudit(input: InteractionAuditInput): Promise<void> {
  await query(
    `
      insert into audit_events (
        request_id,
        session_id,
        route,
        model,
        prompt_chars,
        response_chars,
        status,
        error_code
      ) values ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      input.requestId,
      input.sessionId,
      input.route,
      input.model,
      input.promptChars,
      input.responseChars,
      input.status,
      input.errorCode ?? null,
    ]
  );
}

export async function pingDatabase(): Promise<boolean> {
  const result = await query<{ ok: number }>('select 1 as ok');
  return result.rows[0]?.ok === 1;
}

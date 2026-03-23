import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { getServerEnv } from '@/lib/server/config/env';

declare global {
  // eslint-disable-next-line no-var
  var __koravoPgPool: Pool | undefined;
}

function createPool(): Pool {
  const { dbUrl, nodeEnv } = getServerEnv();
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured');
  }
  return new Pool({
    connectionString: dbUrl,
    max: nodeEnv === 'production' ? 10 : 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
  });
}

export function getDbPool(): Pool {
  if (!global.__koravoPgPool) {
    global.__koravoPgPool = createPool();
  }
  return global.__koravoPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  return getDbPool().query<T>(text, values);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

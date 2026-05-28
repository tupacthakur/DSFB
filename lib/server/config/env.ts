type EnvMode = 'development' | 'test' | 'production';

function read(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface ServerEnv {
  nodeEnv: EnvMode;
  appName: string;
  anthropicApiKey?: string;
  ristaApiKey?: string;
  ristaSecretKey?: string;
  dbUrl?: string;
  apiRateLimitMax: number;
  apiRateLimitWindowMs: number;
  allowedOrigin?: string;
}

export function getServerEnv(): ServerEnv {
  const nodeEnv = (read('NODE_ENV') as EnvMode | undefined) ?? 'development';
  return {
    nodeEnv,
    appName: read('NEXT_PUBLIC_APP_NAME') ?? 'Koravo',
    anthropicApiKey: read('ANTHROPIC_API_KEY'),
    ristaApiKey: read('RISTA_API_KEY'),
    ristaSecretKey: read('RISTA_SECRET_KEY'),
    dbUrl: read('DATABASE_URL'),
    apiRateLimitMax: parseNumber(read('API_RATE_LIMIT_MAX'), 60),
    apiRateLimitWindowMs: parseNumber(read('API_RATE_LIMIT_WINDOW_MS'), 60_000),
    allowedOrigin: read('ALLOWED_ORIGIN'),
  };
}

export function assertRequiredEnv(keys: string[]): void {
  const missing = keys.filter((key) => !read(key));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

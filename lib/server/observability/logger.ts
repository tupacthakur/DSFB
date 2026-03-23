type LogMeta = Record<string, unknown>;

function sanitize(meta?: LogMeta): LogMeta | undefined {
  if (!meta) return undefined;
  const next: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/key|secret|token|password/i.test(key)) {
      next[key] = '[REDACTED]';
      continue;
    }
    next[key] = value;
  }
  return next;
}

function write(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: LogMeta): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: sanitize(meta) } : {}),
  };
  if (level === 'ERROR') {
    console.error(JSON.stringify(payload));
    return;
  }
  if (level === 'WARN') {
    console.warn(JSON.stringify(payload));
    return;
  }
  console.log(JSON.stringify(payload));
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    write('INFO', message, meta);
  },
  warn(message: string, meta?: LogMeta): void {
    write('WARN', message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    write('ERROR', message, meta);
  },
};

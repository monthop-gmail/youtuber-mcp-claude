export function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
}

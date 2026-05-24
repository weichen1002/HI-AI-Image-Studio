type LogLevel = 'INFO' | 'WARN' | 'ERROR';

type ErrorDetailOptions = {
  includeStack?: boolean;
};

type HttpRequestLog = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  ip?: string;
};

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
} as const;

const COLOR_ENABLED = Boolean(process.stdout?.isTTY);
const REDACTED = '[REDACTED]';

function isSensitiveKey(key: string) {
  return /password|secret|token|authorization|cookie|session|captcha|redeemcode|api[_-]?key|apikey|ciphertext/i.test(
    key,
  );
}

function colorize(text: string, color: string) {
  if (!COLOR_ENABLED) return text;
  return `${color}${text}${ANSI.reset}`;
}

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const millis = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis}`;
}

function levelColor(level: LogLevel) {
  if (level === 'INFO') return ANSI.green;
  if (level === 'WARN') return ANSI.yellow;
  return ANSI.red;
}

function statusColor(statusCode: number) {
  if (statusCode >= 500) return ANSI.red;
  if (statusCode >= 400) return ANSI.yellow;
  if (statusCode >= 300) return ANSI.cyan;
  return ANSI.green;
}

function durationColor(durationMs: number) {
  if (durationMs >= 3000) return ANSI.red;
  if (durationMs >= 1000) return ANSI.yellow;
  return ANSI.gray;
}

function normalizeValue(value: unknown, key = ''): unknown {
  if (key && isSensitiveKey(key)) {
    return REDACTED;
  }
  if (value instanceof Error) {
    return toErrorDetails(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, key));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([currentKey, current]) =>
        [currentKey, normalizeValue(current, currentKey)] as const,
    );
    return Object.fromEntries(entries);
  }
  if (typeof value === 'string' && value.length > 800) {
    return `${value.slice(0, 800)}...`;
  }
  return value;
}

export function sanitizeLogMeta(meta: unknown) {
  return normalizeValue(meta);
}

function formatMeta(meta?: unknown) {
  if (meta == null) return '';
  const normalized = sanitizeLogMeta(meta);
  const formatted = JSON.stringify(normalized, null, 2);
  if (!formatted) return '';
  return colorize(formatted, ANSI.gray);
}

function writeLog(level: LogLevel, context: string, message: string, meta?: unknown) {
  const timestamp = colorize(formatTimestamp(), ANSI.gray);
  const levelLabel = colorize(level.padEnd(5, ' '), levelColor(level));
  const contextLabel = colorize(context, ANSI.cyan);
  const output = [`[${timestamp}]`, levelLabel, contextLabel, message].join(' ');
  const extra = formatMeta(meta);
  const writer = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;

  if (extra) {
    writer(`${output}\n${extra}`);
    return;
  }
  writer(output);
}

export function toErrorDetails(error: unknown, options: ErrorDetailOptions = {}) {
  const includeStack = options.includeStack !== false;

  if (error instanceof Error) {
    const detail: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    const status =
      Number((error as any)?.getStatus?.()) ||
      Number((error as any)?.status) ||
      Number((error as any)?.statusCode);
    if (status) detail.status = status;
    if ((error as any)?.cause) {
      detail.cause = normalizeValue((error as any).cause);
    }
    if (includeStack && error.stack) {
      detail.stack = error.stack;
    }
    return detail;
  }

  return normalizeValue(error);
}

export function logInfo(context: string, message: string, meta?: unknown) {
  writeLog('INFO', context, message, meta);
}

export function logWarn(context: string, message: string, meta?: unknown) {
  writeLog('WARN', context, message, meta);
}

export function logError(context: string, message: string, meta?: unknown) {
  writeLog('ERROR', context, message, meta);
}

export function logHttpRequest({
  method,
  path,
  statusCode,
  durationMs,
  userId,
  ip,
}: HttpRequestLog) {
  const methodLabel = colorize(method.toUpperCase(), ANSI.cyan);
  const statusLabel = colorize(String(statusCode), statusColor(statusCode));
  const durationLabel = colorize(`${durationMs}ms`, durationColor(durationMs));
  const suffix = [
    userId ? `user=${userId}` : '',
    ip ? `ip=${ip}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  writeLog(
    statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO',
    'HTTP',
    `${methodLabel} ${path} ${statusLabel} ${durationLabel}${suffix ? ` ${suffix}` : ''}`,
  );
}

import type { NextRequest } from 'next/server';

export type OperationalEventLevel = 'info' | 'warn' | 'error';
export type OperationalEventStatus = 'success' | 'failure' | 'blocked' | 'warning';

export type OperationalEventName =
  | 'admin.login'
  | 'site.create'
  | 'site.update'
  | 'site.delete'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'project.publish'
  | 'r2.upload'
  | 'r2.delete'
  | 'd1.query_error'
  | 'monitor.synthetic_check'
  | 'monitor.alert';

type OperationalEventInput = {
  event: OperationalEventName;
  level?: OperationalEventLevel;
  status: OperationalEventStatus;
  request?: Request | NextRequest;
  siteId?: string | null;
  siteSlug?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
};

const MAX_STRING_LENGTH = 240;
const SENSITIVE_KEY_PATTERN = /password|token|secret|authorization|cookie|csrf|api[-_]?key/i;

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item));

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(item);
    }
    return output;
  }

  return String(value);
}

function getRequestPath(request: Request | NextRequest) {
  const nextUrl = (request as NextRequest).nextUrl;
  if (nextUrl?.pathname) return nextUrl.pathname;

  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url || 'unknown';
  }
}

function getRequestContext(request?: Request | NextRequest) {
  if (!request) return undefined;

  return {
    method: request.method,
    path: getRequestPath(request),
    cfRay: request.headers.get('cf-ray') || undefined,
    country: request.headers.get('cf-ipcountry') || undefined,
  };
}

export function logOperationalEvent(input: OperationalEventInput) {
  const level = input.level ?? (input.status === 'failure' ? 'error' : 'info');
  const payload = {
    type: 'portfolio_os_operational_event',
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    level,
    event: input.event,
    status: input.status,
    siteId: input.siteId || undefined,
    siteSlug: input.siteSlug || undefined,
    entityType: input.entityType || undefined,
    entityId: input.entityId || undefined,
    message: input.message,
    request: getRequestContext(input.request),
    metadata: input.metadata ? sanitizeValue(input.metadata) : undefined,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

export function summarizeSqlOperation(sql: string) {
  const compact = sql.replace(/\s+/g, ' ').trim();
  const operation = compact.split(' ')[0]?.toUpperCase() || 'UNKNOWN';
  const tableMatch =
    /\b(?:FROM|INTO|UPDATE|TABLE)\s+["`]?([a-zA-Z_][a-zA-Z0-9_]*)["`]?/i.exec(compact);

  return {
    operation,
    table: tableMatch?.[1],
  };
}

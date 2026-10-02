import fs from 'fs';
import path from 'path';
import { loadProductEnv } from './product-env';

export type D1Param = string | number | boolean | null;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRow = Record<string, JsonValue>;

type D1QueryResponse<T = Record<string, unknown>> = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    error?: string;
    results?: T[];
  }>;
};

export type D1BackupTable = {
  columns: string[];
  rows: JsonRow[];
};

export type D1BackupFile = {
  kind: 'portfolio-os-d1-backup';
  version: 1;
  generatedAt: string;
  manifest: {
    source: 'cloudflare-d1';
    tables: Array<{
      name: string;
      columns: string[];
      rowCount: number;
    }>;
    totalRows: number;
    schemaHash: string;
    notes: string[];
  };
  tables: Record<string, D1BackupTable>;
};

export const DEFAULT_D1_BACKUP_TABLES = [
  'sites',
  'client_access',
  'site_quota_overrides',
  'projects',
  'project_narratives',
  'media_assets',
  'submissions',
  'ai_generations',
  'audit_logs',
  'app_kv',
] as const;

export const RESTORE_TABLE_ORDER = [
  'sites',
  'client_access',
  'site_quota_overrides',
  'projects',
  'project_narratives',
  'media_assets',
  'submissions',
  'ai_generations',
  'audit_logs',
  'app_kv',
] as const;

export function loadBackupEnv() {
  return loadProductEnv();
}

export function readArgValue(args: string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index === -1) return undefined;

  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}

export function hasFlag(args: string[], name: string) {
  return args.includes(name);
}

export function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function resolveOutputDir(rawOut: string | undefined, fallbackSegments: string[]) {
  const outputDir = rawOut
    ? path.resolve(process.cwd(), rawOut)
    : path.resolve(process.cwd(), ...fallbackSegments);

  return outputDir;
}

export async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function writeJson(file: string, value: unknown) {
  await ensureDir(path.dirname(file));
  await fs.promises.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.promises.readFile(file, 'utf8')) as T;
}

export function quoteIdentifier(identifier: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

export function parseTableList(raw: string | undefined) {
  if (!raw) return [...DEFAULT_D1_BACKUP_TABLES];

  const tables = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (tables.length === 0) throw new Error('--tables requires at least one table');
  tables.forEach(quoteIdentifier);
  return tables;
}

function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export function getCurrentD1DatabaseId() {
  return readEnv('CLOUDFLARE_D1_DATABASE_ID');
}

export function getRestoreD1DatabaseId() {
  return readEnv('CLOUDFLARE_D1_RESTORE_DATABASE_ID');
}

export function getD1ApiConfig(databaseId?: string) {
  const accountId =
    readEnv('CLOUDFLARE_ACCOUNT_ID') ||
    readEnv('CLOUDFLARE_D1_ACCOUNT_ID') ||
    readEnv('CLOUDFLARE_R2_ACCOUNT_ID');
  const apiToken = readEnv('CLOUDFLARE_D1_API_TOKEN') || readEnv('CLOUDFLARE_API_TOKEN');
  const targetDatabaseId = databaseId || getCurrentD1DatabaseId();

  const missing: string[] = [];
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!targetDatabaseId) missing.push('CLOUDFLARE_D1_DATABASE_ID');
  if (!apiToken) missing.push('CLOUDFLARE_D1_API_TOKEN');

  if (missing.length > 0) {
    throw new Error(`Cloudflare D1 env is incomplete. Missing: ${missing.join(', ')}`);
  }

  return {
    accountId,
    databaseId: targetDatabaseId,
    apiToken,
  };
}

export async function queryD1ForDatabase<T = Record<string, unknown>>(
  databaseId: string,
  sql: string,
  params: D1Param[] = []
): Promise<T[]> {
  const config = getD1ApiConfig(databaseId);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const payload = (await response.json().catch(() => null)) as D1QueryResponse<T> | null;
  if (!response.ok || !payload?.success) {
    const detail = payload?.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join('; ');
    throw new Error(`Cloudflare D1 query failed: ${detail || response.statusText}`);
  }

  const firstResult = payload.result?.[0];
  if (firstResult && firstResult.success === false) {
    throw new Error(`Cloudflare D1 SQL failed: ${firstResult.error || sql}`);
  }

  return firstResult?.results ?? [];
}

export function extractR2KeyFromValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      if (publicBaseUrl && trimmed.startsWith(`${publicBaseUrl}/`)) {
        const parsed = new URL(trimmed);
        const base = new URL(publicBaseUrl);
        const basePath = decodeURIComponent(base.pathname).replace(/^\/+|\/+$/g, '');
        const pathName = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
        return basePath && pathName.startsWith(`${basePath}/`)
          ? pathName.slice(basePath.length + 1)
          : pathName;
      }

      const parsed = new URL(trimmed);
      const pathName = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
      return pathName.startsWith('r2/') ? pathName.slice('r2/'.length) : null;
    }

    const pathName = decodeURIComponent(trimmed).replace(/^\/+/, '');
    if (pathName.startsWith('r2/')) return pathName.slice('r2/'.length);
    if (
      pathName.startsWith('sites/') ||
      pathName.startsWith('assets/wallpapers/') ||
      pathName.startsWith('ffmpeg/')
    ) {
      return pathName;
    }

    return null;
  } catch {
    return null;
  }
}

export function expandKnownVideoSidecars(key: string) {
  const keys = [key];
  const videoMatch = key.match(/^(.*)\.(mp4|webm|mov)$/i);

  if (videoMatch && !key.match(/-preview\.(mp4|webm|mov)$/i)) {
    const base = videoMatch[1];
    keys.push(`${base}-preview.mp4`, `${base}.jpg`, `${base}.webp`);
  }

  return keys;
}

export function collectR2KeysFromJson(value: unknown, keys = new Set<string>()) {
  const direct = extractR2KeyFromValue(value);
  if (direct) keys.add(direct);

  if (Array.isArray(value)) {
    value.forEach((item) => collectR2KeysFromJson(item, keys));
  } else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectR2KeysFromJson(item, keys)
    );
  }

  return keys;
}

export function isR2NotFoundError(error: unknown) {
  const candidate = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return (
    candidate.name === 'NotFound' ||
    candidate.name === 'NoSuchKey' ||
    candidate.Code === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

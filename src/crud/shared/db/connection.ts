/**
 * Shared Core — D1 Connection
 * Low-level D1 REST API client for single-site deployment.
 *
 * @module
 */
import { SHARED_SCHEMA_QUERIES } from './schema';
import {
  getD1Binding,
  hasLiveCloudflareContext,
  type D1Binding,
} from '@/lib/cloudflareBinding';

type D1Param = string | number | boolean | null;

interface D1QueryResponse<T = Record<string, unknown>> {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    error?: string;
    results?: T[];
  }>;
}

interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

let schemaPromise: Promise<void> | null = null;

function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export function getMissingD1EnvKeys() {
  const missing: string[] = [];
  if (
    !readEnv('CLOUDFLARE_ACCOUNT_ID') &&
    !readEnv('CLOUDFLARE_D1_ACCOUNT_ID') &&
    !readEnv('CLOUDFLARE_R2_ACCOUNT_ID')
  ) {
    missing.push('CLOUDFLARE_ACCOUNT_ID');
  }
  if (!readEnv('CLOUDFLARE_D1_DATABASE_ID')) {
    missing.push('CLOUDFLARE_D1_DATABASE_ID');
  }
  if (!readEnv('CLOUDFLARE_D1_API_TOKEN') && !readEnv('CLOUDFLARE_API_TOKEN')) {
    missing.push('CLOUDFLARE_D1_API_TOKEN');
  }
  return missing;
}

export function isD1Configured() {
  if (getMissingD1EnvKeys().length === 0) return true;
  // Worker klien memakai binding `env.DB` (tanpa token di `vars`). Di
  // lingkungan itu tidak ada kredensial REST, tapi D1 tetap bisa dipakai.
  return process.env.NODE_ENV === 'production' && hasLiveCloudflareContext();
}

export function getD1Config(): D1Config {
  const accountId =
    readEnv('CLOUDFLARE_ACCOUNT_ID') ||
    readEnv('CLOUDFLARE_D1_ACCOUNT_ID') ||
    readEnv('CLOUDFLARE_R2_ACCOUNT_ID');
  const databaseId = readEnv('CLOUDFLARE_D1_DATABASE_ID');
  const apiToken = readEnv('CLOUDFLARE_D1_API_TOKEN') || readEnv('CLOUDFLARE_API_TOKEN');

  const missing = getMissingD1EnvKeys();
  if (missing.length > 0) {
    throw new Error(`Cloudflare D1 env is incomplete. Missing: ${missing.join(', ')}`);
  }

  return { accountId, databaseId, apiToken };
}

async function queryViaBinding<T>(
  binding: D1Binding,
  sql: string,
  params: D1Param[]
): Promise<T[]> {
  let payload: { results?: T[]; success?: boolean; error?: string };
  try {
    payload = await binding.prepare(sql).bind(...params).all<T>();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cloudflare D1 query failed: ${detail}`);
  }

  if (payload?.success === false) {
    throw new Error(`Cloudflare D1 SQL failed: ${payload.error || sql}`);
  }

  return payload?.results ?? [];
}

export async function queryD1<T = Record<string, unknown>>(
  sql: string,
  params: D1Param[] = []
): Promise<T[]> {
  // Worker klien: binding `env.DB` (tanpa token REST di `vars`).
  const binding = await getD1Binding();
  if (binding) return queryViaBinding<T>(binding, sql, params);

  const config = getD1Config();
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

export async function bootstrapD1Schema() {
  if (!isD1Configured()) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const sql of SHARED_SCHEMA_QUERIES) {
        try {
          await queryD1(sql);
        } catch (error) {
          // Best-effort: skema produksi sudah lengkap, jadi satu statement yang
          // gagal sesaat (mis. burst limit D1) tidak boleh menggagalkan request
          // apalagi mengunci isolate lewat promise yang selamanya rejected.
          // Kegagalan yang nyata tetap terlihat: query berikutnya melempar
          // error SQL "no such table" yang jelas.
          console.error(
            '[D1] bootstrapD1Schema: statement dilewati ->',
            error instanceof Error ? error.message : error
          );
        }
      }
    })();
  }
  return schemaPromise;
}

/**
 * Create a new site in D1.
 */
export async function createSite(data: {
  id: string;
  slug: string;
  name: string;
  templateKey?: string;
}): Promise<void> {
  await bootstrapD1Schema();
  const now = new Date().toISOString();
  await queryD1(
    `INSERT INTO sites (id, slug, name, active_template_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.id, data.slug, data.name, data.templateKey || 'os-desktop', now, now]
  );
}

/**
 * Get a site by ID.
 */
export async function getSiteById(siteId: string): Promise<{
  id: string;
  slug: string;
  name: string;
  status: string;
  active_template_key: string;
} | null> {
  await bootstrapD1Schema();
  const rows = await queryD1<{
    id: string;
    slug: string;
    name: string;
    status: string;
    active_template_key: string;
  }>(
    `SELECT id, slug, name, status, active_template_key FROM sites WHERE id = ? LIMIT 1`,
    [siteId]
  );
  return rows[0] || null;
}

/**
 * Cloudflare D1 — Low-level query helper untuk Cloudflare D1 REST API.
 *
 * Menyediakan `queryD1()`, `getD1Value()`, `setD1Value()`, dan `compareAndSetD1Value()`
 * sebagai utility mentah untuk operasi key-value di D1.
 *
 * Catatan: Untuk domain content, gunakan `ContentService` alih-alih fungsi ini
 * untuk menghindari inkonsistensi data (lihat AGENTS.md §5).
 *
 * @module cloudflareD1
 */
import { D1_SCHEMA_QUERIES } from './d1-schema';
import { getD1Binding, type D1Binding } from './cloudflareBinding';
import { logOperationalEvent, summarizeSqlOperation } from './observability/operationalLog';

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

const D1_TABLE_NAME = 'app_kv';
let schemaPromise: Promise<void> | null = null;

/**
 * Dua bentuk tabel `app_kv` hidup berdampingan di lapangan:
 *
 * 1. Bentuk lama/runtime (dibuat `bootstrapD1Schema` + `cf:bootstrap`):
 *    `key TEXT PRIMARY KEY`.
 * 2. Bentuk skema bersama (dibuat portal onboarding, `SHARED_SCHEMA_QUERIES`):
 *    `id TEXT PRIMARY KEY` + `key TEXT NOT NULL UNIQUE`.
 *
 * Penulis dulu hanya mengirim kolom `key`, sehingga setiap tulis ke database
 * klien hasil onboarding gagal `NOT NULL constraint failed: app_kv.id`
 * (audit 2026-10-24). Deteksi kolom di bawah membuat satu penulis melayani
 * kedua bentuk tanpa migrasi destruktif.
 */
let appKvColumnsPromise: Promise<string[]> | null = null;

function getAppKvColumns(): Promise<string[]> {
  if (!appKvColumnsPromise) {
    appKvColumnsPromise = queryD1<{ name: string }>(`PRAGMA table_info(${D1_TABLE_NAME})`)
      .then((rows) => rows.map((row) => row.name))
      .catch(() => {
        // Jangan memo hasil gagal: panggilan berikutnya harus bisa mencoba lagi.
        appKvColumnsPromise = null;
        return [] as string[];
      });
  }
  return appKvColumnsPromise;
}

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
  return getMissingD1EnvKeys().length === 0;
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

// Binding D1 (jalur utama) — REST tetap dipertahankan sebagai fallback.
// Implementasinya dipakai bersama `src/crud/shared/db/connection.ts`;
// lihat `src/lib/cloudflareBinding.ts`.

/**
 * Kirim pernyataan lewat binding D1.
 *
 * ⚠️ **Peringatan keselamatan data:** sekali pernyataan lepas ke binding,
 * kesalahan **apapun** wajib diteruskan ke pemanggil — tidak boleh jatuh kembali
 * ke REST. Pernyataan itu mungkin **sudah** dieksekusi, dan mengulanginya lewat
 * jalur lain berarti menulis dua kali (baris audit ganda, backup terduplikasi,
 * dsb.). Fallback hanya sah **sebelum** ada pernyataan yang dikirim, yaitu saat
 * binding tidak ditemukan sama sekali — lihat `getD1Binding()`.
 *
 * Pesan galat sengaja dibuat identik dengan jalur REST (`Cloudflare D1 query
 * failed:` / `Cloudflare D1 SQL failed:`) supaya pemanggil tidak bisa
 * membedakan jalur mana yang dipakai.
 */
async function queryViaD1Binding<T>(
  binding: D1Binding,
  sql: string,
  params: D1Param[]
): Promise<T[]> {
  let payload: { results?: T[]; success?: boolean; error?: string };
  try {
    payload = await binding.prepare(sql).bind(...params).all<T>();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logOperationalEvent({
      event: 'd1.query_error',
      level: 'error',
      status: 'failure',
      message: 'Cloudflare D1 binding query failed',
      metadata: { ...summarizeSqlOperation(sql), detail },
    });
    throw new Error(`Cloudflare D1 query failed: ${detail}`);
  }

  if (payload?.success === false) {
    const detail = payload.error || 'SQL failed';
    logOperationalEvent({
      event: 'd1.query_error',
      level: 'error',
      status: 'failure',
      message: 'Cloudflare D1 SQL failed',
      metadata: { ...summarizeSqlOperation(sql), detail },
    });
    throw new Error(`Cloudflare D1 SQL failed: ${detail}`);
  }

  return payload?.results ?? [];
}

/**
 * Kirim pernyataan SQL ke D1.
 *
 * Di runtime produksi pernyataan dikirim lewat **binding** `env.DB`
 * (subrequest internal, tanpa round-trip HTTP). Lewat fetch() ke
 * api.cloudflare.com pernyataan terhitung subrequest eksternal dengan batas 50
 * per invokasi pada paket Free — terbukti membuat cron harian gagal menyimpan
 * hasil probe dengan "Too many subrequests by single Worker invocation"
 * (2026-10-23). REST tetap dipakai sebagai fallback bila binding tidak ada.
 */
export async function queryD1<T = Record<string, unknown>>(
  sql: string,
  params: D1Param[] = []
): Promise<T[]> {
  const binding = await getD1Binding();
  if (binding) {
    return queryViaD1Binding<T>(binding, sql, params);
  }

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
    logOperationalEvent({
      event: 'd1.query_error',
      level: 'error',
      status: 'failure',
      message: 'Cloudflare D1 REST query failed',
      metadata: {
        ...summarizeSqlOperation(sql),
        responseStatus: response.status,
        detail: detail || response.statusText,
      },
    });
    throw new Error(`Cloudflare D1 query failed: ${detail || response.statusText}`);
  }

  const firstResult = payload.result?.[0];
  if (firstResult && firstResult.success === false) {
    logOperationalEvent({
      event: 'd1.query_error',
      level: 'error',
      status: 'failure',
      message: 'Cloudflare D1 SQL failed',
      metadata: {
        ...summarizeSqlOperation(sql),
        detail: firstResult.error || 'SQL failed',
      },
    });
    throw new Error(`Cloudflare D1 SQL failed: ${firstResult.error || sql}`);
  }

  return firstResult?.results ?? [];
}

/**
 * Tambahkan kolom projects/media_assets SEBELUM D1_SCHEMA_QUERIES dieksekusi.
 *
 * Audit 2026-10-08 (temuan #1, celah ketahuan saat verifikasi 2026-10-09):
 * `D1_SCHEMA_QUERIES` membuat `idx_projects_site_status_order(order_index)` dan
 * `idx_media_site_project_order(sort_order)`. Database hasil portal LAMA belum
 * punya kolom itu → pembuatan index MELEMPAR lebih dulu, sehingga blok self-heal
 * di bawah tidak pernah tercapai (bootstrap gagal = aplikasi mati total).
 * Karena itu kolom project/media ditambahkan di sini — aman dijalankan berulang
 * (PRAGMA cek dulu) dan ditoleransi bila tabelnya belum ada (database baru:
 * PRAGMA kosong → dilewati, tabelnya menyusul dibuat D1_SCHEMA_QUERIES).
 */
async function healProjectMediaColumns(): Promise<void> {
  const columns: Record<string, Array<[string, string]>> = {
    projects: [
      ['metadata_json', 'ALTER TABLE projects ADD COLUMN metadata_json TEXT'],
      ['order_index', 'ALTER TABLE projects ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0'],
      ['cover_media_id', 'ALTER TABLE projects ADD COLUMN cover_media_id TEXT'],
    ],
    media_assets: [
      ['sort_order', 'ALTER TABLE media_assets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0'],
      ['alt_text', 'ALTER TABLE media_assets ADD COLUMN alt_text TEXT'],
      ['updated_at', 'ALTER TABLE media_assets ADD COLUMN updated_at TEXT'],
    ],
  };

  for (const [table, defs] of Object.entries(columns)) {
    let info: Array<{ name: string }> = [];
    try {
      info = await queryD1<{ name: string }>(`PRAGMA table_info(${table})`);
    } catch {
      continue; // tabel belum ada — biarkan D1_SCHEMA_QUERIES yang membuatnya
    }
    const have = new Set(info.map((col) => col.name));
    for (const [name, alter] of defs) {
      if (!have.has(name)) await queryD1(alter);
    }
  }
}

export async function bootstrapD1Schema() {
  if (!isD1Configured()) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      // Legacy app_kv
      await queryD1(`
            CREATE TABLE IF NOT EXISTS ${D1_TABLE_NAME} (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            ) STRICT
        `);

      // Audit #1: kolom project/media dulu (lihat healProjectMediaColumns) —
      // kalau di belakang, index ber-order_index di bawah gagal pada DB lama.
      await healProjectMediaColumns();

      // New Relational Schema (Sprint B)
      for (const sql of D1_SCHEMA_QUERIES) {
        await queryD1(sql);
      }

      // Self-healing migration for existing projects, sites, and orders tables
      try {
        const info = await queryD1<{ name: string }>('PRAGMA table_info(projects)');
        const hasMetadata = info.some((col) => col.name === 'metadata_json');
        if (!hasMetadata) {
          await queryD1('ALTER TABLE projects ADD COLUMN metadata_json TEXT');
        }
        // Audit 2026-10-08 (temuan #1): database hasil onboarding portal lama
        // memakai skema tanpa kolom berikut, sementara projectSqlService
        // membacanya. Guard per kolom aman dijalankan berulang (PRAGMA cek dulu).
        const hasOrderIndex = info.some((col) => col.name === 'order_index');
        if (!hasOrderIndex) {
          await queryD1('ALTER TABLE projects ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0');
        }
        const hasCoverMediaId = info.some((col) => col.name === 'cover_media_id');
        if (!hasCoverMediaId) {
          await queryD1('ALTER TABLE projects ADD COLUMN cover_media_id TEXT');
        }

        const mediaInfo = await queryD1<{ name: string }>('PRAGMA table_info(media_assets)');
        const hasSortOrder = mediaInfo.some((col) => col.name === 'sort_order');
        if (!hasSortOrder) {
          await queryD1('ALTER TABLE media_assets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
        }
        const hasAltText = mediaInfo.some((col) => col.name === 'alt_text');
        if (!hasAltText) {
          await queryD1('ALTER TABLE media_assets ADD COLUMN alt_text TEXT');
        }
        const hasMediaUpdatedAt = mediaInfo.some((col) => col.name === 'updated_at');
        if (!hasMediaUpdatedAt) {
          await queryD1('ALTER TABLE media_assets ADD COLUMN updated_at TEXT');
        }

        const sitesInfo = await queryD1<{ name: string }>('PRAGMA table_info(sites)');
        const hasActiveTpl = sitesInfo.some((col) => col.name === 'active_template_key');
        if (!hasActiveTpl) {
          await queryD1('ALTER TABLE sites ADD COLUMN active_template_key TEXT DEFAULT "os-desktop"');
        }
        const hasSlugChangeCount = sitesInfo.some(
          (col) => col.name === 'client_slug_change_count'
        );
        if (!hasSlugChangeCount) {
          await queryD1(
            'ALTER TABLE sites ADD COLUMN client_slug_change_count INTEGER NOT NULL DEFAULT 0'
          );
        }
        const hasSlugChangedAt = sitesInfo.some((col) => col.name === 'client_slug_changed_at');
        if (!hasSlugChangedAt) {
          await queryD1('ALTER TABLE sites ADD COLUMN client_slug_changed_at TEXT');
        }

        const ordersInfo = await queryD1<{ name: string }>('PRAGMA table_info(orders)');
        const hasTplId = ordersInfo.some((col) => col.name === 'template_id');
        if (!hasTplId) {
          await queryD1('ALTER TABLE orders ADD COLUMN template_id TEXT');
        }
        const hasAccessTokenHash = ordersInfo.some((col) => col.name === 'access_token_hash');
        if (!hasAccessTokenHash) {
          await queryD1('ALTER TABLE orders ADD COLUMN access_token_hash TEXT');
        }
        const hasCancelReason = ordersInfo.some((col) => col.name === 'cancel_reason');
        if (!hasCancelReason) {
          await queryD1('ALTER TABLE orders ADD COLUMN cancel_reason TEXT');
        }
        const hasPaymentProofUrl = ordersInfo.some((col) => col.name === 'payment_proof_url');
        if (!hasPaymentProofUrl) {
          await queryD1('ALTER TABLE orders ADD COLUMN payment_proof_url TEXT');
        }

        // Migrate: replace plain desired_slug index with partial unique index
        // (without 'activated' — slug must be reusable after a site is created;
        // situs nyata sudah dijaga oleh index slug di tabel sites)
        try {
          await queryD1('DROP INDEX IF EXISTS idx_orders_desired_slug');
          await queryD1('DROP INDEX IF EXISTS idx_orders_desired_slug_active');
          await queryD1(
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_desired_slug_active ON orders(desired_slug) WHERE status IN ('pending_payment', 'waiting_verification', 'activating')`
          );
          await queryD1(
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_amount_active ON orders(amount) WHERE status IN ('pending_payment', 'waiting_verification', 'activating')`
          );
        } catch {
          // Index may already be migrated — safe to ignore
        }
      } catch (e) {
        console.warn('D1 schema self-healing migration skipped:', e);
      }
    })();
  }
  return schemaPromise;
}

/**
 * Read a single D1 row by its **literal key**.
 *
 * IMPORTANT: this does NOT follow nested paths. `db.ref('content/about')`
 * splits paths and writes to the parent key (`content`) with field
 * `about`. If you need that nested view, go through `db.ref(...)` or
 * the corresponding service (e.g. `aboutService.getAboutData()`),
 * never `getD1Value('content/about')` directly — those two read
 * different rows.
 *
 * Use this only for top-level domain keys that are written as full
 * strings (`projects`, `audit_logs`, `analytics`, etc.) or for
 * intentional inspection of the raw row.
 */
export async function getD1Value<T = unknown>(key: string): Promise<T | null> {
  const rows = await queryD1<{ value: string }>(
    `SELECT value FROM ${D1_TABLE_NAME} WHERE key = ? LIMIT 1`,
    [key]
  );
  if (!rows[0]) return null;
  return JSON.parse(rows[0].value) as T;
}

export async function getD1Values(keys: string[]): Promise<Record<string, unknown>> {
  if (keys.length === 0) return {};

  const placeholders = keys.map(() => '?').join(', ');
  const rows = await queryD1<{ key: string; value: string }>(
    `SELECT key, value FROM ${D1_TABLE_NAME} WHERE key IN (${placeholders})`,
    keys
  );

  return rows.reduce<Record<string, unknown>>((acc, row) => {
    acc[row.key] = JSON.parse(row.value);
    return acc;
  }, {});
}

export async function getAllD1Values(): Promise<Record<string, unknown>> {
  const rows = await queryD1<{ key: string; value: string }>(
    `SELECT key, value FROM ${D1_TABLE_NAME}`
  );

  return rows.reduce<Record<string, unknown>>((acc, row) => {
    acc[row.key] = JSON.parse(row.value);
    return acc;
  }, {});
}

/**
 * Write a single D1 row by its **literal key**.
 *
 * Same caveat as `getD1Value`: paths with `/` are NOT interpreted as
 * nested. Calling `setD1Value('content/about', x)` creates a separate
 * row from what `db.ref('content/about').set(x)` writes (the latter
 * stores nested under the `content` row).
 *
 * If you want the nested write that the admin UI and `/api/about`
 * expect, go through the corresponding service.
 */
export async function setD1Value(key: string, value: unknown) {
  await bootstrapD1Schema();
  const now = new Date().toISOString();
  const json = JSON.stringify(value);
  const hasIdColumn = (await getAppKvColumns()).includes('id');

  if (hasIdColumn) {
    await queryD1(
      `INSERT INTO ${D1_TABLE_NAME} (id, key, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, key, json, now]
    );
    return;
  }

  await queryD1(
    `INSERT INTO ${D1_TABLE_NAME} (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, json, now]
  );
}

export async function compareAndSetD1Value(
  key: string,
  expectedValue: unknown | null,
  nextValue: unknown
) {
  await bootstrapD1Schema();

  const now = new Date().toISOString();
  const nextJson = JSON.stringify(nextValue);
  const hasIdColumn = (await getAppKvColumns()).includes('id');

  if (expectedValue === null || expectedValue === undefined) {
    const rows = hasIdColumn
      ? await queryD1<{ key: string }>(
          `INSERT INTO ${D1_TABLE_NAME} (id, key, value, updated_at)
             SELECT ?, ?, ?, ?
             WHERE NOT EXISTS (SELECT 1 FROM ${D1_TABLE_NAME} WHERE key = ?)
             RETURNING key`,
          [key, key, nextJson, now, key]
        )
      : await queryD1<{ key: string }>(
          `INSERT INTO ${D1_TABLE_NAME} (key, value, updated_at)
             SELECT ?, ?, ?
             WHERE NOT EXISTS (SELECT 1 FROM ${D1_TABLE_NAME} WHERE key = ?)
             RETURNING key`,
          [key, nextJson, now, key]
        );
    return rows.length > 0;
  }

  const expectedJson = JSON.stringify(expectedValue);
  const rows = await queryD1<{ key: string }>(
    `UPDATE ${D1_TABLE_NAME}
       SET value = ?, updated_at = ?
       WHERE key = ? AND value = ?
       RETURNING key`,
    [nextJson, now, key, expectedJson]
  );

  return rows.length > 0;
}

export async function deleteD1Value(key: string) {
  await bootstrapD1Schema();
  await queryD1(`DELETE FROM ${D1_TABLE_NAME} WHERE key = ?`, [key]);
}

/**
 * Replace the entire app_kv table contents with `root`.
 *
 * SAFETY: Uses upsert-then-prune instead of DELETE-all then INSERT
 * to avoid catastrophic data loss if the process crashes between
 * the DELETE and the last INSERT. Any keys present in the current
 * table but absent from `root` are pruned after upserts succeed.
 */
export async function replaceAllD1Values(root: Record<string, unknown>) {
  await bootstrapD1Schema();

  const incomingKeys = new Set<string>();

  // Step 1: Upsert every key in root — no data is lost for existing rows.
  for (const [key, value] of Object.entries(root)) {
    if (value !== undefined && value !== null) {
      incomingKeys.add(key);
      await setD1Value(key, value);
    }
  }

  // Step 2: Prune keys that exist in D1 but are absent from root.
  const existingRows = await queryD1<{ key: string }>(`SELECT key FROM ${D1_TABLE_NAME}`);
  const orphans = existingRows.filter((row) => !incomingKeys.has(row.key));

  if (orphans.length > 0) {
    const placeholders = orphans.map(() => '?').join(', ');
    await queryD1(
      `DELETE FROM ${D1_TABLE_NAME} WHERE key IN (${placeholders})`,
      orphans.map((row) => row.key)
    );
  }
}

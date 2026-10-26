/**
 * D1 daily backup service.
 *
 * Menyalin isi seluruh tabel D1 (daftar tabel dibaca dari runtime, bukan
 * daftar statis) menjadi satu file JSON dan menyimpannya ke R2 di prefix
 * `sites/{siteId}/backups/d1/`. Dipakai oleh:
 *   - `POST /api/admin/backup` (tombol "Backup Sekarang" di panel admin)
 *   - `POST /api/cron/daily`   (backup harian 01:00 WIB, idempoten)
 *
 * Format file meniru format CLI `scripts/cloudflare/backup-common.ts`
 * (`D1BackupFile`) supaya hasil restore CLI tetap kompatibel. Helper kecil
 * (quote identifier, safe timestamp) disalin inline — modul `scripts/`
 * bukan bagian bundle Worker.
 */
import { SITE_ID } from '@/crud/shared/config';
import { isD1Configured, queryD1 } from '@/lib/cloudflareD1';
import { deleteFromR2, isR2StorageConfigured, listR2Objects, uploadToR2 } from '@/lib/r2Storage';

export const BACKUP_KEEP_COUNT = 7;
export const BACKUP_KEY_PREFIX = `sites/${SITE_ID}/backups/d1/`;

/** Guard idempoten cron: backup terbaru dianggap masih segar selama 20 jam. */
const RECENT_BACKUP_WINDOW_MS = 20 * 60 * 60 * 1000;

const TABLE_LIST_SQL =
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRow = Record<string, JsonValue>;

type D1BackupTable = {
  columns: string[];
  rows: JsonRow[];
};

export type D1BackupFile = {
  kind: 'portfolio-os-d1-backup';
  version: 1;
  generatedAt: string;
  manifest: {
    source: 'cloudflare-d1';
    tables: Array<{ name: string; columns: string[]; rowCount: number }>;
    totalRows: number;
    schemaHash: string;
    notes: string[];
  };
  tables: Record<string, D1BackupTable>;
};

/** Salinan `quoteIdentifier` dari `scripts/cloudflare/backup-common.ts`. */
function quoteIdentifier(identifier: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** sha256 dari gabungan nama tabel + kolomnya (WebCrypto, async). */
async function computeSchemaHash(
  tables: Array<{ name: string; columns: string[] }>
): Promise<string> {
  const material = tables.map((table) => `${table.name}:${table.columns.join(',')}`).join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return toHex(digest);
}

async function readTable(name: string): Promise<D1BackupTable> {
  const quoted = quoteIdentifier(name);
  const rows = await queryD1<JsonRow>(`SELECT * FROM ${quoted}`);

  let columns: string[] = [];
  try {
    const info = await queryD1<{ name: string }>(`PRAGMA table_info(${quoted})`);
    columns = info.map((column) => column.name).filter(Boolean);
  } catch {
    columns = [];
  }

  if (columns.length === 0) {
    columns = Object.keys(rows[0] ?? {});
  }

  return { columns, rows };
}

/**
 * Baca satu tabel dengan satu retry singkat. Kegagalan D1 sesaat (burst limit)
 * tidak boleh langsung membatalkan backup harian, tapi kegagalan yang menetap
 * HARUS membatalkan — tidak ada backup parsial (audit 2026-10-24).
 */
async function readTableWithRetry(name: string, attempts = 2): Promise<D1BackupTable> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await readTable(name);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
  throw lastError;
}

function sortKeysDesc(keys: string[]) {  return [...keys].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

/**
 * Murni: kembalikan key yang harus dihapus agar tersisa `keep` terbaru.
 * Input tidak dimutasi; key diurutkan menurun (terbaru dulu) lalu sisanya
 * (terlama) yang dikembalikan.
 */
export function pickBackupKeysToDelete(keys: string[], keep: number): string[] {
  return sortKeysDesc(keys).slice(Math.max(keep, 0));
}

async function enforceRetention() {
  try {
    const objects = await listR2Objects({ prefix: BACKUP_KEY_PREFIX });
    const stale = pickBackupKeysToDelete(
      objects.map((object) => object.key),
      BACKUP_KEEP_COUNT
    );

    for (const key of stale) {
      try {
        await deleteFromR2(key);
      } catch (error) {
        // Retensi gagal tidak boleh menggagalkan backup yang sudah terunggah.
        console.error('[d1Backup] Failed to delete stale backup:', key, errorMessage(error));
      }
    }
  } catch (error) {
    console.error('[d1Backup] Retention sweep skipped:', errorMessage(error));
  }
}

/**
 * Snapshot seluruh tabel D1 ke R2 + terapkan retensi 7 backup terbaru.
 */
export async function createD1Backup(): Promise<{
  key: string;
  size: number;
  totalRows: number;
  tableCount: number;
}> {
  const tableNames = await queryD1<{ name: string }>(TABLE_LIST_SQL);
  const notes: string[] = [];
  const manifestTables: Array<{ name: string; columns: string[]; rowCount: number }> = [];
  const tables: Record<string, D1BackupTable> = {};

  for (const row of tableNames) {
    try {
      const table = await readTableWithRetry(row.name);
      tables[row.name] = table;
      manifestTables.push({ name: row.name, columns: table.columns, rowCount: table.rows.length });
    } catch (error) {
      // Audit 2026-10-24: dulu tabel yang gagal hanya dicatat lalu backup
      // parsial tetap diunggah dan dilaporkan sukses. Backup yang diam-diam
      // kehilangan tabel lebih berbahaya daripada tidak ada backup sama sekali
      // (restore bisa menimpa data dengan snapshot tidak lengkap).
      throw new Error(
        `Backup D1 dibatalkan: tabel "${row.name}" gagal dibaca (${errorMessage(
          error
        )}). Tidak ada file backup parsial yang diunggah.`
      );
    }
  }

  const generatedAt = new Date().toISOString();
  const totalRows = manifestTables.reduce((sum, table) => sum + table.rowCount, 0);
  const backupFile: D1BackupFile = {
    kind: 'portfolio-os-d1-backup',
    version: 1,
    generatedAt,
    manifest: {
      source: 'cloudflare-d1',
      tables: manifestTables,
      totalRows,
      schemaHash: await computeSchemaHash(manifestTables),
      notes,
    },
    tables,
  };

  const body = JSON.stringify(backupFile);
  const stamp = generatedAt.replace(/[:.]/g, '-');
  const key = `${BACKUP_KEY_PREFIX}${stamp}.json`;

  await uploadToR2({ key, body, contentType: 'application/json', cacheControl: 'no-store' });
  await enforceRetention();

  return {
    key,
    size: new TextEncoder().encode(body).length,
    totalRows,
    tableCount: manifestTables.length,
  };
}

/** Daftar backup terbaru dulu (key berbasis ISO → urut leksografis = urut waktu). */
export async function listD1Backups(): Promise<
  Array<{ key: string; size: number; uploaded?: Date }>
> {
  const objects = await listR2Objects({ prefix: BACKUP_KEY_PREFIX });
  return [...objects].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

function parseBackupKeyTime(key: string): number | null {
  const base =
    key
      .split('/')
      .pop()
      ?.replace(/\.json$/, '') ?? '';
  // `2026-10-05T01-00-00-000Z` (hasil ISO dengan ':' dan '.' diganti '-')
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(base);
  if (!match) return null;

  const time = Date.parse(`${match[1]}:${match[2]}:${match[3]}.${match[4]}Z`);
  return Number.isNaN(time) ? null : time;
}

/**
 * Entry point cron: idempoten (lewati kalau env belum siap atau backup
 * terbaru masih < 20 jam).
 */
export async function runDailyBackup(): Promise<{
  ran: boolean;
  reason?: 'recent' | 'env';
  key?: string;
}> {
  if (!isD1Configured() || !isR2StorageConfigured()) {
    return { ran: false, reason: 'env' };
  }

  const [latest] = await listD1Backups();
  if (latest) {
    const time = parseBackupKeyTime(latest.key) ?? latest.uploaded?.getTime() ?? null;
    if (time !== null && Date.now() - time < RECENT_BACKUP_WINDOW_MS) {
      return { ran: false, reason: 'recent' };
    }
  }

  const result = await createD1Backup();
  return { ran: true, key: result.key };
}

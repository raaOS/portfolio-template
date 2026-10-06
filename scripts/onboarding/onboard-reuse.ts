/**
 * Penjagaan re-provision klien (audit business flow 2026-10-06, temuan MEDIUM M4).
 *
 * Dulu, menjalankan ulang onboarding untuk slug yang SUDAH pernah di-onboard:
 *   1. merotasi password admin secara DIAM-DIAM (upsert hash baru dari password
 *      random yang baru digenerate) → login klien lama tiba-tiba mati;
 *   2. membuat folder arsip BARU bernomor (01_slug, 02_slug, ...) → arsip ganda
 *      dengan config.env yang saling bertentangan (mana yang dipakai deploy?);
 *   3. mengganti JWT_SECRET/PASSWORD_SALT → sesi admin yang sedang login keluar.
 *
 * Modul ini menyediakan kebijakan bersama untuk `server.ts` (portal) dan
 * `cloud-manager.ts` (CLI) supaya perilaku keduanya identik:
 *   - cari arsip lama dulu; kalau ada, folder & secret lama DIPAKAI ULANG;
 *   - password admin hanya dirotasi kalau diminta secara eksplisit
 *     (flag `--password` / field password di portal);
 *   - kalau admin sudah ada tapi arsip tidak ada (password tak bisa dipulihkan),
 *     gagal dengan pesan jujur — bukan diam-diam menulis password baru.
 */
import fs from 'fs';
import path from 'path';

export interface ArchiveHit {
  folderName: string;
  dirPath: string;
  /** Isi config.env lama (key → value). Kosong bila file tidak bisa dibaca. */
  env: Record<string, string>;
}

/** Parser .env sederhana (baris `KEY="value"`, komentar `#` di-skip). */
export function parseEnvText(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Cari arsip config.env milik slug ini. Membaca setiap folder arsip dan
 * mencocokkan `CUSTOMER_SLUG` di dalamnya. Kalau ada duplikat (dari bug arsip
 * ganda lama), yang dipakai adalah yang PALING AKAN DITULIS ulang terakhir
 * (nomor folder terbesar) — biasanya yang paling terakhir dipakai deploy.
 */
export function findArchiveForSlug(archiveDir: string, clientSlug: string): ArchiveHit | null {
  if (!fs.existsSync(archiveDir)) return null;
  const folders = fs
    .readdirSync(archiveDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let latest: ArchiveHit | null = null;
  for (const folderName of folders) {
    const envPath = path.join(archiveDir, folderName, 'config.env');
    if (!fs.existsSync(envPath)) continue;
    let env: Record<string, string>;
    try {
      env = parseEnvText(fs.readFileSync(envPath, 'utf-8'));
    } catch {
      continue;
    }
    if (env.CUSTOMER_SLUG === clientSlug) {
      latest = { folderName, dirPath: path.join(archiveDir, folderName), env };
    }
  }
  return latest;
}

/**
 * Buat folder arsip BARU bernomor (`01_slug`, `02_slug`, ...).
 * HANYA dipanggil kalau `findArchiveForSlug` tidak menemukan arsip lama.
 */
export function createArchiveDir(
  archiveDir: string,
  clientSlug: string
): { dirPath: string; folderName: string } {
  const existing = fs
    .readdirSync(archiveDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let nextNum = 1;
  const numbers = existing
    .map((name) => parseInt(name.split('_')[0], 10))
    .filter((n) => !isNaN(n));
  if (numbers.length > 0) {
    nextNum = Math.max(...numbers) + 1;
  }

  const prefix = String(nextNum).padStart(2, '0');
  const safeSlug = clientSlug.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
  const folderName = `${prefix}_${safeSlug}`;
  const dirPath = path.join(archiveDir, folderName);
  fs.mkdirSync(dirPath, { recursive: true });
  return { dirPath, folderName };
}

/**
 * Ambil baris hasil query D1 dari envelope respons
 * `POST /d1/database/{id}/query` (shape: `result: [{ results: [...] }]`).
 */
export function pickD1Rows(envelope: unknown): Array<Record<string, unknown>> {
  const env = envelope as
    | { result?: Array<{ results?: Array<Record<string, unknown>> }> | null }
    | null
    | undefined;
  const first = Array.isArray(env?.result) ? env.result[0] : undefined;
  return Array.isArray(first?.results) ? first.results : [];
}

export interface AdminPasswordDecision {
  effectivePassword: string;
  /** `false` = admin sudah ada dan password LAMA dipertahankan → jangan seed ulang hash. */
  seedUser: boolean;
}

/**
 * Kebijakan password admin saat provisioning.
 *
 * - Password eksplisit diberikan → rotasi disengaja (`seedUser: true`).
 * - Admin belum ada → password baru di-generate (`seedUser: true`).
 * - Admin sudah ada & ada password di arsip lama → pakai ulang, TIDAK dirotasi
 *   (`seedUser: false`).
 * - Admin sudah ada & arsip hilang → LEMPAR ERROR: tidak ada sumber kebenaran
 *   untuk password lama, dan menulis password baru diam-diam adalah bug
 *   (audit MEDIUM M4).
 */
export function resolveProvisionedAdminPassword(input: {
  explicitPassword?: string;
  adminExists: boolean;
  archivePassword?: string;
  generateFallback: () => string;
}): AdminPasswordDecision {
  const explicit = (input.explicitPassword || '').trim();
  if (explicit) {
    return { effectivePassword: explicit, seedUser: true };
  }
  if (!input.adminExists) {
    return { effectivePassword: input.generateFallback(), seedUser: true };
  }
  const archived = (input.archivePassword || '').trim();
  if (archived) {
    return { effectivePassword: archived, seedUser: false };
  }
  throw new Error(
    'Onboarding ini sudah pernah dijalankan untuk slug tersebut (admin sudah ada) tetapi arsip ' +
      'config.env lamanya tidak ditemukan, sehingga password lama tidak bisa dipulihkan. ' +
      'Jalankan ulang dengan password BARU yang disengaja (flag --password / kolom password di ' +
      'portal) untuk merotasi, atau reset password lewat scripts/cloudflare/reset-customer-password.ts.'
  );
}

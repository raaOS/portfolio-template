/**
 * Build & deploy per-klien (Opsi B: Cloudflare Workers) untuk portal onboarding.
 *
 * Kenapa file ini ada (akar masalah yang diperbaiki):
 * 1. Deploy lama memakai `wrangler pages deploy .open-next`, padahal
 *    `@opennextjs/cloudflare` v1.20.1 tidak punya mode Pages — `deploy.js`
 *    selalu memanggil `wrangler deploy`. Mengunggah folder `.open-next` ke Pages
 *    hanya memuat aset statis + membocorkan bundle server (bukan Worker yang jalan).
 * 2. Bundle dibangun SEKALI dari `.env.local` milik owner, lalu `.open-next`
 *    dipakai untuk semua klien. `extractProjectEnvVars` (OpenNext) membakar isi
 *    file `.env*` ke `.open-next/cloudflare/next-env.mjs`, sehingga tiap klien
 *    berjalan memakai D1/R2 milik owner + rahasia owner (JWT_SECRET, ADMIN_PIN,
 *    TELEGRAM_*, AI_API_KEY, dst).
 *
 * Alur per klien di `deployClient()`:
 *   amankan rahasia klien -> bersihkan cache build -> build dengan env klien
 *   -> tulis ulang next-env.mjs (buang kunci owner) -> tulis wrangler config
 *   klien -> `wrangler deploy --config <config-klien>` -> verifikasi site hidup.
 *
 * Env klien ditekan di TIGA lapis:
 *   a. env proses anak `next build` (kunci `.env.local` TIDAK menimpa env yang
 *      sudah ada — lihat `populate()` di @next/env),
 *   b. `.open-next/cloudflare/next-env.mjs` ditulis ulang (runtime `vars`
 *      didahulukan, lalu file ini — lihat `populateProcessEnv()` OpenNext),
 *   c. `vars` di wrangler config klien.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type EnvMap = Record<string, string>;

export type RunCommand = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
  onLog: (line: string) => void
) => Promise<{ code: number }>;

/**
 * Kunci `.env.local` owner yang diwarisikan apa adanya ke klien karena nilainya
 * non-rahasia (identitas produk, gate fitur, URL aset build-time).
 * Sifatnya fail-closed: kunci `.env.local` owner yang tidak terdaftar di sini
 * maupun di `buildClientEnvPlan().overrides` akan direset jadi '' saat build
 * dan dibuang dari `next-env.mjs`; pembuangannya dicatat di log deploy.
 */
const INHERITED_OWNER_KEYS = new Set<string>([
  'NEXT_PUBLIC_PRODUCT_NAME',
  'NEXT_PUBLIC_DATA_BACKEND',
  'NEXT_PUBLIC_DEV_VITALS',
  'NEXT_PUBLIC_FFMPEG_BASE_URL',
  'DATA_BACKEND',
  'PRODUCT_CLOUDFLARE_ENV_CONFIRMED',
  'FEATURE_CUSTOM_DOMAIN',
  'FEATURE_ANALYTICS',
]);

/** Kunci yang tidak boleh pernah di-reset meski ada di `.env.local`. */
const NEVER_BLANK_KEYS = new Set<string>(['NODE_ENV', 'NEXT_TELEMETRY_DISABLED', 'CI']);

const REQUIRED_VALUE_KEYS = [
  'CUSTOMER_SLUG',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_D1_DATABASE_ID',
  'CLOUDFLARE_D1_API_TOKEN',
  'CLOUDFLARE_R2_BUCKET',
  'JWT_SECRET',
  'PASSWORD_SALT',
];

// ---------------------------------------------------------------------------
// config.env
// ---------------------------------------------------------------------------

/** Parse `KEY="value"` sederhana (komentar & baris kosong diabaikan). */
export function parseConfigEnv(content: string): EnvMap {
  const result: EnvMap = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** Tulis/replace kunci tertentu di config.env tanpa menyentuh baris lain. */
export function upsertConfigEnv(filePath: string, updates: EnvMap): void {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const pending = new Map(Object.entries(updates).map(([k, v]) => [k, v.replace(/"/g, '\\"')]));

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) continue;
    const key = match[1];
    if (!pending.has(key)) continue;
    lines[i] = `${key}="${pending.get(key)}"`;
    pending.delete(key);
  }

  for (const [key, value] of pending) {
    lines.push(`${key}="${value}"`);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

/**
 * URL publik klien dari config.env. `WORKERS_SUBDOMAIN` diisi saat onboarding /
 * deploy; kalau belum ada, dipakai host provisional yang nanti diperbaiki oleh
 * `deployClient()`.
 */
/**
 * URL workers.dev klien — alamat yang selalu ada selama Worker hidup, terlepas
 * dari custom domain. Dipakai sebagai cadangan health-check Status Board portal.
 */
export function workersDevUrl(config: EnvMap, fallbackSlug = ''): string {
  const slug = config.CUSTOMER_SLUG || fallbackSlug;
  if (!slug) return '';
  const host = config.WORKERS_SUBDOMAIN
    ? `${slug}.${config.WORKERS_SUBDOMAIN}.workers.dev`
    : `${slug}.workers.dev`;
  return `https://${host}`;
}

/**
 * Slug klien dipakai sebagai nama Worker sekaligus nama berkas
 * `wrangler.client.<slug>.jsonc`, jadi hanya huruf/angka/tanda hubung yang
 * diizinkan (R4 audit 2026-10-26: mencegah slug aneh menulis ke path lain).
 */
export function isSafeCustomerSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(slug);
}

export function clientUrls(
  config: EnvMap,
  fallbackSlug = ''
): { websiteUrl: string; adminUrl: string } {
  const devUrl = workersDevUrl(config, fallbackSlug);
  if (!devUrl) return { websiteUrl: '', adminUrl: '' };
  const websiteUrl = config.WEBSITE_URL || devUrl;
  return { websiteUrl, adminUrl: config.ADMIN_URL || `${websiteUrl}/admin` };
}

/**
 * Buat `JWT_SECRET` / `PASSWORD_SALT` / `CRON_SECRET` klien bila belum ada, lalu simpan balik ke
 * config.env supaya tidak berubah tiap deploy (rotasi = sesi & hash admin lama
 * tidak langsung tidak berlaku).
 *
 * Audit 2026-10-06 (MEDIUM): tanpa `CRON_SECRET` + `triggers.crons`, handler `scheduled`
 * di worker klien dilewati dan backup D1 harian klien TIDAK PERNAH jalan.
 */
export function ensureClientSecrets(config: EnvMap): string[] {
  const generated: string[] = [];
  if (!config.JWT_SECRET) {
    config.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    generated.push('JWT_SECRET');
  }
  if (!config.PASSWORD_SALT) {
    config.PASSWORD_SALT = crypto.randomBytes(16).toString('hex');
    generated.push('PASSWORD_SALT');
  }
  if (!config.CRON_SECRET) {
    config.CRON_SECRET = crypto.randomBytes(32).toString('hex');
    generated.push('CRON_SECRET');
  }
  return generated;
}

// ---------------------------------------------------------------------------
// env build klien
// ---------------------------------------------------------------------------

export interface ClientEnvPlan {
  /** Nilai runtime per klien: dipakai untuk `vars` wrangler + next-env.mjs. */
  overrides: EnvMap;
  /**
   * Nilai yang HANYA boleh ada selama proses build, tidak boleh masuk `vars`
   * Worker maupun `next-env.mjs` final.
   *
   * Kenapa perlu: `next build` melakukan prerender di luar Worker, sehingga
   * `getD1Binding()` mengembalikan null dan pembacaan D1 jatuh ke REST — yang
   * butuh token. Kalau token tidak ada saat build, prerender gagal
   * (`Cloudflare D1 env is incomplete`). Token ini dipakai build lalu dibuang
   * oleh `rewriteNextEnvFile()` dan tidak ditulis ke wrangler `vars`.
   */
  buildOnly: EnvMap;
  /** Kunci wajib yang nilainya masih kosong. */
  missing: string[];
}

/** Susun env klien dari config.env (secret klien sudah dibuat sebelumnya). */
export function buildClientEnvPlan(config: EnvMap): ClientEnvPlan {
  const slug = config.CUSTOMER_SLUG || '';

  const overrides: EnvMap = {
    CUSTOMER_SITE_ID: config.CUSTOMER_SITE_ID || slug,
    CLOUDFLARE_ACCOUNT_ID: config.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_D1_DATABASE_ID: config.CLOUDFLARE_D1_DATABASE_ID || '',
    // Token D1 TIDAK dimasukkan ke `overrides`: Worker klien memakai binding
    // `env.DB` (lihat writeWranglerClientConfig). Token tetap hidup di
    // config.env untuk pemeliharaan owner, bukan di runtime klien.
    CLOUDFLARE_R2_ACCOUNT_ID: config.CLOUDFLARE_R2_ACCOUNT_ID || config.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_R2_BUCKET:
      config.CLOUDFLARE_R2_BUCKET || config.CLOUDFLARE_R2_BUCKET_NAME || `media-${slug}`,
    // Proxy publik `/r2/[...key]` di aplikasi sendiri (allowlist key `sites/`,
    // `assets/`, `platform/`, dst) — bucket klien tidak perlu domain publik.
    CLOUDFLARE_R2_PUBLIC_BASE_URL: config.CLOUDFLARE_R2_PUBLIC_BASE_URL || '/r2',
    JWT_SECRET: config.JWT_SECRET || '',
    PASSWORD_SALT: config.PASSWORD_SALT || '',
    // Audit 2026-10-06 (MEDIUM): cron harian klien (backup D1 → R2 klien, 01:00 WIB).
    // Handler `scheduled` sudah di-inject ke worker oleh prepare-opennext-worker-output.js;
    // tanpa secret ini endpoint /api/cron/daily menjawab 500 dan run dilewati.
    CRON_SECRET: config.CRON_SECRET || '',
    // Provider milik owner tidak boleh dipakai klien.
    FEATURE_AI: 'false',
    FEATURE_NOTIFICATIONS: 'false',
    // Owner Mode (superadmin) — identitas deployment. Klien SELALU false:
    // app `ownerOnly` (Harga Jual, Order & Pembayaran) dan route API-nya
    // tidak boleh hidup di site klien (src/lib/ownerMode.ts). Dipaksa di
    // sini (bukan sekadar andalkan pembuangan) agar eksplisit dan aman
    // meski ada di config.env.
    OWNER_MODE: 'false',
    NEXT_PUBLIC_OWNER_MODE: 'false',
    NEXT_PUBLIC_APP_URL: config.WEBSITE_URL || '',
    NEXT_PUBLIC_SITE_URL: config.WEBSITE_URL || '',
  };

  const missing = REQUIRED_VALUE_KEYS.filter((key) => !overrides[key] && !config[key]);

  // Build-only: dipakai prerender REST, lalu dibuang dari artefak runtime.
  const buildOnly: EnvMap = {
    CLOUDFLARE_D1_API_TOKEN:
      config.CLOUDFLARE_D1_API_TOKEN || config.CLOUDFLARE_API_TOKEN || '',
  };

  return { overrides, buildOnly, missing };
}

/** Baca daftar KUNCI (bukan nilai) dari file `.env*` milik owner. */
export function readOwnerEnvKeys(rootDir: string): string[] {
  const keys = new Set<string>();
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const filePath = path.join(rootDir, name);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (match) keys.add(match[1]);
    }
  }
  return [...keys];
}

/** Kunci `.env.local` owner yang harus di-reset saat build klien. */
export function collectOwnerBlankKeys(rootDir: string, overrides: EnvMap): string[] {
  return readOwnerEnvKeys(rootDir).filter(
    (key) => !(key in overrides) && !INHERITED_OWNER_KEYS.has(key) && !NEVER_BLANK_KEYS.has(key)
  );
}

// ---------------------------------------------------------------------------
// next-env.mjs
// ---------------------------------------------------------------------------

export interface NextEnvRewriteResult {
  written: boolean;
  modes: string[];
  dropped: string[];
  kept: string[];
}

function parseJsonStringLiteral(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

/**
 * Tulis ulang `.open-next/cloudflare/next-env.mjs`:
 * kunci milik klien -> nilai klien; kunci yang diwarisi -> nilai owner;
 * sisanya (rahasia owner) Dibuang dari file sehingga tidak ikut runtime.
 */
export function rewriteNextEnvFile(openNextDir: string, overrides: EnvMap): NextEnvRewriteResult {
  const filePath = path.join(openNextDir, 'cloudflare', 'next-env.mjs');
  if (!fs.existsSync(filePath)) {
    return { written: false, modes: [], dropped: [], kept: [] };
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const modes: string[] = [];
  const dropped = new Set<string>();
  const kept = new Set<string>();

  const rewritten = original.replace(
    // Tiap ekspor ditulis `JSON.stringify()` oleh OpenNext, jadi selalu satu baris.
    /^export const (\w+) = (\{.*\});$/gm,
    (_match, mode: string, body: string) => {
      modes.push(mode);
      const entries: Array<[string, string]> = [];
      const pairRe = /"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
      let pair: RegExpExecArray | null;
      while ((pair = pairRe.exec(body)) !== null) {
        entries.push([parseJsonStringLiteral(pair[1]), parseJsonStringLiteral(pair[2])]);
      }

      const next: EnvMap = {};
      for (const [key, value] of entries) {
        if (key in overrides) {
          if (overrides[key]) next[key] = overrides[key];
          else dropped.add(key);
          continue;
        }
        if (INHERITED_OWNER_KEYS.has(key)) {
          next[key] = value;
          kept.add(key);
          continue;
        }
        dropped.add(key);
      }
      for (const [key, value] of Object.entries(overrides)) {
        if (value && !(key in next)) next[key] = value;
      }

      return `export const ${mode} = ${JSON.stringify(next)};\n`;
    }
  );

  if (rewritten === original) {
    return { written: false, modes, dropped: [...dropped], kept: [...kept] };
  }

  fs.writeFileSync(filePath, rewritten, 'utf8');
  return { written: true, modes, dropped: [...dropped], kept: [...kept] };
}

// ---------------------------------------------------------------------------
// wrangler config per klien
// ---------------------------------------------------------------------------

export interface WranglerClientInput {
  rootDir: string;
  slug: string;
  overrides: EnvMap;
  kvIncId?: string;
  kvTagId?: string;
  /** Nama database D1 klien (informasional di wrangler; `database_id` yang mengikat). */
  d1DatabaseName?: string;
}

function readRootCompatFlags(rootDir: string): { date: string; flags: string[] } {
  const fallback = { date: '2026-06-28', flags: ['nodejs_compat'] };
  const configPath = path.join(rootDir, 'wrangler.jsonc');
  if (!fs.existsSync(configPath)) return fallback;
  const raw = fs.readFileSync(configPath, 'utf8');
  const date = raw.match(/"compatibility_date"\s*:\s*"([^"]+)"/)?.[1];
  const flagsBlock = raw.match(/"compatibility_flags"\s*:\s*\[([^\]]*)\]/)?.[1] || '';
  const flags = [...flagsBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return {
    date: date || fallback.date,
    flags: flags.length ? flags : fallback.flags,
  };
}

/**
 * Buat wrangler config untuk 1 klien. Disimpan di `.open-next/` (folder kerja
 * OpenNext yang memang dibuat ulang tiap build) supaya path relatif `main` dan
 * `assets.directory` menunjuk ke `worker.js` + `assets` hasil build.
 */
export function writeWranglerClientConfig(input: WranglerClientInput): string {
  const { rootDir, slug, overrides, kvIncId, kvTagId, d1DatabaseName } = input;
  const compat = readRootCompatFlags(rootDir);

  const databaseId = overrides.CLOUDFLARE_D1_DATABASE_ID || '';
  if (!databaseId) {
    // Fail-closed: Worker klien tanpa binding D1 akan jatuh ke REST tanpa token
    // (token sengaja tidak lagi ditanam di `vars`) → login & simpan konten mati.
    throw new Error(
      'CLOUDFLARE_D1_DATABASE_ID kosong — binding D1 klien tidak bisa ditulis. Periksa arsip-klien/<slug>/config.env.'
    );
  }

  const vars: EnvMap = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value) vars[key] = value;
  }

  const clientConfig: Record<string, unknown> = {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: slug,
    main: 'worker.js',
    compatibility_date: compat.date,
    compatibility_flags: compat.flags,
    minify: true,
    assets: {
      directory: 'assets',
      binding: 'ASSETS',
    },
    r2_buckets: [
      {
        binding: 'MEDIA_BUCKET',
        bucket_name: overrides.CLOUDFLARE_R2_BUCKET || `media-${slug}`,
      },
    ],
    // Binding D1 = jalur utama runtime klien. Token REST sengaja TIDAK lagi
    // ditanam di `vars` (audit 2026-10-24); `queryD1` memakai `env.DB` dan hanya
    // jatuh ke REST dengan kredensial eksplisit bila binding tidak ada.
    d1_databases: [
      {
        binding: 'DB',
        database_name: d1DatabaseName || slug,
        database_id: databaseId,
      },
    ],
    services: [
      {
        // Memory queue (open-next.config.ts) memicu ISR revalidation lewat
        // binding in-Workers. Nama service = nama Worker klien itu sendiri.
        binding: 'WORKER_SELF_REFERENCE',
        service: slug,
      },
    ],
    observability: {
      enabled: true,
    },
    // Audit 2026-10-06 (MEDIUM): tanpa trigger ini, worker klien tidak pernah menjalankan
    // `scheduled` → backup D1 harian klien mati. Jadwal sama dengan owner (01:00 WIB /
    // 18:00 UTC). Handler `scheduled` sendiri sudah ada di worker.js hasil build.
    triggers: {
      crons: ['0 18 * * *'],
    },
    vars,
  };

  if (kvIncId && kvTagId) {
    clientConfig.kv_namespaces = [
      { binding: 'NEXT_INC_CACHE_KV', id: kvIncId },
      { binding: 'NEXT_TAG_CACHE_KV', id: kvTagId },
    ];
  }

  const openNextDir = path.join(rootDir, '.open-next');
  fs.mkdirSync(openNextDir, { recursive: true });
  const configPath = path.join(openNextDir, `wrangler.client.${slug}.jsonc`);
  fs.writeFileSync(configPath, `${JSON.stringify(clientConfig, null, 2)}\n`, 'utf8');
  return configPath;
}

// ---------------------------------------------------------------------------
// Cloudflare API (best effort, hanya dipanggil saat deploy sungguhan)
// ---------------------------------------------------------------------------

/** Amplop respons API Cloudflare v4 — hanya bagian yang dipakai skrip ini. */
interface CfEnvelope {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: unknown;
}

async function cfFetch(
  accountId: string,
  apiToken: string,
  pathname: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; json: CfEnvelope | null }> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}${pathname}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      }
    );
    const json = (await res.json().catch(() => null)) as CfEnvelope | null;
    return { ok: res.ok && json?.success !== false, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

/** Ambil subdomain workers.dev akun klien (untuk menyusun URL publik). */
export async function resolveWorkersSubdomain(
  accountId: string,
  apiToken: string
): Promise<string | null> {
  const res = await cfFetch(accountId, apiToken, '/workers/subdomain');
  const result = res.json?.result as { subdomain?: unknown } | undefined;
  const subdomain = result?.subdomain;
  return res.ok && typeof subdomain === 'string' && subdomain ? subdomain : null;
}

/**
 * Pastikan KV namespace ISR klien ada (idempoten). Tanpa KV, override cache
 * OpenNext melempar `IgnorableError` -> tiap pengunjung me-render ulang (TTFB
 * tinggi), jadi namespace dibuat saat deploy pertama.
 */
export async function ensureClientKvNamespaces(
  accountId: string,
  apiToken: string,
  slug: string
): Promise<{ incId?: string; tagId?: string; notes: string[] }> {
  const notes: string[] = [];

  const findIdByTitle = async (title: string): Promise<string | null> => {
    const list = await cfFetch(accountId, apiToken, '/storage/kv/namespaces?per_page=100');
    const namespaces = Array.isArray(list.json?.result) ? list.json.result : [];
    const found = namespaces.find((ns: { title?: string; id?: string }) => ns.title === title);
    return found?.id || null;
  };

  const ensureOne = async (title: string): Promise<string | null> => {
    const created = await cfFetch(accountId, apiToken, '/storage/kv/namespaces', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    const createdId = (created.json?.result as { id?: unknown } | undefined)?.id;
    if (created.ok && typeof createdId === 'string' && createdId) {
      notes.push(`KV namespace dibuat: ${title}`);
      return createdId;
    }
    const existing = await findIdByTitle(title);
    if (existing) {
      notes.push(`KV namespace dipakai ulang: ${title}`);
      return existing;
    }
    const detail = created.json?.errors?.[0]?.message || `HTTP ${created.status || 'tanpa-respon'}`;
    notes.push(`KV namespace ${title} tidak tersedia (${detail}) — deploy lanjut tanpa KV.`);
    return null;
  };

  const incId = await ensureOne(`kv-inc-${slug}`);
  const tagId = await ensureOne(`kv-tag-${slug}`);
  return { incId: incId || undefined, tagId: tagId || undefined, notes };
}

export interface R2BucketCheck {
  ok: boolean;
  detail: string;
}

/**
 * Pastikan bucket R2 klien benar-benar ada (audit 2026-10-24, temuan K8).
 *
 * Latar belakang: portal dulu hanya `console.warn` saat pembuatan bucket gagal.
 * Akibatnya provisioning tetap mengklaim "Infrastruktur Siap", build berjalan
 * 5–10 menit, lalu `wrangler deploy` gagal karena binding R2 menunjuk bucket
 * yang tidak ada. Sekarang kegagalan R2 menghentikan proses lebih awal dengan
 * pesan yang bisa ditindaklanjuti (aktifkan R2 / buat bucket).
 *
 * `create: true` dipakai saat provisioning; `create: false` (default) hanya
 * memverifikasi, dipakai sebelum build/deploy.
 */
export async function ensureR2Bucket(
  accountId: string,
  apiToken: string,
  bucketName: string,
  options: { create?: boolean } = {}
): Promise<R2BucketCheck> {
  const bucketPath = `/r2/buckets/${encodeURIComponent(bucketName)}`;

  if (options.create) {
    const created = await cfFetch(accountId, apiToken, bucketPath, { method: 'PUT' });
    if (created.ok) return { ok: true, detail: `Bucket R2 "${bucketName}" dibuat.` };
    // Sudah ada / balapan dengan proses lain: verifikasi lewat GET di bawah.
  }

  const res = await cfFetch(accountId, apiToken, bucketPath);
  if (res.ok) {
    return {
      ok: true,
      detail: options.create
        ? `Bucket R2 "${bucketName}" sudah tersedia.`
        : `Bucket R2 "${bucketName}" ada.`,
    };
  }

  const firstError = res.json?.errors?.[0];
  const detail = firstError?.message || `HTTP ${res.status || 'tanpa respons'}`;

  if (firstError?.code === 10042) {
    return {
      ok: false,
      detail:
        `R2 belum diaktifkan di akun Cloudflare ini. Buka dashboard Cloudflare → R2 → ` +
        `Enable R2 (butuh kartu/PayPal; kuota gratis tetap $0), lalu ulangi. ` +
        `Bucket yang dibutuhkan: "${bucketName}".`,
    };
  }
  if (res.status === 404) {
    return {
      ok: false,
      detail:
        `Bucket R2 "${bucketName}" tidak ditemukan. Aktifkan R2 lalu buat bucket ` +
        `dengan nama tersebut, atau jalankan ulang provisioning.`,
    };
  }
  if (res.status === 403) {
    return {
      ok: false,
      detail:
        `Token Cloudflare tidak punya izin R2 (403). Tambahkan permission ` +
        `"Workers R2 Storage: Edit" pada token, lalu ulangi. Detail: ${detail}`,
    };
  }
  return {
    ok: false,
    detail: `Tidak bisa memastikan bucket R2 "${bucketName}" (${detail}).`,
  };
}

// ---------------------------------------------------------------------------
// Build & deploy
// ---------------------------------------------------------------------------

/** Buang cache build Next supaya tidak ada sisa nilai env klien sebelumnya. */
export function cleanNextBuildCache(rootDir: string): void {
  const cacheDir = path.join(rootDir, '.next', 'cache');
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
  // `.open-next` dibersihkan oleh OpenNext sendiri (`initOutputDir()` di
  // @opennextjs/aws/build.js menghapus outputDir tiap build) — tidak perlu
  // dihapus di sini.
}

// ---------------------------------------------------------------------------
// Verifikasi site hidup pasca-deploy
// ---------------------------------------------------------------------------

export interface SiteLivenessResult {
  alive: boolean;
  /** URL terakhir yang berhasil direspons (kosong kalau tidak ada). */
  url: string;
  /** Rangkuman percobaan terakhir (untuk catatan deploy & pesan error). */
  detail: string;
  /** true bila site hanya merespons lewat alamat cadangan (workers.dev). */
  viaFallback?: boolean;
}

/**
 * Pastikan site benar-benar bisa diakses publik setelah `wrangler deploy`
 * sukses (audit Temuan 15). Tiap percobaan mengecek `/api/health` dulu; kalau
 * endpoint itu tidak ada (404/405) atau tidak bisa dihubungi, jatuh ke halaman
 * utama. Maksimal 3 percobaan dengan backoff singkat (cold start worker pertama
 * kadang butuh beberapa detik).
 *
 * Audit 2026-10-24: dulu **HTTP apa pun** dianggap hidup, sehingga halaman 500
 * atau 503 `error code: 1102` lolos sebagai "sukses". Sekarang:
 * - `/api/health` wajib HTTP 200 dan JSON `status === 'ok'`.
 * - Halaman utama wajib HTTP 2xx.
 * Status lain dicatat sebagai bukti site belum sehat.
 *
 * K1 (audit 2026-10-26): alamat utama adalah custom domain, yang bisa belum
 * menyebar (DNS/proxy) walau Worker sudah hidup. Karena itu `fallbackUrls`
 * (biasanya workers.dev) ikut dicek — deploy yang sukses tidak boleh dilaporkan
 * GAGAL hanya karena DNS belum siap.
 */
export async function verifySiteLiveness(
  baseUrl: string,
  onLog: (line: string) => void,
  options: {
    attempts?: number;
    timeoutMs?: number;
    backoffMs?: number;
    fallbackUrls?: string[];
  } = {}
): Promise<SiteLivenessResult> {
  const { attempts = 3, timeoutMs = 15000, backoffMs = 2000, fallbackUrls = [] } = options;
  const primary = baseUrl.replace(/\/+$/, '');

  const bases: string[] = [];
  for (const candidate of [primary, ...fallbackUrls]) {
    const trimmed = (candidate || '').replace(/\/+$/, '');
    if (trimmed && !bases.includes(trimmed)) bases.push(trimmed);
  }
  if (bases.length === 0) {
    return { alive: false, url: '', detail: 'tidak ada alamat untuk diverifikasi' };
  }

  let lastNote = 'belum ada percobaan';

  for (let attempt = 1; attempt <= attempts; attempt++) {
    for (const base of bases) {
      const isFallback = base !== primary;
      const source = isFallback ? ` (via ${base.replace(/^https?:\/\//, '')})` : '';
      const targets = [`${base}/api/health`, base];

      for (const target of targets) {
        try {
          const res = await fetch(target, {
            redirect: 'follow',
            signal: AbortSignal.timeout(timeoutMs),
          });

          if (target.endsWith('/api/health')) {
            // 404/405 = endpoint memang tidak ada; bukti diambil dari halaman utama.
            if (res.status === 404 || res.status === 405) {
              lastNote = `${target}: HTTP ${res.status} (endpoint health tidak ada)`;
              continue;
            }
            if (res.status !== 200) {
              lastNote = `${target}: HTTP ${res.status}`;
              continue;
            }
            const body = (await res.json().catch(() => null)) as { status?: string } | null;
            if (body?.status === 'ok') {
              return {
                alive: true,
                url: target,
                detail: `HTTP ${res.status} status ok dari ${target}${source}`,
                viaFallback: isFallback,
              };
            }
            lastNote = `${target}: HTTP 200 tapi status "${body?.status ?? 'tidak terbaca'}"`;
            continue;
          }

          if (res.ok) {
            return {
              alive: true,
              url: target,
              detail: `HTTP ${res.status} dari ${target}${source}`,
              viaFallback: isFallback,
            };
          }
          lastNote = `${target}: HTTP ${res.status}`;
        } catch (err) {
          lastNote = `${target}: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
    }
    if (attempt < attempts) {
      onLog(
        `>>> [VERIFIKASI] Site belum sehat (percobaan ${attempt}/${attempts}) — coba lagi dalam ${backoffMs / 1000} detik...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  return { alive: false, url: '', detail: lastNote, viaFallback: false };
}

export interface HandoverNoteInput {
  clientName: string;
  slug: string;
  websiteUrl: string;
  adminUrl: string;
  /** Path `arsip-klien/<folder>/config.env` (ditampilkan relatif, tanpa rahasia). */
  configPath: string;
  /** Kode keluar build & wrangler deploy (0 = sukses). */
  buildCode: number;
  deployCode: number;
  deployNotes?: string[];
  generatedAt?: Date;
}

/**
 * Merender `CATATAN_SERAH_TERIMA.md` (PK8 — v1.3.27) untuk satu klien.
 * Murni teks: TIDAK pernah menerima atau menampilkan password — file hanya
 * menunjuk ke lokasi kredensial di `config.env`. Ditulis `deployClient()`
 * setelah deploy sukses ke `arsip-klien/<slug>/`.
 */
export function renderHandoverNote(input: HandoverNoteInput): string {
  const {
    clientName,
    slug,
    websiteUrl,
    adminUrl,
    configPath,
    buildCode,
    deployCode,
    deployNotes = [],
    generatedAt = new Date(),
  } = input;
  const archiveDir = path.dirname(configPath);

  const lines = [
    `# Catatan Serah Terima — ${clientName} (${slug || 'tanpa-slug'})`,
    '',
    `Dibuat otomatis oleh \`deployClient()\` pada ${generatedAt.toISOString()}.`,
    'File ini milik owner: simpan bersama arsip klien, JANGAN dibagikan ke klien.',
    '',
    '## Aset website',
    '',
    `- Website: ${websiteUrl || '(belum tercatat di config.env)'}`,
    `- Admin panel: ${adminUrl || (websiteUrl ? `${websiteUrl}/admin/login` : '(belum tercatat)')}`,
    `- Kredensial admin (email + password): kunci \`ADMIN_EMAIL\` dan \`ADMIN_PASSWORD\``,
    `  di \`${configPath}\` — kirim ke klien lewat jalur privat, jangan ditempel di sini.`,
    '',
    '## Status deploy terakhir',
    '',
    `- Build: ${buildCode === 0 ? 'sukses' : `GAGAL (kode ${buildCode})`}`,
    `- Deploy: ${deployCode === 0 ? 'sukses' : `GAGAL (kode ${deployCode})`}`,
    ...(deployNotes.length > 0 ? ['- Catatan teknis:', ...deployNotes.map((n) => `  - ${n}`)] : []),
    '',
    '## Checklist serah terima (centang manual)',
    '',
    '- [ ] Website dibuka dari jaringan luar (bukan WiFi lokal) dan tampil normal.',
    '- [ ] Login `/admin` berhasil memakai kredensial dari `config.env`.',
    '- [ ] Klien sudah bisa mengubah konten sendiri lewat `/admin`.',
    '- [ ] Kredensial dikirim ke klien lewat jalur privat.',
    '- [ ] Panduan singkat kelola konten dijelaskan ke klien (`docs/release/CLIENT_OPERATIONS.md`).',
    '- [ ] Lupa password klien? `npx tsx scripts/cloudflare/reset-customer-password.ts`',
    '',
    '## Rutin & referensi',
    '',
    '- Backup D1 + media: `npm run backup:d1` / `npm run backup:r2`, lalu salin ke',
    '  flashdisk lewat menu [2] "Salin Cadangan" di `PENGELOLA_KLIEN.bat` (petunjuk: `cadangan-flashdisk/README.txt`),',
    '  detail: `docs/operations/backup-restore-runbook.md`.',
    '- Operasional klien: `docs/release/CLIENT_OPERATIONS.md`.',
    '- Gladi resik klien berikutnya: `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md`.',
    '- Bila ada masalah: `docs/operations/support-playbook.md`.',
    '',
    `> Arsip: \`${archiveDir}\``,
    '',
  ];

  return lines.join('\n');
}

export interface DeployClientOptions {
  rootDir: string;
  /** Path `arsip-klien/<folder>/config.env` milik klien. */
  configPath: string;
  run: RunCommand;
  onLog: (line: string) => void;
  /** Build + tulis konfigurasi tanpa mengunggah apa pun ke Cloudflare. */
  dryRun?: boolean;
}

export interface DeployClientResult {
  ok: boolean;
  slug: string;
  clientName: string;
  websiteUrl: string;
  buildCode: number;
  deployCode: number;
  wranglerConfig?: string;
  notes: string[];
  error?: string;
}

/** Build + deploy satu klien dengan env milik klien sendiri. */
export async function deployClient(options: DeployClientOptions): Promise<DeployClientResult> {
  const { rootDir, configPath, run, onLog, dryRun = false } = options;
  const notes: string[] = [];

  const raw = fs.readFileSync(configPath, 'utf8');
  const config = parseConfigEnv(raw);

  const clientName =
    config.CUSTOMER_NAME || config.CUSTOMER_SLUG || path.basename(path.dirname(configPath));
  const slug = config.CUSTOMER_SLUG || '';
  const websiteUrl = config.WEBSITE_URL || (slug ? `https://${slug}.workers.dev` : '');

  // R4: slug dipakai sebagai nama Worker dan nama berkas wrangler — tolak
  // sebelum menyentuh filesystem daripada menulis ke path yang tak diharapkan.
  if (slug && !isSafeCustomerSlug(slug)) {
    return {
      ok: false,
      slug,
      clientName,
      websiteUrl,
      buildCode: -1,
      deployCode: -1,
      notes,
      error: `CUSTOMER_SLUG "${slug}" tidak valid. Gunakan huruf, angka, dan tanda hubung saja.`,
    };
  }

  // 1. Secret klien (persist ke config.env) + rencana env.
  const generated = ensureClientSecrets(config);
  if (generated.length > 0) {
    upsertConfigEnv(
      configPath,
      generated.reduce<EnvMap>((acc, key) => {
        acc[key] = config[key];
        return acc;
      }, {})
    );
    notes.push(`Secret klien dibuat & disimpan: ${generated.join(', ')}`);
  }

  const plan = buildClientEnvPlan(config);
  if (plan.missing.length > 0) {
    return {
      ok: false,
      slug,
      clientName,
      websiteUrl,
      buildCode: -1,
      deployCode: -1,
      notes,
      error: `Konfigurasi klien belum lengkap: ${plan.missing.join(', ')}`,
    };
  }

  const blanks = collectOwnerBlankKeys(rootDir, plan.overrides);
  const buildEnv: EnvMap = { ...plan.overrides };
  for (const key of blanks) buildEnv[key] = '';
  // Token build-only dipasang SETELAH reset kunci owner: prerender `next build`
  // butuh REST, sedangkan `rewriteNextEnvFile()` + wrangler `vars` hanya
  // memakai `plan.overrides` sehingga token tidak ikut ke runtime klien.
  for (const [key, value] of Object.entries(plan.buildOnly)) {
    if (value) buildEnv[key] = value;
  }

  onLog(
    `>>> [ENV] Klien: ${slug} | override ${Object.keys(plan.overrides).length} kunci, reset ${blanks.length} kunci owner`
  );
  if (blanks.length > 0) {
    onLog(`    reset: ${blanks.join(', ')}`);
  }

  // 2. Kaitkan URL publik sebelum build supaya NEXT_PUBLIC_* ikut benar.
  if (!dryRun) {
    const subdomain = await resolveWorkersSubdomain(
      config.CLOUDFLARE_ACCOUNT_ID,
      config.CLOUDFLARE_API_TOKEN
    );
    if (subdomain) {
      notes.push(`Subdomain workers.dev: ${subdomain}`);
      if (!config.WORKERS_SUBDOMAIN) upsertConfigEnv(configPath, { WORKERS_SUBDOMAIN: subdomain });
      if (slug) {
        const workersUrl = `https://${slug}.${subdomain}.workers.dev`;
        // Hanya ganti URL lama (Pages) / URL provisional hasil onboarding;
        // custom domain milik klien tidak disentuh.
        const isStale =
          !config.WEBSITE_URL ||
          config.WEBSITE_URL.endsWith('.pages.dev') ||
          config.WEBSITE_URL === `https://${slug}.workers.dev`;
        if (isStale) {
          upsertConfigEnv(configPath, {
            WEBSITE_URL: workersUrl,
            ADMIN_URL: `${workersUrl}/admin`,
          });
          config.WEBSITE_URL = workersUrl;
          notes.push(`URL klien diperbarui ke ${workersUrl}`);
        }
      }
    } else {
      notes.push(
        'Subdomain workers.dev tidak bisa dibaca (izin token?) — URL memakai nilai config.env.'
      );
    }
    plan.overrides.NEXT_PUBLIC_APP_URL = config.WEBSITE_URL || '';
    plan.overrides.NEXT_PUBLIC_SITE_URL = config.WEBSITE_URL || '';
    buildEnv.NEXT_PUBLIC_APP_URL = plan.overrides.NEXT_PUBLIC_APP_URL;
    buildEnv.NEXT_PUBLIC_SITE_URL = plan.overrides.NEXT_PUBLIC_SITE_URL;
  }

  // 2b. Verifikasi bucket R2 SEBELUM build (audit 2026-10-24, temuan K8).
  //     Dulu bucket yang gagal dibuat baru ketahuan setelah build 5–10 menit,
  //     saat wrangler deploy menolak binding R2. Gagal cepat + pesan jelas.
  if (!dryRun) {
    const bucketName =
      config.CLOUDFLARE_R2_BUCKET || config.CLOUDFLARE_R2_BUCKET_NAME || `media-${slug}`;
    const r2 = await ensureR2Bucket(
      config.CLOUDFLARE_ACCOUNT_ID,
      config.CLOUDFLARE_API_TOKEN,
      bucketName
    );
    if (!r2.ok) {
      return {
        ok: false,
        slug,
        clientName,
        websiteUrl,
        buildCode: -1,
        deployCode: -1,
        notes,
        error: r2.detail,
      };
    }
    notes.push(r2.detail);
  }

  // 3. Bersihkan cache build lama (nilai env klien sebelumnya tidak boleh tersisa).
  cleanNextBuildCache(rootDir);

  // 4. Build dengan env klien. (`{...process.env, ...}` = perilaku run impl;
  //     spread process.env juga membuat objek memenuhi type NodeJS.ProcessEnv
  //     yang di-augmentasi Next dengan properti wajib seperti NODE_ENV.)
  const build = await run(
    'npm',
    ['run', 'cf:build'],
    { cwd: rootDir, env: { ...process.env, ...buildEnv } },
    onLog
  );
  if (build.code !== 0) {
    return {
      ok: false,
      slug,
      clientName,
      websiteUrl,
      buildCode: build.code,
      deployCode: -1,
      notes,
      error: `Build gagal dengan kode keluar ${build.code}`,
    };
  }

  // 5. Buang rahasia owner dari next-env.mjs — FAIL-CLOSED (audit 2026-10-24).
  //    Kalau file tidak ada atau formatnya berubah sehingga tidak ada ekspor yang
  //    dikenali, deploy DIBATALKAN. Dulu deploy lanjut dan rahasia owner bisa
  //    ikut ke Worker klien tanpa terdeteksi.
  const nextEnvPath = path.join(rootDir, '.open-next', 'cloudflare', 'next-env.mjs');
  const rewrite = rewriteNextEnvFile(path.join(rootDir, '.open-next'), plan.overrides);
  if (!fs.existsSync(nextEnvPath) || rewrite.modes.length === 0) {
    notes.push('next-env.mjs tidak ditemukan / format tidak dikenali — deploy dibatalkan');
    return {
      ok: false,
      slug,
      clientName,
      websiteUrl,
      buildCode: build.code,
      deployCode: -1,
      notes,
      error:
        'next-env.mjs tidak ditemukan atau formatnya tidak dikenali. Deploy dibatalkan agar rahasia owner tidak ikut ke Worker klien.',
    };
  }
  if (rewrite.written) {
    onLog(
      `>>> [ENV] next-env.mjs ditulis ulang (${rewrite.modes.join(', ')}) — ${rewrite.dropped.length} kunci owner dibuang, ${rewrite.kept.length} kunci diwariskan.`
    );
    if (rewrite.dropped.length > 0) onLog(`    dibuang: ${rewrite.dropped.join(', ')}`);
    notes.push(`next-env.mjs: buang ${rewrite.dropped.length} kunci owner`);
  } else {
    notes.push('next-env.mjs sudah bersih (tidak ada kunci owner yang perlu dibuang)');
  }

  // 6. KV ISR (hanya deploy sungguhan; id idempoten disimpan di config.env).
  let kvIncId: string | undefined = config.CLOUDFLARE_KV_INC_NAMESPACE_ID;
  let kvTagId: string | undefined = config.CLOUDFLARE_KV_TAG_NAMESPACE_ID;

  if (!dryRun && (!kvIncId || !kvTagId)) {
    const kv = await ensureClientKvNamespaces(
      config.CLOUDFLARE_ACCOUNT_ID,
      config.CLOUDFLARE_API_TOKEN,
      slug
    );
    kvIncId = kv.incId;
    kvTagId = kv.tagId;
    notes.push(...kv.notes);
    const updates: EnvMap = {};
    if (kv.incId) updates.CLOUDFLARE_KV_INC_NAMESPACE_ID = kv.incId;
    if (kv.tagId) updates.CLOUDFLARE_KV_TAG_NAMESPACE_ID = kv.tagId;
    if (Object.keys(updates).length > 0) upsertConfigEnv(configPath, updates);
  }

  // 7. Tulis wrangler config klien (setelah build: `.open-next` dibuat ulang).
  const wranglerConfig = writeWranglerClientConfig({
    rootDir,
    slug,
    overrides: plan.overrides,
    kvIncId,
    kvTagId,
    d1DatabaseName: config.CLOUDFLARE_D1_DATABASE_NAME,
  });
  onLog(`>>> [CONFIG] wrangler config klien: ${path.relative(rootDir, wranglerConfig)}`);

  // 8. Deploy. `OPEN_NEXT_DEPLOY=true` mencegah wrangler memanggil balik
  //    `opennextjs-cloudflare deploy` (yang butuh binding KV saat populateCache).
  const deployArgs = ['wrangler', 'deploy'];
  if (dryRun) deployArgs.push('--dry-run');
  // R3: `runCommandStreaming` memakai `shell: true` di Windows, jadi path yang
  // mengandung spasi harus dikutip. Di platform lain argumen harus polos.
  deployArgs.push(
    '--config',
    process.platform === 'win32' ? `"${wranglerConfig}"` : wranglerConfig
  );

  const deployEnv: EnvMap = {
    CLOUDFLARE_ACCOUNT_ID: config.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: config.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
    OPEN_NEXT_DEPLOY: 'true',
  };

  const deploy = await run(
    'npx',
    deployArgs,
    { cwd: rootDir, env: { ...process.env, ...deployEnv } },
    onLog
  );

  const finalUrl = config.WEBSITE_URL || websiteUrl;

  // 8.5 Verifikasi site hidup (audit Temuan 15): `wrangler deploy` sukses belum
  //     menjamin site bisa diakses publik (worker gagal start, route bermasalah,
  //     dsb). Cek /api/health (fallback halaman utama), maksimal 3 percobaan.
  //     K1: custom domain bisa belum menyebar, jadi workers.dev ikut dicek
  //     sebagai cadangan supaya deploy sukses tidak dilaporkan GAGAL.
  let siteAlive = true;
  if (deploy.code === 0 && !dryRun && finalUrl) {
    const fallbackUrl = workersDevUrl(config, slug);
    const fallbackUrls = fallbackUrl && fallbackUrl !== finalUrl ? [fallbackUrl] : [];

    onLog(`>>> [VERIFIKASI] Cek site hidup: ${finalUrl}`);
    if (fallbackUrls.length > 0) {
      onLog(`>>> [VERIFIKASI] Cadangan bila domain belum menyebar: ${fallbackUrl}`);
    }

    const liveness = await verifySiteLiveness(finalUrl, onLog, { fallbackUrls });
    if (liveness.alive) {
      onLog(`>>> [VERIFIKASI] Site hidup — ${liveness.detail}`);
      notes.push(`Verifikasi site hidup: ${liveness.detail}`);
      if (liveness.viaFallback) {
        notes.push(
          `Catatan: alamat utama ${finalUrl} belum merespons; site diverifikasi lewat ${fallbackUrl}. Periksa DNS/custom domain.`
        );
      }
    } else {
      siteAlive = false;
      notes.push(`Verifikasi site hidup GAGAL: ${liveness.detail}`);
    }
  }

  // 9. CATATAN_SERAH_TERIMA.md (PK8): hanya saat deploy sukses DAN site sudah
  //    terbukti hidup, supaya isi catatan tidak pernah berbeda dari status
  //    portal. Kegagalan menulis catatan tidak mengubah status deploy.
  if (deploy.code === 0 && siteAlive && !dryRun) {
    const notePath = path.join(path.dirname(configPath), 'CATATAN_SERAH_TERIMA.md');
    try {
      const note = renderHandoverNote({
        clientName,
        slug,
        websiteUrl: finalUrl,
        adminUrl: config.ADMIN_URL || (finalUrl ? `${finalUrl}/admin/login` : ''),
        configPath: path.relative(rootDir, configPath) || configPath,
        buildCode: build.code,
        deployCode: deploy.code,
        deployNotes: notes,
      });
      fs.writeFileSync(notePath, note, 'utf8');
      notes.push(`CATATAN_SERAH_TERIMA.md ditulis: ${path.relative(rootDir, notePath) || notePath}`);
      onLog(`>>> [CATATAN] Catatan serah terima ditulis: ${notePath}`);
    } catch (err) {
      notes.push(
        `CATATAN_SERAH_TERIMA.md GAGAL ditulis: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  let error: string | undefined;
  if (deploy.code !== 0) {
    error = `Wrangler keluar dengan kode ${deploy.code}`;
  } else if (!siteAlive) {
    error = `Deploy sukses tapi site tidak merespon: ${finalUrl}`;
  }

  return {
    ok: deploy.code === 0 && siteAlive,
    slug,
    clientName,
    websiteUrl: finalUrl,
    buildCode: build.code,
    deployCode: deploy.code,
    wranglerConfig,
    notes,
    error,
  };
}

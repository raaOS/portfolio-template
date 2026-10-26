import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { SHARED_SCHEMA_QUERIES } from '../../src/crud/shared/db/schema';
import { D1_SCHEMA_QUERIES } from '../../src/lib/d1-schema';
import { hashPasswordScrypt } from '../../src/crud/shared/auth/password';
import { clientUrls, deployClient, ensureR2Bucket, resolveWorkersSubdomain, workersDevUrl } from './client-deploy';
import { probeClientHealth } from './portal-status';
import { sendWebsiteOnlineEmail, listOrderSlugs } from './notify-online';
import { attachWorkerDomain, findWorkerDomain, buildDomainHandoverMessage, guardWorkerDomainAttach } from './custom-domain';
import {
  findArchiveForSlug,
  createArchiveDir,
  resolveProvisionedAdminPassword,
  guardCrossClientSlug,
} from './onboard-reuse';
import { verifyAppKvWritable } from './app-kv-preflight';
import { parseEnv } from './env-file';
import {
  VAULT_COOKIE_NAME,
  VAULT_SESSION_TTL_MS,
  VaultAttemptLimiter,
  VaultSessionStore,
  createVaultPassword,
  getCookie,
  isVaultConfigured,
  validateNewVaultPassword,
  verifyVaultPassword,
} from './portal-vault';
import {
  isSafeArchiveFolderName,
  listClientSummaries,
  partitionDeployTargets,
  readClientDetail,
  readClientSecrets,
  readProjectVersions,
} from './portal-clients';

const PORT = Number(process.env.PORT) || 4567;
const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'scripts', 'onboarding', 'public');
const ARCHIVE_DIR = path.join(ROOT_DIR, 'arsip-klien');
/**
 * Kunci deploy proses-tunggal. Build OpenNext menulis ke `.open-next` yang sama
 * untuk semua klien, jadi hanya satu deploy boleh berjalan pada satu waktu.
 */
let deployInProgress = false;
// PORTAL_ENV_LOCAL_PATH hanya dipakai saat pengujian lokal; produksi memakai .env.local.
const ENV_LOCAL_PATH = process.env.PORTAL_ENV_LOCAL_PATH
  ? path.resolve(ROOT_DIR, process.env.PORTAL_ENV_LOCAL_PATH)
  : path.join(ROOT_DIR, '.env.local');
const vaultAttempts = new VaultAttemptLimiter();
const vaultSessions = new VaultSessionStore();

if (!fs.existsSync(ARCHIVE_DIR)) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

// Helper: Stream child_process stdout/stderr line-by-line
function runCommandStreaming(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
  onLog: (line: string) => void
): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const child = spawn(command, args, {
      ...options,
      shell: isWin,
      env: { ...process.env, ...(options.env || {}) },
    });

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) onLog(line);
      }
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) onLog(line);
      }
    });

    child.on('error', (err) => {
      onLog(`[ERROR] ${err.message}`);
      resolve({ code: 1 });
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 0 });
    });
  });
}

interface ProvisionPayload {
  clientName: string;
  clientSlug: string;
  templateKey: 'os-desktop' | 'infinite-canvas' | 'spatial-gallery';
  accountId: string;
  apiToken: string;
  adminEmail: string;
  adminPassword?: string;
}

// Helper fetch to Cloudflare API
async function cfApi(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = (await res.json()) as {
    success: boolean;
    errors?: Array<{ message: string; code?: number }>;
    result?: unknown;
  };
  return { ok: res.ok && data.success, status: res.status, data };
}

/**
 * Jalankan satu statement D1 dengan BINDING PARAMETER (`?`).
 *
 * Audit 2026-10-08 (temuan #5): SQL disusun lewat interpolasi string
 * (`${JSON.stringify(value)}` / kutip manual) — teks berupa potongan SQL bisa
 * mematahkan statement. Semua nilai kini masuk lewat `params`.
 *
 * LEMPAR ERROR kalau statement gagal (audit temuan #2: dulu hasil tulis D1
 * diabaikan sehingga database kosong pun dilaporkan sukses).
 */
async function d1Query(
  accountId: string,
  apiToken: string,
  databaseId: string,
  sql: string,
  params: Array<string | number | null> = []
): Promise<Array<Record<string, unknown>>> {
  const res = await cfApi(`/accounts/${accountId}/d1/database/${databaseId}/query`, apiToken, {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  });

  const statements = Array.isArray(res.data?.result)
    ? (res.data.result as Array<{
        success?: boolean;
        error?: string;
        results?: Array<Record<string, unknown>>;
      }>)
    : [];
  const first = statements[0];
  const statementError = first && first.success === false ? first.error || '' : '';
  const topError = res.data?.errors?.map((e) => e.message).filter(Boolean).join('; ') || '';

  if (!res.ok || statementError || topError) {
    throw new Error(`Query D1 gagal: ${statementError || topError || `HTTP ${res.status}`}`);
  }

  return Array.isArray(first?.results) ? first.results : [];
}

// Generate folder arsip bernomor (01_slug, 02_slug, ...) — kini ada di
// ./onboard-reuse (createArchiveDir) supaya portal & CLI memakai kebijakan yang sama.

// Provisioning Worker with Progress Callback
async function provisionClient(
  payload: ProvisionPayload,
  onProgress: (step: number, message: string, detail?: string) => void
) {
  const { clientName, clientSlug, templateKey, accountId, apiToken, adminEmail } = payload;
  // Password admin BELUM diputuskan di sini: kalau re-provision slug lama, password
  // lama dipertahankan (lihat resolveProvisionedAdminPassword — audit MEDIUM M4).
  const explicitPassword = (payload.adminPassword || '').trim();
  const siteId = clientSlug;
  const dbName = `db-${clientSlug}`;
  const r2BucketName = `media-${clientSlug}`;

  // Penjaga slug lintas klien (audit 2026-10-08, temuan #6): slug yang sudah
  // terarkip untuk akun Cloudflare LAIN berarti milik klien berbeda — menimpanya
  // = menghancurkan arsip & database klien lain. Dijaga di sini, SEBELUM ada
  // resource yang dibuat, supaya gagal cepat dan jelas.
  const existingArchive = findArchiveForSlug(ARCHIVE_DIR, clientSlug);
  guardCrossClientSlug(existingArchive, accountId);

  // STEP 1: Verifikasi Kredensial
  onProgress(1, 'Memverifikasi kredensial Cloudflare...', 'Menghubungkan ke Cloudflare API v4');
  const verifyTokenRes = await cfApi('/user/tokens/verify', apiToken);
  if (!verifyTokenRes.ok) {
    throw new Error(
      `API Token tidak valid atau tidak memiliki izin yang cukup. (${verifyTokenRes.data?.errors?.[0]?.message || 'Akses ditolak'})`
    );
  }

  const verifyAccountRes = await cfApi(`/accounts/${accountId}`, apiToken);
  if (!verifyAccountRes.ok) {
    throw new Error(
      `Account ID salah atau token tidak punya akses ke akun ini. (${verifyAccountRes.data?.errors?.[0]?.message || 'Akun tidak ditemukan'})`
    );
  }

  // STEP 2: Database D1
  onProgress(2, 'Menyiapkan Database D1...', `Membuat database: ${dbName}`);
  let databaseId = '';
  const createDbRes = await cfApi(`/accounts/${accountId}/d1/database`, apiToken, {
    method: 'POST',
    body: JSON.stringify({ name: dbName }),
  });

  if (createDbRes.ok && createDbRes.data.result) {
    databaseId = (createDbRes.data.result as { uuid: string }).uuid;
  } else {
    // Check if database already exists
    const listDbRes = await cfApi(`/accounts/${accountId}/d1/database?name=${dbName}`, apiToken);
    if (listDbRes.ok && Array.isArray(listDbRes.data.result) && listDbRes.data.result[0]) {
      databaseId = (listDbRes.data.result[0] as { uuid: string }).uuid;
    } else {
      throw new Error(
        `Gagal membuat Database D1: ${createDbRes.data?.errors?.[0]?.message || 'Kesalahan API D1'}`
      );
    }
  }

  // STEP 3: Storage Media R2
  onProgress(3, 'Menyiapkan Storage Media R2...', `Membuat bucket R2: ${r2BucketName}`);
  // FAIL-CLOSED (audit 2026-10-24, temuan K8): dulu kegagalan di sini hanya
  // `console.warn`, lalu portal tetap mengklaim "Infrastruktur Siap" dan build
  // 5–10 menit berujung gagal saat wrangler deploy (bucket tidak ada).
  // Sekarang provisioning berhenti dengan pesan yang bisa ditindaklanjuti.
  const r2 = await ensureR2Bucket(accountId, apiToken, r2BucketName, { create: true });
  if (!r2.ok) {
    throw new Error(`STEP 3 gagal menyiapkan bucket R2: ${r2.detail}`);
  }

  // STEP 4: Migrasi Skema Tabel & Data Awal
  onProgress(
    4,
    'Memasang Tabel & Template...',
    `Mengatur template: ${
      templateKey === 'spatial-gallery'
        ? '3D Spatial Gallery'
        : templateKey === 'os-desktop'
        ? 'macOS Desktop'
        : 'Infinite Canvas'
    }`
  );
  // Dua skema dipasang berurutan (audit 2026-10-08, temuan #1 & #14):
  //   1. SHARED_SCHEMA_QUERIES — inti site/login/konten (dipakai portal & auth).
  //   2. D1_SCHEMA_QUERIES — tabel runtime yang dibaca aplikasi klien
  //      (orders, site_analytics, platform_settings, project_narratives, ...).
  // Dulu HANYA skema 1 yang dipasang → tabel orders dkk. tidak pernah ada di
  // database klien sampai ada kode yang kebetulan menjalankan bootstrap.
  // Urutan penting: SHARED dulu supaya bentuk kolom projects/media_assets milik
  // SHARED yang menang; CREATE TABLE IF NOT EXISTS milik D1 otomatis skip.
  // Setiap statement D1 dijalankan lewat d1Query yang LEMPAR ERROR saat gagal
  // (audit temuan #2: dulu hasilnya diabaikan).
  try {
    for (const sql of [...SHARED_SCHEMA_QUERIES, ...D1_SCHEMA_QUERIES]) {
      await d1Query(accountId, apiToken, databaseId, sql);
    }
  } catch (err) {
    throw new Error(`STEP 4 gagal memasang tabel database: ${(err as Error).message}`);
  }

  // STEP 4b: probe tulis app_kv (audit 2026-10-24, temuan K1). Skema bersama
  // membuat app_kv berbeda bentuk dari yang ditulis aplikasi; tanpa probe,
  // klien menerima situs yang tidak bisa login / menyimpan konten.
  await verifyAppKvWritable((sql, params) =>
    d1Query(accountId, apiToken, databaseId, sql, params)
  );

  // Seed site row — binding parameter (audit temuan #5: tanpa interpolasi SQL).
  const seedSiteSql = `
    INSERT INTO sites (id, slug, name, status, active_template_key, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      active_template_key = excluded.active_template_key,
      updated_at = datetime('now');
  `;
  await d1Query(accountId, apiToken, databaseId, seedSiteSql, [
    siteId,
    clientSlug,
    clientName,
    templateKey,
  ]);

  // --- Penjagaan re-provision (audit MEDIUM M4, 2026-10-06) -----------------
  // Kalau slug ini sudah pernah onboarding: pakai arsip lama + password lama,
  // jangan rotasi diam-diam dan jangan gandakan folder arsip.
  // (`existingArchive` sudah dibaca di awal fungsi — lihat guard slug di atas.)
  let adminExists = false;
  if (!explicitPassword) {
    // Gagal memeriksa = tidak boleh menebak: rotasi diam-diam lebih berbahaya
    // daripada error. d1Query melempar error kalau query gagal.
    const adminRows = await d1Query(
      accountId,
      apiToken,
      databaseId,
      `SELECT id FROM site_users WHERE site_id = ? AND email = ? LIMIT 1`,
      [siteId, adminEmail.toLowerCase()]
    );
    adminExists = adminRows.length > 0;
  }
  const adminDecision = resolveProvisionedAdminPassword({
    explicitPassword,
    adminExists,
    archivePassword: existingArchive?.env.ADMIN_PASSWORD,
    generateFallback: () => `Porto${crypto.randomBytes(3).toString('hex')}!`,
  });
  const adminPassword = adminDecision.effectivePassword;

  // Seed admin user (hanya kalau password memang harus ditulis: baru/rotasi eksplisit)
  if (adminDecision.seedUser) {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPasswordScrypt(adminPassword, salt);
    const userId = `user-${crypto.randomUUID()}`;
    const seedUserSql = `
      INSERT INTO site_users (id, site_id, email, password_hash, password_salt, password_algorithm, role, created_at)
      VALUES (?, ?, ?, ?, ?, 'scrypt', 'admin', datetime('now'))
      ON CONFLICT(site_id, email) DO UPDATE SET
        password_hash = excluded.password_hash,
        password_salt = excluded.password_salt;
    `;
    await d1Query(accountId, apiToken, databaseId, seedUserSql, [
      userId,
      siteId,
      adminEmail.toLowerCase(),
      passwordHash,
      salt,
    ]);
  } else {
    console.log('✓ Admin sudah ada — password lama dipertahankan (tidak dirotasi).');
  }

  // STEP 4c: VERIFIKASI hasil tulis (audit 2026-10-08, temuan #2).
  // Dulu semua hasil query diabaikan → database kosong pun dilaporkan sukses,
  // email "Website Sudah Online" tetap terkirim, lalu klien tidak bisa login.
  // Kegagalan di sini menghentikan provisioning SEBELUM deploy & email.
  const requiredTables = [
    'sites',
    'site_users',
    'projects',
    'project_narratives',
    'media_assets',
    'orders',
    'platform_settings',
  ];
  const tableRows = await d1Query(
    accountId,
    apiToken,
    databaseId,
    `SELECT name FROM sqlite_master WHERE type = 'table'`
  );
  const presentTables = new Set(tableRows.map((row) => String(row.name || '')));
  const missingTables = requiredTables.filter((name) => !presentTables.has(name));
  if (missingTables.length > 0) {
    throw new Error(
      `Verifikasi STEP 4 gagal — tabel berikut tidak terbentuk di database: ${missingTables.join(', ')}`
    );
  }

  const seededSiteRows = await d1Query(
    accountId,
    apiToken,
    databaseId,
    `SELECT id FROM sites WHERE id = ? LIMIT 1`,
    [siteId]
  );
  if (seededSiteRows.length === 0) {
    throw new Error('Verifikasi STEP 4 gagal — baris site tidak tersimpan di database.');
  }

  if (adminDecision.seedUser) {
    const seededAdminRows = await d1Query(
      accountId,
      apiToken,
      databaseId,
      `SELECT id FROM site_users WHERE site_id = ? AND email = ? LIMIT 1`,
      [siteId, adminEmail.toLowerCase()]
    );
    if (seededAdminRows.length === 0) {
      throw new Error('Verifikasi STEP 4 gagal — akun admin tidak tersimpan di database.');
    }
  }

  // STEP 5: Pengarsipan Folder Klien (Isolasi Total)
  onProgress(5, 'Mengarsipkan Kunci & Dokumen Klien...', 'Menyimpan ke folder arsip-klien di laptop');
  // Re-provision: tulis ulang ke folder arsip YANG SAMA (arsip lama dipakai ulang,
  // tidak membuat 02_slug / 03_slug ganda).
  const { dirPath, folderName } = existingArchive ?? createArchiveDir(ARCHIVE_DIR, clientSlug);

  // URL publik memakai Cloudflare Worker (Opsi B), bukan Pages.
  // Subdomain workers.dev dibaca best-effort; kalau token belum punya izin,
  // deploy berikutnya akan mencoba lagi dan memperbarui config.env.
  // Re-provision: WEBSITE_URL/ADMIN_URL lama menang (mis. sudah custom domain).
  const subdomain = await resolveWorkersSubdomain(accountId, apiToken);
  const defaultWebsiteUrl = `https://${clientSlug}.${subdomain ? `${subdomain}.` : ''}workers.dev`;
  const websiteUrl = existingArchive?.env.WEBSITE_URL || defaultWebsiteUrl;
  const adminUrl = existingArchive?.env.ADMIN_URL || `${websiteUrl}/admin`;

  // Secret milik klien — tidak pernah memakai nilai dari .env.local owner.
  // Re-provision: pakai ulang secret lama supaya sesi admin yang sedang login tidak keluar.
  const jwtSecret = existingArchive?.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  const passwordSalt = existingArchive?.env.PASSWORD_SALT || crypto.randomBytes(16).toString('hex');

  // Konten config.env: kunci yang dikontrol onboarding ditulis ulang; kunci lain
  // dari arsip lama (mis. CRON_SECRET yang ditulis deployClient) dipertahankan.
  const prevEnv = existingArchive?.env || {};
  const controlledEnv: Record<string, string> = {
    CUSTOMER_NAME: clientName,
    CUSTOMER_SLUG: clientSlug,
    ACTIVE_TEMPLATE_KEY: templateKey,
    CUSTOMER_SITE_ID: siteId,
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_D1_DATABASE_NAME: dbName,
    CLOUDFLARE_D1_DATABASE_ID: databaseId,
    CLOUDFLARE_D1_API_TOKEN: apiToken,
    CLOUDFLARE_R2_BUCKET_NAME: r2BucketName,
    CLOUDFLARE_R2_BUCKET: r2BucketName,
    CLOUDFLARE_R2_ACCOUNT_ID: accountId,
    CLOUDFLARE_R2_PUBLIC_BASE_URL: '/r2',
    CLOUDFLARE_API_TOKEN: apiToken,
    JWT_SECRET: jwtSecret,
    PASSWORD_SALT: passwordSalt,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    WEBSITE_URL: websiteUrl,
    ADMIN_URL: adminUrl,
  };
  if (subdomain) controlledEnv.WORKERS_SUBDOMAIN = subdomain;
  const hasWorkersSubdomain = Boolean(subdomain || prevEnv.WORKERS_SUBDOMAIN);
  const leftoverKeys = Object.keys(prevEnv).filter((k) => !(k in controlledEnv)).sort();

  const envContent = [
    `# ========================================================`,
    `# ARSIP KLIEN: ${clientName} (${folderName})`,
    existingArchive
      ? `# Diperbarui (re-provision): ${new Date().toLocaleString('id-ID')}`
      : `# Tanggal Pembuatan: ${new Date().toLocaleString('id-ID')}`,
    `# ========================================================`,
    ...Object.entries(controlledEnv).map(([key, value]) => `${key}="${value}"`),
    ...(hasWorkersSubdomain ? [] : [`# WORKERS_SUBDOMAIN="" (belum terbaca saat onboarding)`]),
    ...leftoverKeys.map((key) => `${key}="${prevEnv[key]}"`),
    ``,
  ].join('\n');
  fs.writeFileSync(path.join(dirPath, 'config.env'), envContent, 'utf-8');

  const handoverDoc = [
    `==================================================================`,
    `         SURAT SERAH TERIMA PORTOFOLIO WEBSITE (RESMI)`,
    `==================================================================`,
    `Nama Klien        : ${clientName}`,
    `Template Dipilih  : ${templateKey === 'os-desktop' ? 'macOS Desktop OS Simulator' : templateKey === 'spatial-gallery' ? '3D Spatial Gallery' : 'Infinite Canvas (Interactive Gallery)'}`,
    `Tanggal Aktivasi  : ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`,
    ``,
    `ALAMAT WEBSITE & LOGIN:`,
    `------------------------------------------------------------------`,
    `• Alamat Website   : ${websiteUrl}`,
    `• Alamat Admin     : ${adminUrl}`,
    `• Email Login      : ${adminEmail}`,
    `• Password Admin   : ${adminPassword}`,
    ``,
    `DATA TEKNIS INFRASTRUKTUR (TERISOLASI 100%):`,
    `------------------------------------------------------------------`,
    `• Cloudflare D1 DB : ${dbName} (ID: ${databaseId})`,
    `• Cloudflare R2    : ${r2BucketName}`,
    `• Cloudflare Worker: ${clientSlug}`,
    ``,
    `==================================================================`,
    `PESAN WHATSAPP SIAP COPY-PASTE KE KLIEN:`,
    `==================================================================`,
    `Halo kak ${clientName}! 👋`,
    `Website portofolio interaktif kamu sudah resmi aktif dan siap dipakai! 🚀`,
    ``,
    `🌐 Website Kamu:`,
    `${websiteUrl}`,
    ``,
    `🔐 Ruang Admin Pribadi (untuk kelola karya, foto, & profil):`,
    `${adminUrl}`,
    `Email    : ${adminEmail}`,
    `Password : ${adminPassword}`,
    ``,
    `Semua foto, video karya, dan kontak bisa kamu tambahkan sendiri dengan sangat mudah di ruang admin. Selamat berkarya dan sukses selalu! 🎉✨`,
    `==================================================================`,
  ].join('\n');
  fs.writeFileSync(path.join(dirPath, 'SURAT_SERAH_TERIMA.txt'), handoverDoc, 'utf-8');

  // STEP 6: Infrastruktur selesai — build & deploy menyusul di endpoint
  // /api/provision (lihat panggilan deployClient() di server.ts).
  onProgress(6, 'Infrastruktur selesai. Lanjut build & deploy website...', 'Database, storage, dan arsip klien siap.');

  return {
    success: true,
    clientName,
    clientSlug,
    templateKey,
    websiteUrl,
    adminUrl,
    adminEmail,
    adminPassword,
    archiveFolder: `arsip-klien/${folderName}`,
    databaseId,
    r2BucketName,
  };
}

// Create HTTP Server
//
// PENJAGAAN AKSES (audit business flow 2026-10-06, temuan C3):
// - Origin guard: tolak permintaan yang dibawa halaman web lain (mencegah
//   situs jahat membaca /api/clients yang memuat kredensial admin klien).
// - Server hanya di-bind ke 127.0.0.1 (lihat server.listen di bawah), jadi
//   perangkat lain di jaringan lokal/wifi tidak bisa menjangkaunya.
// - Tidak ada CORS wildcard lagi — halaman portal (localhost:4567) memang
//   same-origin, jadi header CORS tidak diperlukan.
const ALLOWED_ORIGINS = new Set([`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]);
const VAULT_COOKIE_MAX_AGE_SECONDS = Math.floor(VAULT_SESSION_TTL_MS / 1000);

function sendJson(
  res: http.ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function isAllowedPortalHost(req: http.IncomingMessage): boolean {
  const host = String(req.headers.host || '').toLowerCase();
  return host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`;
}

function requirePortalHost(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (isAllowedPortalHost(req)) return true;
  sendJson(res, 403, { success: false, message: 'Host tidak diizinkan.' });
  return false;
}

function setVaultCookie(res: http.ServerResponse, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `${VAULT_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${VAULT_COOKIE_MAX_AGE_SECONDS}`
  );
}

function clearVaultCookie(res: http.ServerResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${VAULT_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  );
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;

    req.on('data', (chunk: Buffer) => {
      if (tooLarge) return;
      body += chunk.toString();
      if (Buffer.byteLength(body, 'utf-8') > 16_384) tooLarge = true;
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new Error('TOO_LARGE'));
        return;
      }
      try {
        const parsed = JSON.parse(body || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('INVALID'));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new Error('INVALID'));
      }
    });
    req.on('error', reject);
  });
}

function requestKey(req: http.IncomingMessage): string {
  return req.socket.remoteAddress || 'local';
}

function retryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}


const server = http.createServer(async (req, res) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin && !ALLOWED_ORIGINS.has(requestOrigin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Akses ditolak.' }));
    return;
  }

  const url = req.url?.split('?')[0] || '/';
  const sensitiveUrl =
    url.startsWith('/api/vault/') ||
    url === '/api/client-detail' ||
    url === '/api/client-secrets';

  // Cegah DNS rebinding: endpoint brankas hanya boleh dipanggil lewat host loopback.
  if (sensitiveUrl && !requirePortalHost(req, res)) return;

  // Static files
  if (url === '/' || url === '/index.html') {
    const htmlPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
  }

  // API: Diagram peta bisnis owner (sumber kebenaran: docs/diagrams/*.mmd)
  if (url === '/api/diagrams' && req.method === 'GET') {
    const diagramsDir = path.join(ROOT_DIR, 'docs', 'diagrams');
    const readDiagram = (name: string) => {
      try {
        return fs.readFileSync(path.join(diagramsDir, name), 'utf-8');
      } catch {
        return '';
      }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        alurBisnis: readDiagram('alur-bisnis.mmd'),
        petaAset: readDiagram('peta-aset.mmd'),
      })
    );
    return;
  }

  // API: Verify Token
  if (url === '/api/verify' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const { accountId, apiToken } = JSON.parse(body);
        if (!accountId || !apiToken) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Account ID dan API Token wajib diisi.' }));
          return;
        }

        const tokenRes = await cfApi('/user/tokens/verify', apiToken);
        if (!tokenRes.ok) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              message: 'API Token tidak valid. Pastikan token sudah dibuat dengan izin D1, R2, dan Workers (Edit).',
            })
          );
          return;
        }

        const accountRes = await cfApi(`/accounts/${accountId}`, apiToken);
        if (!accountRes.ok) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              message: 'Account ID salah atau tidak cocok dengan token yang dimasukkan.',
            })
          );
          return;
        }

        const accountName = (accountRes.data.result as { name?: string })?.name || 'Cloudflare Account';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, accountName }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: (err as Error).message }));
      }
    });
    return;
  }

  // API: Provision (Server-Sent Events for live progress)
  if (url === '/api/provision' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body) as ProvisionPayload;

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const sendEvent = (type: string, data: unknown) => {
          res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
          const result = await provisionClient(payload, (step, message, detail) => {
            sendEvent('progress', { step, message, detail });
          });

          // STEP 7: Build & deploy — sebelumnya TIDAK PERNAH ada di portal ini
          // padahal kartu sukses, surat serah terima, dan pesan WhatsApp semuanya
          // mengklaim website sudah online. (Audit business flow 2026-10-06, C2.)
          sendEvent('progress', {
            step: 6,
            message: 'Build & deploy website ke Cloudflare Worker...',
            detail: 'Proses build bisa memakan waktu beberapa menit.',
          });

          let deployed = false;
          let deployError = '';
          let websiteUrl = result.websiteUrl;
          try {
            const outcome = await deployClient({
              rootDir: ROOT_DIR,
              configPath: path.join(ROOT_DIR, result.archiveFolder, 'config.env'),
              dryRun: false,
              run: runCommandStreaming,
              onLog: (line) => sendEvent('log', { text: line }),
            });
            deployed = outcome.ok;
            if (!outcome.ok) {
              deployError = outcome.error || 'Build & deploy gagal.';
            } else if (outcome.websiteUrl) {
              websiteUrl = outcome.websiteUrl;
            }
          } catch (deployErr) {
            deployError = (deployErr as Error).message || 'Build & deploy gagal.';
          }

          // PK2 — kabar jujur ke pembeli HANYA setelah deploy benar-benar sukses.
          // Email "Pembayaran Terverifikasi" (tanpa link) sudah dikirim saat
          // aktivasi; email ini berisi URL live yang sebenarnya. Best-effort:
          // kegagalan email tidak mengubah status deploy.
          let onlineEmailNote = '';
          if (deployed) {
            try {
              const emailResult = await sendWebsiteOnlineEmail({ slug: payload.clientSlug, websiteUrl });
              onlineEmailNote = emailResult.reason;
              if (emailResult.sent) {
                sendEvent('progress', {
                  step: 7,
                  message: 'Email "Website Sudah Online" terkirim ke pembeli.',
                });
              }
            } catch (emailErr) {
              onlineEmailNote = `Email "Sudah Online" gagal: ${(emailErr as Error).message}`;
            }
          }

          sendEvent('progress', {
            step: 7,
            message: deployed ? 'Selesai! Website sudah online.' : 'Selesai — tetapi deploy gagal.',
          });
          sendEvent('complete', {
            ...result,
            websiteUrl,
            adminUrl: `${websiteUrl}/admin`,
            deployed,
            deployError,
            onlineEmailNote,
          });
        } catch (provisionErr) {
          sendEvent('error', { message: (provisionErr as Error).message });
        } finally {
          res.end();
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: (err as Error).message }));
      }
    });
    return;
  }

  // API: Saran slug dari orders (dropdown pemilihan slug di form provisioning)
  if (url === '/api/order-slugs' && req.method === 'GET') {
    (async () => {
      try {
        const slugs = await listOrderSlugs();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, slugs }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, slugs: [], message: (err as Error).message }));
      }
    })();
    return;
  }

  // API: List archived clients (tanpa password/token)
  if (url === '/api/clients' && req.method === 'GET') {
    try {
      sendJson(res, 200, {
        success: true,
        clients: listClientSummaries(ARCHIVE_DIR),
      });
    } catch (err) {
      sendJson(res, 500, { success: false, message: (err as Error).message });
    }
    return;
  }

  // API: Detail klien — infrastruktur non-rahasia + status kredensial.
  if (url === '/api/client-detail' && req.method === 'GET') {
    try {
      const folderName =
        new URL(req.url || '/', 'http://localhost').searchParams.get('folder') || '';

      if (!isSafeArchiveFolderName(folderName)) {
        sendJson(res, 400, { success: false, message: 'Nama folder klien tidak valid.' });
        return;
      }

      const client = readClientDetail(ARCHIVE_DIR, folderName);
      if (!client) {
        sendJson(res, 404, { success: false, message: 'Arsip klien tidak ditemukan.' });
        return;
      }

      sendJson(res, 200, {
        success: true,
        client,
        vaultConfigured: isVaultConfigured(ENV_LOCAL_PATH),
      });
    } catch (err) {
      sendJson(res, 500, { success: false, message: (err as Error).message });
    }
    return;
  }

  // API: Rahasia klien — HANYA setelah brankas dibuka (cookie sesi pendek).
  if (url === '/api/client-secrets' && req.method === 'GET') {
    try {
      const folderName =
        new URL(req.url || '/', 'http://localhost').searchParams.get('folder') || '';

      if (!isSafeArchiveFolderName(folderName)) {
        sendJson(res, 400, { success: false, message: 'Nama folder klien tidak valid.' });
        return;
      }

      const token = getCookie(req.headers.cookie, VAULT_COOKIE_NAME);
      if (!vaultSessions.verify(token)) {
        sendJson(res, 401, {
          success: false,
          code: 'VAULT_LOCKED',
          message: 'Brankas terkunci. Masukkan kata sandi brankas.',
        });
        return;
      }

      const secrets = readClientSecrets(ARCHIVE_DIR, folderName);
      if (!secrets) {
        sendJson(res, 404, { success: false, message: 'Arsip klien tidak ditemukan.' });
        return;
      }

      sendJson(res, 200, { success: true, secrets });
    } catch (err) {
      sendJson(res, 500, { success: false, message: (err as Error).message });
    }
    return;
  }

  // API: Buat kata sandi brankas (sekali saja; tidak menyimpan password asli).
  if (url === '/api/vault/setup' && req.method === 'POST') {
    if (req.headers['x-portal-request'] !== '1') {
      sendJson(res, 400, { success: false, message: 'Permintaan portal tidak valid.' });
      return;
    }

    try {
      if (isVaultConfigured(ENV_LOCAL_PATH)) {
        sendJson(res, 409, {
          success: false,
          code: 'VAULT_ALREADY_CONFIGURED',
          message: 'Brankas sudah dibuat. Masukkan kata sandi brankas untuk membukanya.',
        });
        return;
      }

      const body = await readJsonBody(req);
      const password = typeof body.password === 'string' ? body.password : '';
      const confirm = typeof body.confirm === 'string' ? body.confirm : '';
      const policyError = validateNewVaultPassword(password);
      if (policyError) {
        sendJson(res, 400, { success: false, message: policyError });
        return;
      }
      if (password !== confirm) {
        sendJson(res, 400, { success: false, message: 'Ulangan kata sandi tidak sama.' });
        return;
      }

      createVaultPassword(ENV_LOCAL_PATH, password);
      const token = vaultSessions.create();
      setVaultCookie(res, token);
      sendJson(res, 200, {
        success: true,
        unlocked: true,
        expiresInSeconds: VAULT_COOKIE_MAX_AGE_SECONDS,
        message: 'Brankas dibuat. Kredensial dibuka selama 30 detik.',
      });
    } catch (err) {
      sendJson(res, 500, {
        success: false,
        message: `Gagal membuat brankas: ${(err as Error).message}`,
      });
    }
    return;
  }

  // API: Buka brankas (rate-limit 5 gagal → kunci 5 menit).
  if (url === '/api/vault/unlock' && req.method === 'POST') {
    if (req.headers['x-portal-request'] !== '1') {
      sendJson(res, 400, { success: false, message: 'Permintaan portal tidak valid.' });
      return;
    }

    try {
      const key = requestKey(req);
      const limit = vaultAttempts.check(key);
      if (!limit.allowed) {
        sendJson(
          res,
          429,
          {
            success: false,
            code: 'VAULT_LOCKED_OUT',
            message: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfterSeconds(limit.retryAfterMs)} detik.`,
            retryAfterSeconds: retryAfterSeconds(limit.retryAfterMs),
          },
          { 'Retry-After': String(retryAfterSeconds(limit.retryAfterMs)) }
        );
        return;
      }

      const body = await readJsonBody(req);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password || password.length > 1024) {
        sendJson(res, 400, { success: false, message: 'Kata sandi brankas wajib diisi.' });
        return;
      }

      const verification = verifyVaultPassword(ENV_LOCAL_PATH, password);
      if (!verification.configured) {
        sendJson(res, 400, {
          success: false,
          code: 'VAULT_NOT_CONFIGURED',
          message: 'Brankas belum dibuat. Buat kata sandi brankas terlebih dahulu.',
        });
        return;
      }

      if (!verification.valid) {
        const next = vaultAttempts.recordFailure(key);
        if (!next.allowed) {
          sendJson(
            res,
            429,
            {
              success: false,
              code: 'VAULT_LOCKED_OUT',
              message: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfterSeconds(next.retryAfterMs)} detik.`,
              retryAfterSeconds: retryAfterSeconds(next.retryAfterMs),
            },
            { 'Retry-After': String(retryAfterSeconds(next.retryAfterMs)) }
          );
          return;
        }
        sendJson(res, 401, {
          success: false,
          code: 'VAULT_INVALID',
          message: 'Kata sandi brankas salah.',
          attemptsLeft: next.attemptsLeft,
        });
        return;
      }

      vaultAttempts.reset(key);
      const token = vaultSessions.create();
      setVaultCookie(res, token);
      sendJson(res, 200, {
        success: true,
        unlocked: true,
        expiresInSeconds: VAULT_COOKIE_MAX_AGE_SECONDS,
        message: 'Brankas dibuka. Kredensial disembunyikan otomatis dalam 30 detik.',
      });
    } catch {
      sendJson(res, 400, { success: false, message: 'Permintaan tidak valid.' });
    }
    return;
  }

  // API: Tutup brankas + hapus token sesi.
  if (url === '/api/vault/lock' && req.method === 'POST') {
    if (req.headers['x-portal-request'] !== '1') {
      sendJson(res, 400, { success: false, message: 'Permintaan portal tidak valid.' });
      return;
    }

    const token = getCookie(req.headers.cookie, VAULT_COOKIE_NAME);
    vaultSessions.revoke(token);
    clearVaultCookie(res);
    sendJson(res, 200, { success: true, message: 'Brankas dikunci.' });
    return;
  }

  // API: Connect Custom Domain
  if (url === '/api/custom-domain' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const { folderName, customDomain } = JSON.parse(body);

        if (!folderName || !customDomain) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Pilih klien dan masukkan nama domain.' }));
          return;
        }

        let domain = customDomain.trim().toLowerCase();
        domain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

        // Validate domain format
        const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
        if (!domainRegex.test(domain)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Format domain tidak valid. Contoh yang benar: budipratama.com atau portofolio.budi.com' }));
          return;
        }

        const envPath = path.join(ARCHIVE_DIR, folderName, 'config.env');
        if (!fs.existsSync(envPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Berkas arsip klien tidak ditemukan di laptop.' }));
          return;
        }

        const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));
        const accountId = env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = env.CLOUDFLARE_API_TOKEN;
        const clientSlug = env.CUSTOMER_SLUG;
        const clientName = env.CUSTOMER_NAME || folderName;

        if (!accountId || !apiToken || !clientSlug) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Kredensial Cloudflare klien pada arsip tidak lengkap.' }));
          return;
        }

        // Sambungkan hostname ke Worker klien (API Workers Custom Domain).
        // Cloudflare membuat DNS record + sertifikat HTTPS otomatis.
        // Guard duplikat (audit MEDIUM M5, 2026-10-06): kalau hostname menempel di
        // Worker LAIN, attach DITOLAK (dulu diam-diam memindahkan domain); kalau sudah
        // menempel di worker ini → idempoten, tanpa PUT ulang.
        let attached: { hostname: string; service: string; zoneName: string };
        try {
          const guard = await guardWorkerDomainAttach(cfApi, {
            accountId,
            apiToken,
            hostname: domain,
            service: clientSlug,
          });
          attached =
            guard.alreadyAttached && guard.existing
              ? guard.existing
              : await attachWorkerDomain(cfApi, {
                  accountId,
                  apiToken,
                  hostname: domain,
                  service: clientSlug,
                });
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: (err as Error).message }));
          return;
        }

        // Update config.env
        let envRaw = fs.readFileSync(envPath, 'utf-8');
        if (envRaw.includes('CUSTOM_DOMAIN=')) {
          envRaw = envRaw.replace(/CUSTOM_DOMAIN=".*"/, `CUSTOM_DOMAIN="${domain}"`);
        } else {
          envRaw += `\nCUSTOM_DOMAIN="${domain}"\n`;
        }
        fs.writeFileSync(envPath, envRaw, 'utf-8');

        // Update SURAT_SERAH_TERIMA.txt if exists
        const suratPath = path.join(ARCHIVE_DIR, folderName, 'SURAT_SERAH_TERIMA.txt');
        if (fs.existsSync(suratPath)) {
          let suratRaw = fs.readFileSync(suratPath, 'utf-8');
          if (!suratRaw.includes('Custom Domain')) {
            suratRaw = suratRaw.replace(
              /• Alamat Website\s*:.*/,
              `• Alamat Website   : https://${domain} (bawaan: https://${clientSlug}.workers.dev)\n• Custom Domain    : ${domain}`
            );
            fs.writeFileSync(suratPath, suratRaw, 'utf-8');
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            domain,
            status: 'active',
            zoneName: attached.zoneName,
            service: attached.service,
            clientName,
            clientSlug,
            adminEmail: env.ADMIN_EMAIL || '',
            whatsappMessage: buildDomainHandoverMessage({ clientName, domain }),
            message: 'Custom domain tersambung ke Worker klien — DNS & HTTPS dibuat otomatis Cloudflare.',
          })
        );
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: (err as Error).message }));
      }
    });
    return;
  }

  // API: Check Custom Domain Status
  if (url === '/api/custom-domain/status' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const { folderName, customDomain } = JSON.parse(body);
        const envPath = path.join(ARCHIVE_DIR, folderName, 'config.env');
        if (!fs.existsSync(envPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Arsip tidak ditemukan.' }));
          return;
        }
        const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));
        const accountId = env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = env.CLOUDFLARE_API_TOKEN;
        const clientSlug = env.CUSTOMER_SLUG;
        const domain = (customDomain || env.CUSTOM_DOMAIN || '').trim().toLowerCase();

        if (!domain) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Klien belum memiliki custom domain.' }));
          return;
        }

        const found = await findWorkerDomain(cfApi, {
          accountId,
          apiToken,
          hostname: domain,
        });

        if (!found) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              status: 'not_found',
              message: `Domain ${domain} belum tersambung ke Worker ${clientSlug}.`,
            })
          );
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, status: 'active', zoneName: found.zoneName, service: found.service }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: (err as Error).message }));
      }
    });
    return;
  }

  // API: Get OpenNext Build Status
  if (url === '/api/build-status' && req.method === 'GET') {
    try {
      const openNextDir = path.join(ROOT_DIR, '.open-next');
      // R6 (audit 2026-10-26): mtime FOLDER `.open-next` berubah setiap kali isi
      // ditulis/hapus, bukan hanya saat build selesai, sehingga "terakhir dibangun"
      // bisa menyesatkan. Pakai berkas hasil build yang sebenarnya.
      const buildArtifacts = [
        path.join(openNextDir, 'worker.js'),
        path.join(openNextDir, 'cloudflare', 'worker.js'),
        path.join(openNextDir, 'cloudflare', 'next-env.mjs'),
      ];
      const existing = buildArtifacts.filter((p) => fs.existsSync(p));
      const hasBuild = existing.length > 0;
      let lastBuilt: string | null = null;
      if (hasBuild) {
        const newest = Math.max(...existing.map((p) => fs.statSync(p).mtimeMs));
        lastBuilt = new Date(newest).toLocaleString('id-ID');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hasBuild, lastBuilt }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: (err as Error).message }));
    }
    return;
  }

  // API: Get Latest Changelog & Release Notes
  if (url === '/api/changelog' && req.method === 'GET') {
    try {
      const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
      if (!fs.existsSync(changelogPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, version: '1.0.0', date: '', sections: [], whatsappMessage: '' }));
        return;
      }

      const content = fs.readFileSync(changelogPath, 'utf-8');
      
      // Parse all releases (splitting by '## [version]')
      const releaseBlocks = content.split(/\n(?=##\s*\[)/);
      const releases: Array<{
        version: string;
        date: string;
        sections: Array<{ title: string; items: string[] }>;
      }> = [];

      for (const block of releaseBlocks) {
        const headerMatch = block.match(/##\s*\[([^\]]+)\]\s*-\s*([^\r\n]+)/);
        if (!headerMatch) continue;

        const version = headerMatch[1].trim();
        const date = headerMatch[2].trim();

        const afterHeader = block.slice((headerMatch.index || 0) + headerMatch[0].length);
        const sections: Array<{ title: string; items: string[] }> = [];
        const lines = afterHeader.split(/\r?\n/);
        let currentSection: { title: string; items: string[] } | null = null;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('### ')) {
            currentSection = { title: trimmed.replace(/^###\s*/, ''), items: [] };
            sections.push(currentSection);
          } else if (trimmed.startsWith('- ') && currentSection) {
            const itemText = trimmed
              .replace(/^-\s*/, '')
              .replace(/\*\*([^*]+)\*\*:\s*/, '$1: ')
              .replace(/\*\*([^*]+)\*\*/, '$1')
              .trim();
            currentSection.items.push(itemText);
          }
        }

        releases.push({ version, date, sections });
      }

      const latestRelease = releases[0] || { version: '1.0.0', date: '', sections: [] };
      const version = latestRelease.version;
      const date = latestRelease.date;
      const sections = latestRelease.sections || [];

      // Klasifikasikan seksi dan butir pembaruan rilis terbaru
      const isSpatialSec = (t: string) => /spatial|spasial|gallery|galeri/i.test(t);
      const isCanvasSec = (t: string) => /canvas|kanvas/i.test(t) && !isSpatialSec(t);
      const isDesktopSec = (t: string) => /macos|desktop|mac os|🖥️/i.test(t);

      const spatialPoints: string[] = [];
      const canvasPoints: string[] = [];
      const desktopPoints: string[] = [];
      const systemPoints: string[] = [];
      const allPoints: string[] = [];

      for (const sec of sections) {
        for (const item of sec.items) {
          const shortItem = item.split(':')[0].trim();
          const point = `• ${shortItem}`;
          allPoints.push(point);

          if (isSpatialSec(sec.title)) {
            spatialPoints.push(point);
          } else if (isCanvasSec(sec.title)) {
            canvasPoints.push(point);
          } else if (isDesktopSec(sec.title)) {
            desktopPoints.push(point);
          } else {
            systemPoints.push(point);
          }
        }
      }

      // Helper pembuat pesan WhatsApp yang rapi dan personal
      const createWaMessage = (templateName: string, points: string[]) => {
        const list = points.length > 0 ? points.slice(0, 5).join('\n') : '• Pembaruan performa, keamanan sistem, dan stabilitas server.';
        return [
          `Halo Kak! 👋`,
          `Website portofolio Kakak${templateName ? ` (${templateName})` : ''} baru saja kami perbarui ke Versi ${version} (${date}):`,
          ``,
          `✨ Yang Baru di Pembaruan Ini:`,
          list,
          ``,
          `Seluruh data foto karya, biodata, dan akun admin Kakak tetap 100% aman dan terjaga. Selamat berkarya! 🚀`,
        ].join('\n');
      };

      // Gabungkan poin spesifik template dengan poin sistem global
      const waDesktopPoints = [...desktopPoints, ...systemPoints];
      const waCanvasPoints = [...canvasPoints, ...systemPoints];
      const waSpatialPoints = [...spatialPoints, ...systemPoints];

      const whatsappMessages = {
        'os-desktop': createWaMessage('macOS Desktop', waDesktopPoints),
        'infinite-canvas': createWaMessage('Infinite Canvas', waCanvasPoints),
        'spatial-gallery': createWaMessage('3D Spatial Gallery', waSpatialPoints),
        'general': createWaMessage('', allPoints),
      };

      const whatsappMessage = whatsappMessages.general;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        version, 
        date, 
        sections, 
        releases, 
        whatsappMessages,
        whatsappMessage 
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: (err as Error).message }));
    }
    return;
  }

  // API: Deploy / Update Client Template (Server-Sent Events for live streaming)
  if (url === '/api/deploy-client' && req.method === 'POST') {
    // KUNCI DEPLOY (audit 2026-10-26, temuan K2): build OpenNext menghapus dan
    // menulis ulang `.open-next` di folder yang sama. Dua deploy bersamaan akan
    // saling menimpa artefak, jadi permintaan kedua ditolak sebelum build.
    if (deployInProgress) {
      sendJson(res, 409, {
        success: false,
        message: 'Pembaruan lain sedang berjalan. Tunggu sampai selesai sebelum memulai lagi.',
      });
      return;
    }
    deployInProgress = true;

    let deployLockReleased = false;
    const releaseDeployLock = () => {
      if (deployLockReleased) return;
      deployLockReleased = true;
      deployInProgress = false;
    };

    try {
      const payload = await readJsonBody(req);
      // `forceBuild` tidak lagi dipakai: bundle dibangun ulang untuk tiap klien
      // karena env build-nya berbeda (lihat deployClient()).
      // `notifyOnline` = konteks retry deploy PERTAMA dari kartu sukses onboarding
      // (PK2) — batch update sengaja tidak mengirimnya.
      const notifyOnline = payload.notifyOnline === true;

      // Target SELALU berupa daftar folder eksplisit (temuan R1 + koreksi
      // rencana): `all: true` tidak lagi menghasilkan daftar dari readdir, jadi
      // filter di UI dan daftar di server tidak mungkin berbeda.
      const requested: unknown[] = Array.isArray(payload.folders)
        ? payload.folders
        : payload.folderName
          ? [payload.folderName]
          : [];

      if (requested.length === 0) {
        sendJson(res, 400, {
          success: false,
          message: 'Pilih salah satu klien atau pilih opsi update semua klien.',
        });
        return;
      }

      const invalid = requested.filter((f) => !isSafeArchiveFolderName(f));
      if (invalid.length > 0) {
        sendJson(res, 400, {
          success: false,
          message: 'Nama folder klien tidak valid.',
        });
        return;
      }

      if (!fs.existsSync(ARCHIVE_DIR)) {
        sendJson(res, 400, {
          success: false,
          message: 'Direktori arsip-klien/ belum ada di laptop.',
        });
        return;
      }

      const targets = partitionDeployTargets(
        listClientSummaries(ARCHIVE_DIR),
        requested as string[]
      );

      if (targets.deployable.length === 0) {
        sendJson(res, 400, {
          success: false,
          message:
            'Tidak ada klien yang siap diperbarui. ' +
            (targets.skipped.length > 0
              ? targets.skipped.map((s) => `${s.clientName}: ${s.reason}`).join(' ')
              : 'Daftarkan klien terlebih dahulu.'),
          skipped: targets.skipped,
        });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // K3: menulis ke koneksi yang sudah ditutup memicu EPIPE/unhandled error
      // yang bisa mematikan portal. Semua tulisan SSE lewat satu gerbang ini dan
      // tidak pernah melempar.
      let streamClosed = false;
      res.on('close', () => {
        streamClosed = true;
      });
      res.on('error', () => {
        streamClosed = true;
      });

      const sendEvent = (type: string, data: unknown) => {
        if (streamClosed || res.writableEnded || res.destroyed) return;
        try {
          res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
          streamClosed = true;
        }
      };

      const skipped = targets.skipped;
      if (skipped.length > 0) {
        sendEvent('skipped', skipped);
        for (const s of skipped) {
          sendEvent('log', { text: `↷ DILEWATI: ${s.clientName} — ${s.reason}` });
        }
      }

      const targetFolders = targets.deployable.map((c) => c.id);

      // STEP 1: Build + deploy per klien. Env tiap klien berbeda (D1/R2/secret
      // milik klien), jadi bundle harus dibangun ulang untuk tiap klien.
      sendEvent('progress', {
        stage: 'deploy',
        message: `Mulai build & deploy ${targetFolders.length} website klien...`,
        current: 0,
        total: targetFolders.length,
      });

      const results: Array<{
        clientName: string;
        clientSlug: string;
        success: boolean;
        error?: string;
        url?: string;
        emailNote?: string;
      }> = [];

      for (let i = 0; i < targetFolders.length; i++) {
        const folder = targetFolders[i];
        const envPath = path.join(ARCHIVE_DIR, folder, 'config.env');
        const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));

        const clientName = env.CUSTOMER_NAME || folder;
        const clientSlug = env.CUSTOMER_SLUG || folder;

        sendEvent('progress', {
          stage: 'deploying',
          message: `[${i + 1}/${targetFolders.length}] Build & deploy ke ${clientName}...`,
          current: i + 1,
          total: targetFolders.length,
        });

        sendEvent('log', {
          text: `\n------------------------------------------------------------\n>>> [${i + 1}/${targetFolders.length}] Build + deploy ke Cloudflare Worker: ${clientName} (${clientSlug})\n------------------------------------------------------------`,
        });

        const outcome = await deployClient({
          rootDir: ROOT_DIR,
          configPath: envPath,
          dryRun: false,
          run: runCommandStreaming,
          onLog: (line) => {
            sendEvent('log', { text: line });
          },
        });

        if (outcome.ok) {
          sendEvent('log', {
            text: `✓ BERHASIL! Website ${clientName} telah diperbarui ke versi template terbaru: ${outcome.websiteUrl}`,
          });

          // PK2 — retry deploy pertama dari kartu sukses onboarding:
          // kirim email "Website Sudah Online" (best-effort).
          let emailNote = '';
          if (notifyOnline === true) {
            try {
              const emailResult = await sendWebsiteOnlineEmail({
                slug: outcome.slug || clientSlug,
                websiteUrl: outcome.websiteUrl || `https://${clientSlug}.workers.dev`,
              });
              emailNote = emailResult.reason;
              sendEvent('log', {
                text: emailResult.sent ? `📧 ${emailResult.reason}` : `ℹ️ ${emailResult.reason}`,
              });
            } catch (emailErr) {
              emailNote = `Email "Sudah Online" gagal: ${(emailErr as Error).message}`;
              sendEvent('log', { text: `⚠️ ${emailNote}` });
            }
          }

          results.push({
            clientName,
            clientSlug: outcome.slug || clientSlug,
            success: true,
            url: outcome.websiteUrl,
            emailNote,
          });
        } else {
          const errDetail = outcome.error || 'Deploy gagal';
          sendEvent('log', { text: `✗ GAGAL deploy ke ${clientName}. ${errDetail}` });
          results.push({
            clientName,
            clientSlug: outcome.slug || clientSlug,
            success: false,
            error: errDetail,
          });
        }
      }

      sendEvent('progress', {
        stage: 'done',
        message: 'Semua proses pembaruan telah selesai!',
        current: targetFolders.length,
        total: targetFolders.length,
      });

      sendEvent('complete', {
        success: results.some((r) => r.success),
        results,
        skipped,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'TOO_LARGE') {
        sendJson(res, 413, { success: false, message: 'Permintaan terlalu besar.' });
      } else if (message === 'INVALID') {
        sendJson(res, 400, { success: false, message: 'Format permintaan tidak valid.' });
      } else if (!res.headersSent) {
        sendJson(res, 500, { success: false, message });
      } else if (!res.writableEnded && !res.destroyed) {
        try {
          res.end();
        } catch {
          /* koneksi sudah hilang */
        }
      }
    } finally {
      releaseDeployLock();
      if (!res.writableEnded && !res.destroyed) {
        try {
          res.end();
        } catch {
          /* koneksi sudah hilang */
        }
      }
    }
    return;
  }

  // API: Client Status Board (health-check + domain untuk semua klien arsip)
  if (url === '/api/status' && req.method === 'GET') {
    try {
      if (!fs.existsSync(ARCHIVE_DIR)) {
        const versions = readProjectVersions(ROOT_DIR);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            clients: [],
            latestVersion: versions.latestVersion,
            appVersion: versions.appVersion,
            changelogVersion: versions.changelogVersion,
          })
        );
        return;
      }

      const folders = fs
        .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));

      const clients = folders
        .filter((f) => fs.existsSync(path.join(ARCHIVE_DIR, f, 'config.env')))
        .map((folderName) => {
          const envPath = path.join(ARCHIVE_DIR, folderName, 'config.env');
          const env = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf-8')) : {};
          const urls = clientUrls(env, folderName);
          return {
            id: folderName,
            clientName: env.CUSTOMER_NAME || folderName,
            clientSlug: env.CUSTOMER_SLUG || folderName.replace(/^\d+_/, ''),
            websiteUrl: urls.websiteUrl,
            adminUrl: urls.adminUrl,
            customDomain: env.CUSTOM_DOMAIN || '',
            templateKey: env.ACTIVE_TEMPLATE_KEY || 'os-desktop',
            // Alamat pertama = yang tampil di UI; cadangan = workers.dev yang selalu
            // hidup selama Worker ada, supaya DNS yang belum menyebar tidak membuat
            // status "Offline" palsu (kejadian 2026-10-26).
            healthUrls: [urls.websiteUrl, workersDevUrl(env, folderName)].filter(Boolean),
          };
        });

      // Health-check paralel. Tiap klien punya batas 12 detik per alamat dan
      // otomatis mencoba workers.dev bila alamat utama gagal di tingkat jaringan.
      const checked = await Promise.all(
        clients.map(async ({ healthUrls, ...c }) => ({
          ...c,
          ...(await probeClientHealth(healthUrls)),
        }))
      );

      // Versi acuan = versi kode (APP_VERSION), bukan judul CHANGELOG (S5).
      const versions = readProjectVersions(ROOT_DIR);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          clients: checked,
          latestVersion: versions.latestVersion,
          appVersion: versions.appVersion,
          changelogVersion: versions.changelogVersion,
        })
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: (err as Error).message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Hanya loopback (127.0.0.1) — lihat penjagaan akses di atas: portal ini
// memuat kredensial klien dan tidak boleh terbuka ke jaringan lokal.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Asisten Onboarding Klien Berjalan di: http://localhost:${PORT}`);
  console.log(`   Silakan buka browser Anda di http://localhost:${PORT}`);
  console.log(`   (Hanya bisa diakses dari laptop ini — bukan dari jaringan lokal)`);
  console.log(`======================================================\n`);
});


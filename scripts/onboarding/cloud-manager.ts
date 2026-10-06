/**
 * Cloud Manager CLI & Automation Engine
 * 
 * Script ini digunakan oleh GitHub Actions (dan terminal lokal) untuk menjalankan
 * seluruh operasional Master dari mana saja (termasuk via aplikasi HP GitHub Mobile):
 * 1. Onboarding Klien Baru (Provision D1, R2, Schema, Seed, Build, Deploy ke Cloudflare Pages)
 * 2. Update Versi Template ke Website Klien (Batch atau Single Client)
 * 3. Pemasangan Custom Domain ke Cloudflare Pages
 *
 * @module
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { SHARED_SCHEMA_QUERIES } from '../../src/crud/shared/db/schema';
import { hashPasswordScrypt } from '../../src/crud/shared/auth/password';
import { deployClient, resolveWorkersSubdomain } from './client-deploy';
import {
  attachWorkerDomain,
  buildDomainHandoverMessage,
  normalizeDomain,
  guardWorkerDomainAttach,
  detachWorkerDomain,
  findWorkerDomain,
} from './custom-domain';
import {
  findArchiveForSlug,
  createArchiveDir,
  pickD1Rows,
  resolveProvisionedAdminPassword,
} from './onboard-reuse';

const ROOT_DIR = process.cwd();
const ARCHIVE_DIR = path.join(ROOT_DIR, 'arsip-klien');

if (!fs.existsSync(ARCHIVE_DIR)) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

// Helper: Stream child_process stdout/stderr
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

// Cloudflare API Client
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

// Generate folder arsip bernomor (01_slug, 02_slug, ...) — kini ada di
// ./onboard-reuse (createArchiveDir) supaya portal & CLI memakai kebijakan yang sama.

// Helper: Parse .env simple
function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

// Append to GitHub Actions Job Summary if running in CI
function appendToGitHubSummary(markdown: string) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n\n', 'utf-8');
    } catch (err) {
      console.warn('Failed to append to GITHUB_STEP_SUMMARY:', err);
    }
  }
}

// Parse command-line args or environment variables
function getParam(flag: string, envName: string, defaultValue = ''): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1].trim();
  }
  return (process.env[envName] || defaultValue).trim();
}

// =========================================================================
// ACTION 1: ONBOARD NEW CLIENT (PROVISION + BUILD + DEPLOY)
// =========================================================================
async function handleOnboard() {
  console.log('\n========================================================');
  console.log('🚀 [CLOUD MASTER] MEMULAI ONBOARDING KLIEN BARU');
  console.log('========================================================\n');

  const clientName = getParam('--name', 'CLIENT_NAME');
  let clientSlug = getParam('--slug', 'CLIENT_SLUG');
  const templateKey = (getParam('--template', 'TEMPLATE_KEY', 'os-desktop') as 'os-desktop' | 'infinite-canvas');
  const adminEmail = getParam('--email', 'ADMIN_EMAIL');
  const accountId = getParam('--account-id', 'CLOUDFLARE_ACCOUNT_ID');
  const apiToken = getParam('--api-token', 'CLOUDFLARE_API_TOKEN');
  let adminPassword = getParam('--password', 'ADMIN_PASSWORD');

  if (!clientName || !adminEmail || !accountId || !apiToken) {
    throw new Error(
      'Parameter tidak lengkap! Wajib mengisi: Nama Klien, Email Klien, Cloudflare Account ID, dan Cloudflare API Token ' +
        '(isi langsung di kolom input workflow — tidak ada token bawaan/DEFAULT lagi, sengaja demi keamanan).'
    );
  }

  if (!clientSlug) {
    clientSlug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  clientSlug = clientSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');

  // Password admin BELUM diputuskan di sini: kalau re-provision slug lama, password
  // lama dipertahankan (lihat resolveProvisionedAdminPassword — audit MEDIUM M4).

  const siteId = clientSlug;
  const dbName = `db-${clientSlug}`;
  const r2BucketName = `media-${clientSlug}`;

  console.log(`👤 Klien: ${clientName} (${clientSlug})`);
  console.log(`🎨 Template: ${templateKey}`);
  console.log(`📧 Email: ${adminEmail}`);
  // Password sengaja TIDAK dicetak ke log (log job tersimpan lama di GitHub).
  // Password tersedia di Job Summary, file SURAT_SERAH_TERIMA.txt, dan config.env.
  console.log(`🔐 Password Admin: (lihat ringkasan job di bawah / file SURAT_SERAH_TERIMA.txt)`);
  console.log(`☁️ Cloudflare Account ID: ${accountId.slice(0, 6)}...${accountId.slice(-4)}`);

  // 1. Verifikasi Kredensial
  console.log('\n[1/7] Memverifikasi Kredensial Cloudflare API...');
  const verifyTokenRes = await cfApi('/user/tokens/verify', apiToken);
  if (!verifyTokenRes.ok) {
    throw new Error(`Cloudflare API Token tidak valid atau ditolak: ${verifyTokenRes.data?.errors?.[0]?.message || 'Akses ditolak'}`);
  }
  const verifyAccountRes = await cfApi(`/accounts/${accountId}`, apiToken);
  if (!verifyAccountRes.ok) {
    throw new Error(`Cloudflare Account ID salah atau tidak cocok dengan token.`);
  }
  console.log('✓ Kredensial Cloudflare terverifikasi.');

  // 2. Buat D1 Database
  console.log(`\n[2/7] Menyiapkan Database D1 (${dbName})...`);
  let databaseId = '';
  const createDbRes = await cfApi(`/accounts/${accountId}/d1/database`, apiToken, {
    method: 'POST',
    body: JSON.stringify({ name: dbName }),
  });
  if (createDbRes.ok && createDbRes.data.result) {
    databaseId = (createDbRes.data.result as { uuid: string }).uuid;
    console.log(`✓ Database D1 berhasil dibuat (ID: ${databaseId}).`);
  } else {
    // Cek database eksis
    const listDbRes = await cfApi(`/accounts/${accountId}/d1/database?name=${dbName}`, apiToken);
    if (listDbRes.ok && Array.isArray(listDbRes.data.result) && listDbRes.data.result[0]) {
      databaseId = (listDbRes.data.result[0] as { uuid: string }).uuid;
      console.log(`✓ Database D1 sudah ada, menggunakan instance ID: ${databaseId}.`);
    } else {
      throw new Error(`Gagal membuat Database D1: ${createDbRes.data?.errors?.[0]?.message || 'Kesalahan API D1'}`);
    }
  }

  // 3. Buat R2 Bucket
  console.log(`\n[3/7] Menyiapkan Bucket Media R2 (${r2BucketName})...`);
  const createR2Res = await cfApi(`/accounts/${accountId}/r2/buckets/${r2BucketName}`, apiToken, {
    method: 'PUT',
  });
  if (createR2Res.ok) {
    console.log(`✓ Bucket R2 ${r2BucketName} berhasil dibuat.`);
  } else if (createR2Res.status === 409) {
    console.log(`✓ Bucket R2 ${r2BucketName} sudah tersedia.`);
  } else {
    console.warn('⚠️ Peringatan R2:', createR2Res.data?.errors);
  }

  // 4. Migrasi Skema Tabel
  console.log(`\n[4/7] Memasang Tabel Database D1 (${SHARED_SCHEMA_QUERIES.length} query)...`);
  for (const sql of SHARED_SCHEMA_QUERIES) {
    await cfApi(`/accounts/${accountId}/d1/database/${databaseId}/query`, apiToken, {
      method: 'POST',
      body: JSON.stringify({ sql }),
    });
  }

  // Seed site
  const seedSiteSql = `
    INSERT INTO sites (id, slug, name, status, active_template_key, created_at, updated_at)
    VALUES ('${siteId}', '${clientSlug}', '${clientName.replace(/'/g, "''")}', 'active', '${templateKey}', datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      active_template_key = excluded.active_template_key,
      updated_at = datetime('now');
  `;
  await cfApi(`/accounts/${accountId}/d1/database/${databaseId}/query`, apiToken, {
    method: 'POST',
    body: JSON.stringify({ sql: seedSiteSql }),
  });

  // --- Penjagaan re-provision (audit MEDIUM M4, 2026-10-06) -----------------
  // Kalau slug ini sudah pernah onboarding: pakai arsip lama + password lama,
  // jangan rotasi diam-diam dan jangan gandakan folder arsip.
  const existingArchive = findArchiveForSlug(ARCHIVE_DIR, clientSlug);
  let adminExists = false;
  if (!adminPassword) {
    const adminCheckRes = await cfApi(`/accounts/${accountId}/d1/database/${databaseId}/query`, apiToken, {
      method: 'POST',
      body: JSON.stringify({
        sql: `SELECT id FROM site_users WHERE site_id = '${siteId}' AND email = '${adminEmail.toLowerCase()}' LIMIT 1;`,
      }),
    });
    if (!adminCheckRes.ok) {
      // Gagal memeriksa = tidak boleh menebak: rotasi diam-diam lebih berbahaya daripada error.
      throw new Error(
        `Gagal memeriksa apakah admin sudah ada: ${adminCheckRes.data?.errors?.[0]?.message || 'query D1 gagal'}`
      );
    }
    adminExists = pickD1Rows(adminCheckRes.data).length > 0;
  }
  const adminDecision = resolveProvisionedAdminPassword({
    explicitPassword: adminPassword,
    adminExists,
    archivePassword: existingArchive?.env.ADMIN_PASSWORD,
    generateFallback: () => `Porto${crypto.randomBytes(3).toString('hex')}!`,
  });
  adminPassword = adminDecision.effectivePassword;

  // Seed user (hanya kalau password memang harus ditulis: baru/rotasi eksplisit)
  if (adminDecision.seedUser) {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPasswordScrypt(adminPassword, salt);
    const userId = `user-${crypto.randomUUID()}`;
    const seedUserSql = `
      INSERT INTO site_users (id, site_id, email, password_hash, password_salt, password_algorithm, role, created_at)
      VALUES ('${userId}', '${siteId}', '${adminEmail.toLowerCase()}', '${passwordHash}', '${salt}', 'scrypt', 'admin', datetime('now'))
      ON CONFLICT(site_id, email) DO UPDATE SET
        password_hash = excluded.password_hash,
        password_salt = excluded.password_salt;
    `;
    await cfApi(`/accounts/${accountId}/d1/database/${databaseId}/query`, apiToken, {
      method: 'POST',
      body: JSON.stringify({ sql: seedUserSql }),
    });
    console.log('✓ Skema database dan akun admin klien berhasil dipasang.');
  } else {
    console.log('✓ Admin sudah ada — password lama dipertahankan (tidak dirotasi).');
  }

  // 5. Arsipkan Kredensial
  console.log('\n[5/7] Menyimpan Data Klien ke Arsip...');
  // Re-provision: tulis ulang ke folder arsip YANG SAMA (arsip lama dipakai ulang,
  // tidak membuat 02_slug / 03_slug ganda).
  const { dirPath, folderName } = existingArchive ?? createArchiveDir(ARCHIVE_DIR, clientSlug);

  // URL publik memakai Cloudflare Worker (Opsi B), bukan Pages.
  // Re-provision: WEBSITE_URL/ADMIN_URL lama menang (mis. sudah custom domain).
  const subdomain = await resolveWorkersSubdomain(accountId, apiToken);
  const defaultWebsiteUrl = `https://${clientSlug}.${subdomain ? `${subdomain}.` : ''}workers.dev`;
  let websiteUrl = existingArchive?.env.WEBSITE_URL || defaultWebsiteUrl;
  let adminUrl = existingArchive?.env.ADMIN_URL || `${websiteUrl}/admin`;

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
    `Template Dipilih  : ${templateKey === 'os-desktop' ? 'macOS Desktop OS Simulator' : 'Infinite Canvas (Interactive Gallery)'}`,
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
  console.log(`✓ Arsip tersimpan di: arsip-klien/${folderName}`);

  // 6-7. Build dengan env klien lalu deploy ke Cloudflare Worker klien
  console.log(
    `\n[6/7] Build template dengan env klien + deploy ke Cloudflare Worker (${clientSlug})...`
  );
  const outcome = await deployClient({
    rootDir: ROOT_DIR,
    configPath: path.join(dirPath, 'config.env'),
    dryRun: false,
    run: runCommandStreaming,
    onLog: (line) => console.log(`   [deploy] ${line}`),
  });

  if (!outcome.ok) {
    throw new Error(
      `Deploy ke ${clientSlug} gagal: ${outcome.error || 'kesalahan tidak diketahui'}`
    );
  }

  // Deploy bisa memperbarui WEBSITE_URL (subdomain workers.dev terbaca).
  websiteUrl = outcome.websiteUrl || websiteUrl;
  adminUrl = `${websiteUrl}/admin`;

  console.log('\n========================================================');
  console.log('🎉 WEBSITE KLIEN BERHASIL AKTIF & LIVE!');
  console.log('========================================================');
  console.log(`🌐 Website URL : ${websiteUrl}`);
  console.log(`🔐 Admin URL   : ${adminUrl}`);
  console.log(`📧 Email       : ${adminEmail}`);
  // Password tidak dicetak ke log — ada di Job Summary & arsip klien.
  console.log(`🔑 Password    : (lihat ringkasan job di bawah / file SURAT_SERAH_TERIMA.txt)`);
  console.log('========================================================\n');

  // Format WhatsApp message
  const whatsappMsg = [
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
  ].join('\n');

  // Generate GitHub Job Summary Markdown for Mobile Browser
  const summaryMarkdown = `
# 🚀 Website Klien Berhasil Disiapkan & Live!

| Informasi | Rincian |
|---|---|
| **Nama Klien** | **${clientName}** |
| **Gaya Template** | \`${templateKey}\` |
| **Alamat Website** | [${websiteUrl}](${websiteUrl}) |
| **Ruang Admin** | [${adminUrl}](${adminUrl}) |
| **Email Login** | \`${adminEmail}\` |
| **Password Admin** | \`${adminPassword}\` |
| **Database D1** | \`${dbName}\` (\`${databaseId}\`) |
| **Storage R2** | \`${r2BucketName}\` |
| **Lokasi Arsip** | \`arsip-klien/${folderName}\` |

---

### 📋 Format Pesan WhatsApp (Siap Copy & Kirim ke Klien dari HP):

\`\`\`text
${whatsappMsg}
\`\`\`
`;
  appendToGitHubSummary(summaryMarkdown);
}

// =========================================================================
// ACTION 2: UPDATE TEMPLATE TO CLIENT(S)
// =========================================================================

/** Cari path config.env di arsip-klien berdasarkan slug atau nama folder. */
function findConfigEnv(slugOrFolder: string): string | null {
  if (!fs.existsSync(ARCHIVE_DIR)) return null;
  const folders = fs
    .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const folder of folders) {
    const envPath = path.join(ARCHIVE_DIR, folder, 'config.env');
    if (!fs.existsSync(envPath)) continue;
    const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));
    if (env.CUSTOMER_SLUG === slugOrFolder || folder === slugOrFolder) return envPath;
  }
  return null;
}

async function handleUpdate() {
  console.log('\n========================================================');
  console.log('🔄 [CLOUD MASTER] MEMULAI UPDATE VERSI TEMPLATE');
  console.log('========================================================\n');

  const target = getParam('--target', 'UPDATE_TARGET', 'all');
  const specificSlug = getParam('--slug', 'CLIENT_SLUG');

  // Build tidak lagi dipakai bersama: tiap klien dibangun ulang dengan env
  // miliknya sendiri (lihat deployClient).
  console.log('[1/2] Menyiapkan daftar klien target...');
  const targets: Array<{ name: string; slug: string; configPath: string }> = [];

  if (specificSlug) {
    const configPath = findConfigEnv(specificSlug);
    if (!configPath) {
      throw new Error(
        `config.env untuk slug "${specificSlug}" tidak ditemukan di arsip-klien/. Deploy per klien membutuhkan config.env (D1, R2, & secret klien).`
      );
    }
    targets.push({
      name: getParam('--name', 'CLIENT_NAME', specificSlug),
      slug: specificSlug,
      configPath,
    });
  } else if (fs.existsSync(ARCHIVE_DIR)) {
    const folders = fs
      .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const folder of folders) {
      const envPath = path.join(ARCHIVE_DIR, folder, 'config.env');
      if (fs.existsSync(envPath)) {
        const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));
        if (env.CUSTOMER_SLUG && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
          if (target === 'all' || env.CUSTOMER_SLUG === specificSlug || folder === specificSlug) {
            targets.push({
              name: env.CUSTOMER_NAME || env.CUSTOMER_SLUG,
              slug: env.CUSTOMER_SLUG,
              configPath: envPath,
            });
          }
        }
      }
    }
  }

  if (targets.length === 0) {
    throw new Error('Tidak ada klien target yang ditemukan untuk di-update. Periksa parameter atau folder arsip-klien/.');
  }

  const results: Array<{ name: string; slug: string; success: boolean; url: string; error?: string }> = [];

  console.log(`\n[2/2] Build + deploy pembaruan ke ${targets.length} klien...`);

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`\n>>> [${i + 1}/${targets.length}] Build + deploy ke: ${t.name} (${t.slug})...`);

    const outcome = await deployClient({
      rootDir: ROOT_DIR,
      configPath: t.configPath,
      dryRun: false,
      run: runCommandStreaming,
      onLog: (line) => console.log(`   [deploy] ${line}`),
    });

    const url = outcome.websiteUrl || `https://${t.slug}.workers.dev`;
    if (outcome.ok) {
      console.log(`✓ BERHASIL: ${t.name} telah diupdate ke template terbaru (${url}).`);
      results.push({ name: t.name, slug: t.slug, success: true, url });
    } else {
      console.log(`✗ GAGAL: Deploy ke ${t.name} gagal — ${outcome.error || 'kesalahan tidak diketahui'}.`);
      results.push({
        name: t.name,
        slug: t.slug,
        success: false,
        url,
        error: outcome.error || 'kesalahan tidak diketahui',
      });
    }
  }

  const summaryMarkdown = `
# 🔄 Hasil Pembaruan Versi Template ke Website Klien

| Nama Klien | Slug | Status | Alamat Website |
|---|---|---|---|
${results.map((r) => `| **${r.name}** | \`${r.slug}\` | ${r.success ? '✅ Berhasil' : '❌ Gagal'} | [${r.url}](${r.url}) |`).join('\n')}

---
*Catatan: Seluruh data proyek, foto/video di R2, database D1, dan akun login klien tetap 100% aman dan tidak terhapus.*
`;
  appendToGitHubSummary(summaryMarkdown);
}

/** Isi kredensial klien dari arsip kalau tidak diberikan via flag. */
function lookupClientCredentials(
  clientSlug: string,
  accountId: string,
  apiToken: string,
  clientName: string
): { accountId: string; apiToken: string; clientName: string } {
  if ((!accountId || !apiToken) && fs.existsSync(ARCHIVE_DIR)) {
    const folders = fs.readdirSync(ARCHIVE_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const f of folders) {
      const envPath = path.join(ARCHIVE_DIR, f, 'config.env');
      if (fs.existsSync(envPath)) {
        const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));
        if (env.CUSTOMER_SLUG === clientSlug || f.includes(clientSlug)) {
          accountId = accountId || env.CLOUDFLARE_ACCOUNT_ID;
          apiToken = apiToken || env.CLOUDFLARE_API_TOKEN;
          clientName = env.CUSTOMER_NAME || clientName;
          break;
        }
      }
    }
  }
  return { accountId, apiToken, clientName };
}

// =========================================================================
// ACTION 3: CONNECT CUSTOM DOMAIN
// =========================================================================
async function handleCustomDomain() {
  console.log('\n========================================================');
  console.log('🌐 [CLOUD MASTER] MENGHUBUNGKAN CUSTOM DOMAIN');
  console.log('========================================================\n');

  const clientSlug = getParam('--slug', 'CLIENT_SLUG');
  let domain = getParam('--domain', 'CUSTOM_DOMAIN');
  let accountId = getParam('--account-id', 'CLOUDFLARE_ACCOUNT_ID');
  let apiToken = getParam('--api-token', 'CLOUDFLARE_API_TOKEN');

  if (!clientSlug || !domain) {
    throw new Error('Slug Klien dan Nama Domain wajib disertakan.');
  }

  domain = normalizeDomain(domain);
  let clientName = clientSlug;

  // Look up credentials from archive if missing
  ({ accountId, apiToken, clientName } = lookupClientCredentials(clientSlug, accountId, apiToken, clientName));

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Account ID dan API Token wajib disediakan untuk mendaftarkan domain.');
  }

  console.log(`🔗 Menghubungkan domain: ${domain} -> Worker: ${clientSlug}`);

  // Guard duplikat (audit MEDIUM M5, 2026-10-06): cek dulu apakah hostname sudah
  // terpasang. Kalau menempel di Worker LAIN, attach akan DITOLAK (dulu diam-diam
  // memindahkan domain). Kalau sudah menempel di worker ini → idempoten, tanpa PUT.
  const guard = await guardWorkerDomainAttach(cfApi, {
    accountId,
    apiToken,
    hostname: domain,
    service: clientSlug,
  });

  let attached: { hostname: string; service: string; zoneName: string };
  if (guard.alreadyAttached && guard.existing) {
    attached = guard.existing;
    console.log(`✓ Domain sudah tersambung ke Worker "${clientSlug}" — tidak ada perubahan (idempoten).`);
  } else {
    attached = await attachWorkerDomain(cfApi, {
      accountId,
      apiToken,
      hostname: domain,
      service: clientSlug,
    });
    console.log('✓ Domain berhasil disambungkan ke Worker klien.');
    console.log(`Zone       : ${attached.zoneName}`);
    console.log('DNS Record : dibuat otomatis oleh Cloudflare (tanpa CNAME manual)');
  }

  const whatsappMsg = buildDomainHandoverMessage({ clientName, domain });

  const summaryMarkdown = `
# 🌐 Custom Domain Berhasil Didaftarkan!

| Informasi | Rincian |
|---|---|
| **Domain Baru** | **https://${domain}** |
| **Worker Tujuan** | \`${attached.service}\` |
| **Zone Cloudflare** | \`${attached.zoneName}\` |
| **DNS Record** | Dibuat otomatis oleh Cloudflare — tanpa CNAME manual |

---

### 📋 Format Pesan WhatsApp untuk Klien:

\`\`\`text
${whatsappMsg}
\`\`\`
`;
  appendToGitHubSummary(summaryMarkdown);
}

// =========================================================================
// ACTION 3b: DETACH CUSTOM DOMAIN (audit MEDIUM M5 — jalur "lepas")
// =========================================================================
async function handleDetachDomain() {
  console.log('\n========================================================');
  console.log('✂️ [CLOUD MASTER] MELEPAS CUSTOM DOMAIN DARI WORKER');
  console.log('========================================================\n');

  const clientSlug = getParam('--slug', 'CLIENT_SLUG');
  let domain = getParam('--domain', 'CUSTOM_DOMAIN');
  let accountId = getParam('--account-id', 'CLOUDFLARE_ACCOUNT_ID');
  let apiToken = getParam('--api-token', 'CLOUDFLARE_API_TOKEN');

  if (!clientSlug || !domain) {
    throw new Error('Slug Klien dan Nama Domain wajib disertakan.');
  }
  domain = normalizeDomain(domain);

  ({ accountId, apiToken } = lookupClientCredentials(clientSlug, accountId, apiToken, clientSlug));
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Account ID dan API Token wajib disediakan untuk melepas domain.');
  }

  const existing = await findWorkerDomain(cfApi, { accountId, apiToken, hostname: domain });
  if (!existing) {
    throw new Error(`Domain "${domain}" tidak terpasang di Worker mana pun di akun ini — tidak ada yang perlu dilepas.`);
  }
  if (!existing.id) {
    throw new Error(
      `Domain "${domain}" ditemukan tetapi ID-nya tidak dikembalikan API Cloudflare. ` +
        `Lepas manual via dashboard Cloudflare (Workers → Custom Domains).`
    );
  }

  await detachWorkerDomain(cfApi, { accountId, apiToken, domainId: existing.id });
  console.log(`✓ Domain "${domain}" dilepas dari Worker "${existing.service}".`);

  // Bersihkan catatan CUSTOM_DOMAIN di arsip config.env (kalau milik domain ini).
  const archive = findArchiveForSlug(ARCHIVE_DIR, clientSlug);
  if (archive) {
    const envPath = path.join(archive.dirPath, 'config.env');
    const raw = fs.readFileSync(envPath, 'utf-8');
    const before = raw.split(/\r?\n/);
    const after = before.filter((line) => !line.trim().startsWith(`CUSTOM_DOMAIN="${domain}"`));
    if (after.length < before.length) {
      fs.writeFileSync(envPath, after.join('\n'), 'utf-8');
      console.log(`✓ Catatan CUSTOM_DOMAIN dihapus dari arsip/${archive.folderName}/config.env`);
    }
  }

  console.log('\nCatatan: URL workers.dev klien tetap berfungsi; zona DNS domain tidak dihapus.');
  appendToGitHubSummary(
    `### ✂️ Domain Dilepas\n- Hostname: \`${domain}\` (dari Worker \`${existing.service}\`)\n`
  );
}

// =========================================================================
// ENTRY POINT
// =========================================================================
async function main() {
  const action = getParam('--action', 'ACTION_TYPE', 'onboard_client');

  try {
    switch (action) {
      case 'onboard':
      case 'onboard_client':
        await handleOnboard();
        break;
      case 'update':
      case 'update_template':
        await handleUpdate();
        break;
      case 'domain':
      case 'custom_domain':
        await handleCustomDomain();
        break;
      case 'detach_domain':
      case 'disconnect_domain':
        await handleDetachDomain();
        break;
      default:
        console.error(`Aksi tidak dikenali: "${action}". Gunakan "onboard_client", "update_template", "custom_domain", atau "detach_domain".`);
        process.exitCode = 1;
        return;
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error('\n❌ [ERROR]:', errMsg);
    appendToGitHubSummary(`\n### ❌ Gagal Menjalankan Aksi: ${action}\n> **Error:** ${errMsg}\n`);
    process.exitCode = 1;
  }
}

main();

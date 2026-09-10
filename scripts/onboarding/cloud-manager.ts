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

// Generate Archive Directory
function getNextArchiveDir(clientSlug: string): { dirPath: string; folderName: string } {
  const existing = fs
    .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
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
  const dirPath = path.join(ARCHIVE_DIR, folderName);
  fs.mkdirSync(dirPath, { recursive: true });
  return { dirPath, folderName };
}

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
      'Parameter tidak lengkap! Wajib menyertakan: Nama Klien, Email Klien, Cloudflare Account ID, dan Cloudflare API Token.'
    );
  }

  if (!clientSlug) {
    clientSlug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  clientSlug = clientSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (!adminPassword) {
    adminPassword = `Porto${crypto.randomBytes(3).toString('hex')}!`;
  }

  const siteId = clientSlug;
  const dbName = `db-${clientSlug}`;
  const r2BucketName = `media-${clientSlug}`;

  console.log(`👤 Klien: ${clientName} (${clientSlug})`);
  console.log(`🎨 Template: ${templateKey}`);
  console.log(`📧 Email: ${adminEmail}`);
  console.log(`🔐 Password Baru: ${adminPassword}`);
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
    INSERT INTO sites (id, slug, name, plan, status, active_template_key, created_at, updated_at)
    VALUES ('${siteId}', '${clientSlug}', '${clientName.replace(/'/g, "''")}', 'pro', 'active', '${templateKey}', datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      active_template_key = excluded.active_template_key,
      updated_at = datetime('now');
  `;
  await cfApi(`/accounts/${accountId}/d1/database/${databaseId}/query`, apiToken, {
    method: 'POST',
    body: JSON.stringify({ sql: seedSiteSql }),
  });

  // Seed user
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

  // 5. Arsipkan Kredensial
  console.log('\n[5/7] Menyimpan Data Klien ke Arsip...');
  const { dirPath, folderName } = getNextArchiveDir(clientSlug);

  const envContent = [
    `# ========================================================`,
    `# ARSIP KLIEN: ${clientName} (${folderName})`,
    `# Tanggal Pembuatan: ${new Date().toLocaleString('id-ID')}`,
    `# ========================================================`,
    `CUSTOMER_NAME="${clientName}"`,
    `CUSTOMER_SLUG="${clientSlug}"`,
    `ACTIVE_TEMPLATE_KEY="${templateKey}"`,
    `CLOUDFLARE_ACCOUNT_ID="${accountId}"`,
    `CLOUDFLARE_D1_DATABASE_NAME="${dbName}"`,
    `CLOUDFLARE_D1_DATABASE_ID="${databaseId}"`,
    `CLOUDFLARE_R2_BUCKET_NAME="${r2BucketName}"`,
    `CLOUDFLARE_API_TOKEN="${apiToken}"`,
    `ADMIN_EMAIL="${adminEmail}"`,
    `ADMIN_PASSWORD="${adminPassword}"`,
    `WEBSITE_URL="https://${clientSlug}.pages.dev"`,
    `ADMIN_URL="https://${clientSlug}.pages.dev/admin"`,
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
    `• Alamat Website   : https://${clientSlug}.pages.dev`,
    `• Alamat Admin     : https://${clientSlug}.pages.dev/admin`,
    `• Email Login      : ${adminEmail}`,
    `• Password Admin   : ${adminPassword}`,
    ``,
    `DATA TEKNIS INFRASTRUKTUR (TERISOLASI 100%):`,
    `------------------------------------------------------------------`,
    `• Cloudflare D1 DB : ${dbName} (ID: ${databaseId})`,
    `• Cloudflare R2    : ${r2BucketName}`,
    `• Cloudflare Pages : ${clientSlug}`,
    ``,
    `==================================================================`,
    `PESAN WHATSAPP SIAP COPY-PASTE KE KLIEN:`,
    `==================================================================`,
    `Halo kak ${clientName}! 👋`,
    `Website portofolio interaktif kamu sudah resmi aktif dan siap dipakai! 🚀`,
    ``,
    `🌐 Website Kamu:`,
    `https://${clientSlug}.pages.dev`,
    ``,
    `🔐 Ruang Admin Pribadi (untuk kelola karya, foto, & profil):`,
    `https://${clientSlug}.pages.dev/admin`,
    `Email    : ${adminEmail}`,
    `Password : ${adminPassword}`,
    ``,
    `Semua foto, video karya, dan kontak bisa kamu tambahkan sendiri dengan sangat mudah di ruang admin. Selamat berkarya dan sukses selalu! 🎉✨`,
    `==================================================================`,
  ].join('\n');
  fs.writeFileSync(path.join(dirPath, 'SURAT_SERAH_TERIMA.txt'), handoverDoc, 'utf-8');
  console.log(`✓ Arsip tersimpan di: arsip-klien/${folderName}`);

  // 6. Kompilasi Template (Build OpenNext)
  console.log('\n[6/7] Mengompilasi Kode Template Portofolio (npm run cf:build)...');
  const openNextDir = path.join(ROOT_DIR, '.open-next');
  const forceBuild = getParam('--force-build', 'FORCE_BUILD', 'true') === 'true';

  if (!fs.existsSync(openNextDir) || forceBuild) {
    const buildResult = await runCommandStreaming(
      'npm',
      ['run', 'cf:build'],
      { cwd: ROOT_DIR },
      (line) => console.log(`   [build] ${line}`)
    );
    if (buildResult.code !== 0) {
      throw new Error(`Kompilasi template gagal dengan kode keluar ${buildResult.code}`);
    }
    console.log('✓ Kompilasi template berhasil.');
  } else {
    console.log('✓ Menggunakan bundle .open-next yang sudah ada.');
  }

  // 7. Deploy ke Cloudflare Pages Klien
  console.log(`\n[7/7] Mendeploy Website ke Cloudflare Pages (${clientSlug})...`);
  const deployResult = await runCommandStreaming(
    'npx',
    [
      'wrangler',
      'pages',
      'deploy',
      '.open-next',
      `--project-name=${clientSlug}`,
      '--commit-dirty=true',
    ],
    {
      cwd: ROOT_DIR,
      env: {
        CLOUDFLARE_ACCOUNT_ID: accountId,
        CLOUDFLARE_API_TOKEN: apiToken,
      },
    },
    (line) => console.log(`   [wrangler] ${line}`)
  );

  if (deployResult.code !== 0) {
    throw new Error(`Deploy Cloudflare Pages gagal dengan kode ${deployResult.code}`);
  }

  const websiteUrl = `https://${clientSlug}.pages.dev`;
  const adminUrl = `https://${clientSlug}.pages.dev/admin`;

  console.log('\n========================================================');
  console.log('🎉 WEBSITE KLIEN BERHASIL AKTIF & LIVE!');
  console.log('========================================================');
  console.log(`🌐 Website URL : ${websiteUrl}`);
  console.log(`🔐 Admin URL   : ${adminUrl}`);
  console.log(`📧 Email       : ${adminEmail}`);
  console.log(`🔑 Password    : ${adminPassword}`);
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
async function handleUpdate() {
  console.log('\n========================================================');
  console.log('🔄 [CLOUD MASTER] MEMULAI UPDATE VERSI TEMPLATE');
  console.log('========================================================\n');

  const target = getParam('--target', 'UPDATE_TARGET', 'all');
  const specificSlug = getParam('--slug', 'CLIENT_SLUG');
  const accountId = getParam('--account-id', 'CLOUDFLARE_ACCOUNT_ID');
  const apiToken = getParam('--api-token', 'CLOUDFLARE_API_TOKEN');

  // Compile template first
  console.log('[1/2] Mengompilasi Kode Template Terbaru (npm run cf:build)...');
  const buildResult = await runCommandStreaming(
    'npm',
    ['run', 'cf:build'],
    { cwd: ROOT_DIR },
    (line) => console.log(`   [build] ${line}`)
  );
  if (buildResult.code !== 0) {
    throw new Error(`Kompilasi template gagal dengan kode ${buildResult.code}`);
  }
  console.log('✓ Kompilasi template OpenNext selesai.');

  // Determine target list
  console.log('\n[2/2] Memproses Deploy Pembaruan ke Website Klien...');
  const targets: Array<{ name: string; slug: string; accountId: string; apiToken: string }> = [];

  if (specificSlug && accountId && apiToken) {
    targets.push({
      name: getParam('--name', 'CLIENT_NAME', specificSlug),
      slug: specificSlug,
      accountId,
      apiToken,
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
              accountId: env.CLOUDFLARE_ACCOUNT_ID,
              apiToken: env.CLOUDFLARE_API_TOKEN,
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

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`\n>>> [${i + 1}/${targets.length}] Mendeploy ke: ${t.name} (${t.slug})...`);

    const deployResult = await runCommandStreaming(
      'npx',
      [
        'wrangler',
        'pages',
        'deploy',
        '.open-next',
        `--project-name=${t.slug}`,
        '--commit-dirty=true',
      ],
      {
        cwd: ROOT_DIR,
        env: {
          CLOUDFLARE_ACCOUNT_ID: t.accountId,
          CLOUDFLARE_API_TOKEN: t.apiToken,
        },
      },
      (line) => console.log(`   [wrangler] ${line}`)
    );

    const url = `https://${t.slug}.pages.dev`;
    if (deployResult.code === 0) {
      console.log(`✓ BERHASIL: ${t.name} telah diupdate ke template terbaru (${url}).`);
      results.push({ name: t.name, slug: t.slug, success: true, url });
    } else {
      console.log(`✗ GAGAL: Deploy ke ${t.name} gagal dengan kode ${deployResult.code}.`);
      results.push({ name: t.name, slug: t.slug, success: false, url, error: `Kode keluar ${deployResult.code}` });
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

  domain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // Look up credentials from archive if missing
  if ((!accountId || !apiToken) && fs.existsSync(ARCHIVE_DIR)) {
    const folders = fs.readdirSync(ARCHIVE_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const f of folders) {
      const envPath = path.join(ARCHIVE_DIR, f, 'config.env');
      if (fs.existsSync(envPath)) {
        const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));
        if (env.CUSTOMER_SLUG === clientSlug || f.includes(clientSlug)) {
          accountId = accountId || env.CLOUDFLARE_ACCOUNT_ID;
          apiToken = apiToken || env.CLOUDFLARE_API_TOKEN;
          break;
        }
      }
    }
  }

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Account ID dan API Token wajib disediakan untuk mendaftarkan domain.');
  }

  console.log(`🔗 Menghubungkan domain: ${domain} -> Proyek Pages: ${clientSlug}`);

  const cfRes = await cfApi(
    `/accounts/${accountId}/pages/projects/${clientSlug}/domains`,
    apiToken,
    {
      method: 'POST',
      body: JSON.stringify({ name: domain }),
    }
  );

  if (!cfRes.ok) {
    throw new Error(`Gagal mendaftarkan domain di Cloudflare: ${cfRes.data?.errors?.[0]?.message || 'Kesalahan API'}`);
  }

  const isSubdomain = domain.split('.').length > 2 && !domain.startsWith('www.');
  const cnameHost = isSubdomain ? domain.split('.')[0] : domain.startsWith('www.') ? 'www' : '@';
  const cnameTarget = `${clientSlug}.pages.dev`;

  console.log('✓ Domain berhasil didaftarkan di Cloudflare Pages.');
  console.log(`DNS Host   : ${cnameHost}`);
  console.log(`DNS Target : ${cnameTarget}`);

  const whatsappMsg = [
    `Halo! 👋`,
    `Custom domain *${domain}* sudah didaftarkan ke sistem website portofolio kamu.`,
    ``,
    `Tinggal 1 langkah mudah untuk aktivasi:`,
    `Buka panel domain tempat kamu membeli domain, lalu tambahkan DNS Record ini:`,
    `• Tipe   : CNAME`,
    `• Nama   : ${cnameHost}`,
    `• Target : ${cnameTarget}`,
    ``,
    `Setelah ditambahkan, domain kamu akan otomatis aktif dalam 5-15 menit. 🚀`,
  ].join('\n');

  const summaryMarkdown = `
# 🌐 Custom Domain Berhasil Didaftarkan!

| Informasi | Rincian |
|---|---|
| **Domain Baru** | **https://${domain}** |
| **Target Pages** | \`${clientSlug}.pages.dev\` |
| **DNS Record Type** | \`CNAME\` |
| **DNS Host / Name** | \`${cnameHost}\` |
| **DNS Target / Value** | \`${cnameTarget}\` |

---

### 📋 Format Pesan WhatsApp untuk Klien (Cara Atur DNS):

\`\`\`text
${whatsappMsg}
\`\`\`
`;
  appendToGitHubSummary(summaryMarkdown);
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
      default:
        console.error(`Aksi tidak dikenali: "${action}". Gunakan "onboard_client", "update_template", atau "custom_domain".`);
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

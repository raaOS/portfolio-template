import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { SHARED_SCHEMA_QUERIES } from '../../src/crud/shared/db/schema';
import { hashPasswordScrypt } from '../../src/crud/shared/auth/password';
import { clientUrls, deployClient, resolveWorkersSubdomain } from './client-deploy';
import { attachWorkerDomain, findWorkerDomain, buildDomainHandoverMessage } from './custom-domain';

const PORT = Number(process.env.PORT) || 4567;
const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'scripts', 'onboarding', 'public');
const ARCHIVE_DIR = path.join(ROOT_DIR, 'arsip-klien');

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
  templateKey: 'os-desktop' | 'infinite-canvas';
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

// Generate next archive folder name e.g. "01_budi_pratama"
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

// Provisioning Worker with Progress Callback
async function provisionClient(
  payload: ProvisionPayload,
  onProgress: (step: number, message: string, detail?: string) => void
) {
  const { clientName, clientSlug, templateKey, accountId, apiToken, adminEmail } = payload;
  const adminPassword = payload.adminPassword || `Porto${crypto.randomBytes(3).toString('hex')}!`;
  const siteId = clientSlug;
  const dbName = `db-${clientSlug}`;
  const r2BucketName = `media-${clientSlug}`;

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
  const createR2Res = await cfApi(`/accounts/${accountId}/r2/buckets/${r2BucketName}`, apiToken, {
    method: 'PUT',
  });
  if (!createR2Res.ok && createR2Res.status !== 409) {
    // 409 means bucket already exists, which is acceptable
    console.warn('R2 bucket creation warning:', createR2Res.data?.errors);
  }

  // STEP 4: Migrasi Skema Tabel & Data Awal
  onProgress(4, 'Memasang Tabel & Template...', `Mengatur template: ${templateKey === 'os-desktop' ? 'macOS Desktop' : 'Infinite Canvas'}`);
  for (const sql of SHARED_SCHEMA_QUERIES) {
    await cfApi(`/accounts/${accountId}/d1/database/${databaseId}/query`, apiToken, {
      method: 'POST',
      body: JSON.stringify({ sql }),
    });
  }

  // Seed site row
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

  // Seed admin user
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

  // STEP 5: Pengarsipan Folder Klien (Isolasi Total)
  onProgress(5, 'Mengarsipkan Kunci & Dokumen Klien...', 'Menyimpan ke folder arsip-klien di laptop');
  const { dirPath, folderName } = getNextArchiveDir(clientSlug);

  // URL publik memakai Cloudflare Worker (Opsi B), bukan Pages.
  // Subdomain workers.dev dibaca best-effort; kalau token belum punya izin,
  // deploy berikutnya akan mencoba lagi dan memperbarui config.env.
  const subdomain = await resolveWorkersSubdomain(accountId, apiToken);
  const websiteUrl = `https://${clientSlug}.${subdomain ? `${subdomain}.` : ''}workers.dev`;
  const adminUrl = `${websiteUrl}/admin`;

  // Secret milik klien — tidak pernah memakai nilai dari .env.local owner.
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const passwordSalt = crypto.randomBytes(16).toString('hex');

  const envContent = [
    `# ========================================================`,
    `# ARSIP KLIEN: ${clientName} (${folderName})`,
    `# Tanggal Pembuatan: ${new Date().toLocaleString('id-ID')}`,
    `# ========================================================`,
    `CUSTOMER_NAME="${clientName}"`,
    `CUSTOMER_SLUG="${clientSlug}"`,
    `ACTIVE_TEMPLATE_KEY="${templateKey}"`,
    `CUSTOMER_SITE_ID="${siteId}"`,
    `CLOUDFLARE_ACCOUNT_ID="${accountId}"`,
    `CLOUDFLARE_D1_DATABASE_NAME="${dbName}"`,
    `CLOUDFLARE_D1_DATABASE_ID="${databaseId}"`,
    `CLOUDFLARE_D1_API_TOKEN="${apiToken}"`,
    `CLOUDFLARE_R2_BUCKET_NAME="${r2BucketName}"`,
    `CLOUDFLARE_R2_BUCKET="${r2BucketName}"`,
    `CLOUDFLARE_R2_ACCOUNT_ID="${accountId}"`,
    `CLOUDFLARE_R2_PUBLIC_BASE_URL="/r2"`,
    `CLOUDFLARE_API_TOKEN="${apiToken}"`,
    `JWT_SECRET="${jwtSecret}"`,
    `PASSWORD_SALT="${passwordSalt}"`,
    subdomain
      ? `WORKERS_SUBDOMAIN="${subdomain}"`
      : `# WORKERS_SUBDOMAIN="" (belum terbaca saat onboarding)`,
    `ADMIN_EMAIL="${adminEmail}"`,
    `ADMIN_PASSWORD="${adminPassword}"`,
    `WEBSITE_URL="${websiteUrl}"`,
    `ADMIN_URL="${adminUrl}"`,
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

const server = http.createServer(async (req, res) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin && !ALLOWED_ORIGINS.has(requestOrigin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Akses ditolak.' }));
    return;
  }

  const url = req.url?.split('?')[0] || '/';

  // Static files
  if (url === '/' || url === '/index.html') {
    const htmlPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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

  // API: List archived clients
  if (url === '/api/clients' && req.method === 'GET') {
    try {
      if (!fs.existsSync(ARCHIVE_DIR)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clients: [] }));
        return;
      }

      const folders = fs
        .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort((a, b) => b.localeCompare(a)); // Newest first

      const clients = folders.map((folderName) => {
        const envPath = path.join(ARCHIVE_DIR, folderName, 'config.env');
        const env = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf-8')) : {};
        const urls = clientUrls(env, folderName);
        return {
          id: folderName,
          clientName: env.CUSTOMER_NAME || folderName,
          clientSlug: env.CUSTOMER_SLUG || folderName.replace(/^\d+_/, ''),
          adminEmail: env.ADMIN_EMAIL || '',
          adminPassword: env.ADMIN_PASSWORD || '',
          websiteUrl: urls.websiteUrl,
          adminUrl: urls.adminUrl,
          customDomain: env.CUSTOM_DOMAIN || '',
          templateKey: env.ACTIVE_TEMPLATE_KEY || 'os-desktop',
        };
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, clients }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: (err as Error).message }));
    }
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
        let attached: { hostname: string; service: string; zoneName: string };
        try {
          attached = await attachWorkerDomain(cfApi, {
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
            adminPassword: env.ADMIN_PASSWORD || '',
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
      const hasBuild = fs.existsSync(openNextDir);
      let lastBuilt: string | null = null;
      if (hasBuild) {
        const stats = fs.statSync(openNextDir);
        lastBuilt = stats.mtime.toLocaleString('id-ID');
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
      const isCanvasSec = (t: string) => /canvas|kanvas|3d|🎨/i.test(t);
      const isDesktopSec = (t: string) => /macos|desktop|mac os|🖥️/i.test(t);

      const canvasPoints: string[] = [];
      const desktopPoints: string[] = [];
      const systemPoints: string[] = [];
      const allPoints: string[] = [];

      for (const sec of sections) {
        for (const item of sec.items) {
          const shortItem = item.split(':')[0].trim();
          const point = `• ${shortItem}`;
          allPoints.push(point);

          if (isCanvasSec(sec.title)) {
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

      const whatsappMessages = {
        'os-desktop': createWaMessage('macOS Desktop', waDesktopPoints),
        'infinite-canvas': createWaMessage('Infinite Canvas', waCanvasPoints),
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
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        // `forceBuild` tidak lagi dipakai: bundle dibangun ulang untuk tiap
        // klien karena env build-nya berbeda (lihat deployClient()).
        const { folderName, all } = JSON.parse(body || '{}');

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const sendEvent = (type: string, data: unknown) => {
          res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        if (!fs.existsSync(ARCHIVE_DIR)) {
          sendEvent('error', { message: 'Direktori arsip-klien/ belum ada di laptop.' });
          res.end();
          return;
        }

        let targetFolders: string[] = [];
        if (all) {
          targetFolders = fs
            .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort((a, b) => a.localeCompare(b));
        } else if (folderName) {
          targetFolders = [folderName];
        } else {
          sendEvent('error', { message: 'Pilih salah satu klien atau pilih opsi update semua klien.' });
          res.end();
          return;
        }

        // Filter valid client folders with config.env
        targetFolders = targetFolders.filter((f) =>
          fs.existsSync(path.join(ARCHIVE_DIR, f, 'config.env'))
        );

        if (targetFolders.length === 0) {
          sendEvent('error', {
            message: 'Tidak ada arsip klien yang ditemukan untuk diperbarui. Daftarkan klien terlebih dahulu.',
          });
          res.end();
          return;
        }

        // STEP 1: Build + deploy per klien. Env tiap klien berbeda (D1/R2/secret
        // milik klien), jadi bundle harus dibangun ulang untuk tiap klien.
        sendEvent('progress', {
          stage: 'deploy',
          message: `Mulai build & deploy ${targetFolders.length} website klien...`,
        });

        const results: Array<{
          clientName: string;
          clientSlug: string;
          success: boolean;
          error?: string;
          url?: string;
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
            results.push({
              clientName,
              clientSlug: outcome.slug || clientSlug,
              success: true,
              url: outcome.websiteUrl,
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
        });

        sendEvent('complete', {
          success: results.some((r) => r.success),
          results,
        });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: (err as Error).message }));
        return;
      } finally {
        res.end();
      }
    });
    return;
  }

  // API: Client Status Board (health-check + domain untuk semua klien arsip)
  if (url === '/api/status' && req.method === 'GET') {
    try {
      if (!fs.existsSync(ARCHIVE_DIR)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clients: [], latestVersion: null }));
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
          };
        });

      // Health-check paralel: fetch ringan dengan timeout 8 detik per klien.
      const checked = await Promise.all(
        clients.map(async (c) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const start = Date.now();
            const healthRes = await fetch(`${c.websiteUrl.replace(/\/+$/, '')}/api/health`, {
              signal: controller.signal,
            });
            clearTimeout(timer);
            const latencyMs = Date.now() - start;
            let version: string | null = null;
            let dbStatus: string | null = null;
            try {
              const body = (await healthRes.json()) as {
                version?: string;
                database?: string;
                status?: string;
              };
              version = body.version || null;
              dbStatus = body.database || null;
            } catch {
              // health endpoint merespon non-JSON — anggap hidup tanpa detail.
            }
            return {
              ...c,
              online: healthRes.ok,
              httpStatus: healthRes.status,
              latencyMs,
              deployedVersion: version,
              database: dbStatus,
            };
          } catch {
            return {
              ...c,
              online: false,
              httpStatus: null,
              latencyMs: null,
              deployedVersion: null,
              database: null,
            };
          }
        })
      );

      // Versi template lokal (CHANGELOG.md paling atas) untuk perbandingan.
      let latestVersion: string | null = null;
      const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
      if (fs.existsSync(changelogPath)) {
        const match = fs.readFileSync(changelogPath, 'utf-8').match(/##\s*\[([^\]]+)\]/);
        latestVersion = match ? match[1] : null;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, clients: checked, latestVersion }));
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

// Helper simple env parser
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

// Hanya loopback (127.0.0.1) — lihat penjagaan akses di atas: portal ini
// memuat kredensial klien dan tidak boleh terbuka ke jaringan lokal.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Asisten Onboarding Klien Berjalan di: http://localhost:${PORT}`);
  console.log(`   Silakan buka browser Anda di http://localhost:${PORT}`);
  console.log(`   (Hanya bisa diakses dari laptop ini — bukan dari jaringan lokal)`);
  console.log(`======================================================\n`);
});


import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec, spawn } from 'child_process';
import { SHARED_SCHEMA_QUERIES } from '../../src/crud/shared/db/schema';
import { hashPasswordScrypt } from '../../src/crud/shared/auth/password';

const PORT = 4567;
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

  // STEP 6: Selesai
  onProgress(6, 'Selesai!', 'Website dan seluruh konfigurasi siap!');

  return {
    success: true,
    clientName,
    clientSlug,
    templateKey,
    websiteUrl: `https://${clientSlug}.pages.dev`,
    adminUrl: `https://${clientSlug}.pages.dev/admin`,
    adminEmail,
    adminPassword,
    archiveFolder: `arsip-klien/${folderName}`,
    databaseId,
    r2BucketName,
  };
}

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
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
              message: 'API Token tidak valid. Pastikan token sudah dibuat dengan izin D1, Pages, dan R2.',
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
          sendEvent('complete', result);
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
        return {
          id: folderName,
          clientName: env.CUSTOMER_NAME || folderName,
          clientSlug: env.CUSTOMER_SLUG || folderName.replace(/^\d+_/, ''),
          adminEmail: env.ADMIN_EMAIL || '',
          adminPassword: env.ADMIN_PASSWORD || '',
          websiteUrl: env.WEBSITE_URL || `https://${env.CUSTOMER_SLUG || folderName}.pages.dev`,
          adminUrl: env.ADMIN_URL || `https://${env.CUSTOMER_SLUG || folderName}.pages.dev/admin`,
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

        // Call Cloudflare Pages Custom Domain API
        const cfRes = await cfApi(
          `/accounts/${accountId}/pages/projects/${clientSlug}/domains`,
          apiToken,
          {
            method: 'POST',
            body: JSON.stringify({ name: domain }),
          }
        );

        if (!cfRes.ok) {
          const errorMsg = cfRes.data?.errors?.[0]?.message || 'Gagal menambahkan domain di Cloudflare.';
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: errorMsg }));
          return;
        }

        const domainResult = cfRes.data.result as {
          name?: string;
          status?: string;
          verification_data?: unknown;
        };

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
              `• Alamat Website   : https://${domain} (bawaan: https://${clientSlug}.pages.dev)\n• Custom Domain    : ${domain}`
            );
            fs.writeFileSync(suratPath, suratRaw, 'utf-8');
          }
        }

        const isSubdomain = domain.split('.').length > 2 && !domain.startsWith('www.');
        const cnameHost = isSubdomain ? domain.split('.')[0] : domain.startsWith('www.') ? 'www' : '@';
        const cnameTarget = `${clientSlug}.pages.dev`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            domain,
            status: domainResult?.status || 'pending',
            cnameHost,
            cnameTarget,
            clientName,
            clientSlug,
            adminEmail: env.ADMIN_EMAIL || '',
            adminPassword: env.ADMIN_PASSWORD || '',
            message: 'Custom domain berhasil dihubungkan ke Cloudflare Pages!',
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

        const cfRes = await cfApi(
          `/accounts/${accountId}/pages/projects/${clientSlug}/domains/${domain}`,
          apiToken
        );

        if (!cfRes.ok) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: cfRes.data?.errors?.[0]?.message || 'Gagal memeriksa status' }));
          return;
        }

        const result = cfRes.data.result as { status?: string };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, status: result?.status || 'unknown' }));
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
        const { folderName, all, forceBuild } = JSON.parse(body || '{}');

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

        // STEP 1: Build OpenNext if needed
        const openNextDir = path.join(ROOT_DIR, '.open-next');
        const needsBuild = Boolean(forceBuild) || !fs.existsSync(openNextDir);

        if (needsBuild) {
          sendEvent('progress', {
            stage: 'build',
            message: 'Mengompilasi versi template terbaru (npm run cf:build)...',
          });
          sendEvent('log', {
            text: '>>> [TAHAP 1] Menjalankan kompilasi: npm run cf:build...',
          });

          const buildResult = await runCommandStreaming(
            'npm',
            ['run', 'cf:build'],
            { cwd: ROOT_DIR },
            (line) => {
              sendEvent('log', { text: line });
            }
          );

          if (buildResult.code !== 0) {
            sendEvent('log', {
              text: `[GAGAL] Kompilasi template gagal dengan kode keluar ${buildResult.code}.`,
            });
            sendEvent('error', {
              message:
                'Kompilasi template gagal. Pastikan tidak ada konflik file atau dev server yang mengunci cache.',
            });
            res.end();
            return;
          }

          sendEvent('log', {
            text: '✓ Kompilasi template selesai dengan sukses! Bundle .open-next siap digunakan.',
          });
        } else {
          sendEvent('log', {
            text: 'ℹ Menggunakan bundle kompilasi .open-next yang sudah ada (forceBuild = false).',
          });
        }

        // STEP 2: Deploy to each client
        sendEvent('progress', {
          stage: 'deploy',
          message: `Mulai mendeploy ke ${targetFolders.length} website klien...`,
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
          const clientSlug = env.CUSTOMER_SLUG;
          const accountId = env.CLOUDFLARE_ACCOUNT_ID;
          const apiToken = env.CLOUDFLARE_API_TOKEN;

          sendEvent('progress', {
            stage: 'deploying',
            message: `[${i + 1}/${targetFolders.length}] Mengunggah template ke ${clientName}...`,
            current: i + 1,
            total: targetFolders.length,
          });

          sendEvent('log', {
            text: `\n------------------------------------------------------------\n>>> [${i + 1}/${targetFolders.length}] Mendeploy ke Cloudflare Pages: ${clientName} (${clientSlug})\n------------------------------------------------------------`,
          });

          if (!clientSlug || !accountId || !apiToken) {
            const errDetail = 'Kredensial Cloudflare tidak lengkap di file config.env';
            sendEvent('log', { text: `[GAGAL] ${errDetail}` });
            results.push({ clientName, clientSlug: clientSlug || folder, success: false, error: errDetail });
            continue;
          }

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
            (line) => {
              sendEvent('log', { text: line });
            }
          );

          if (deployResult.code === 0) {
            const clientUrl = env.WEBSITE_URL || `https://${clientSlug}.pages.dev`;
            sendEvent('log', {
              text: `✓ BERHASIL! Website ${clientName} telah diperbarui ke versi template terbaru: ${clientUrl}`,
            });
            results.push({ clientName, clientSlug, success: true, url: clientUrl });
          } else {
            const errDetail = `Wrangler keluar dengan kode ${deployResult.code}`;
            sendEvent('log', { text: `✗ GAGAL deploy ke ${clientName}. ${errDetail}` });
            results.push({ clientName, clientSlug, success: false, error: errDetail });
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
          return {
            id: folderName,
            clientName: env.CUSTOMER_NAME || folderName,
            clientSlug: env.CUSTOMER_SLUG || folderName.replace(/^\d+_/, ''),
            websiteUrl: env.WEBSITE_URL || `https://${env.CUSTOMER_SLUG || folderName}.pages.dev`,
            adminUrl: env.ADMIN_URL || `https://${env.CUSTOMER_SLUG || folderName}.pages.dev/admin`,
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

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Asisten Onboarding Klien Berjalan di: http://localhost:${PORT}`);
  console.log(`   Silakan buka browser Anda di http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});


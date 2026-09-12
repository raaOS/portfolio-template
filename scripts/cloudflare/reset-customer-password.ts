#!/usr/bin/env tsx
/**
 * Reset password admin customer (owner-assisted).
 *
 * Membaca kredensial Cloudflare klien dari `arsip-klien/<folder>/config.env`,
 * lalu menimpa password akun admin di tabel `site_users` pada database D1
 * milik klien tersebut dengan hash scrypt baru + salt baru.
 *
 * Ini satu-satunya jalur reset saat customer lupa password total —
 * change-password self-service hanya bisa dipakai selama customer masih
 * bisa login.
 *
 * Run:
 *   npx tsx scripts/cloudflare/reset-customer-password.ts <folder-arsip> --email admin@klien.com
 *   npx tsx scripts/cloudflare/reset-customer-password.ts <folder-arsip> --email admin@klien.com --generate
 *   npx tsx scripts/cloudflare/reset-customer-password.ts <folder-arsip> --email admin@klien.com --password "PasswordBaru!" --yes
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { hashPasswordScrypt } from '../../src/crud/shared/auth/password';

const ROOT_DIR = process.cwd();
const ARCHIVE_DIR = path.join(ROOT_DIR, 'arsip-klien');

interface CliArgs {
  folder: string | null;
  email: string | null;
  password: string | null;
  generate: boolean;
  yes: boolean;
  list: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    folder: null,
    email: null,
    password: null,
    generate: false,
    yes: false,
    list: false,
  };

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--email') {
      args.email = argv[++i] ?? null;
    } else if (arg === '--password') {
      args.password = argv[++i] ?? null;
    } else if (arg === '--generate') {
      args.generate = true;
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--list') {
      args.list = true;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }
  args.folder = positional[0] ?? null;
  return args;
}

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

function listArchiveFolders(): string[] {
  if (!fs.existsSync(ARCHIVE_DIR)) return [];
  return fs
    .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

async function confirmPrompt(question: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function cfApi(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: { success?: boolean; errors?: Array<{ message?: string }>; result?: unknown } }> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: unknown;
  };
  return { ok: res.ok && data.success === true, status: res.status, data };
}

function generatePassword(): string {
  return `Porto${crypto.randomBytes(4).toString('hex')}!`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const folders = listArchiveFolders();

  if (args.list || !args.folder) {
    console.log('\n=== Reset Password Admin Customer (Owner-Assisted) ===\n');
    if (folders.length === 0) {
      console.log('Belum ada arsip klien di folder arsip-klien/. Daftarkan klien terlebih dahulu lewat portal onboarding.');
      process.exit(1);
    }
    console.log('Arsip klien yang tersedia:');
    for (const f of folders) {
      const envPath = path.join(ARCHIVE_DIR, f, 'config.env');
      const name = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf-8')).CUSTOMER_NAME || f : f;
      console.log(`  - ${f}  (${name})`);
    }
    if (!args.list) {
      console.log('\nCara pakai:');
      console.log('  npx tsx scripts/cloudflare/reset-customer-password.ts <folder-arsip> --email <email-admin>');
      console.log('  Tambahkan --generate untuk password acak, atau --password "..." untuk password pilihan Anda.');
      console.log('  Tambahkan --yes untuk melewati konfirmasi interaktif.');
    }
    process.exit(args.list ? 0 : 1);
  }

  const envPath = path.join(ARCHIVE_DIR, args.folder, 'config.env');
  if (!fs.existsSync(envPath)) {
    console.error(`config.env tidak ditemukan di arsip-klien/${args.folder}.`);
    process.exit(1);
  }

  const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const databaseId = env.CLOUDFLARE_D1_DATABASE_ID;
  const clientName = env.CUSTOMER_NAME || args.folder;

  if (!accountId || !apiToken || !databaseId) {
    console.error('Kredensial Cloudflare pada arsip klien tidak lengkap (butuh ACCOUNT_ID, API_TOKEN, D1_DATABASE_ID).');
    process.exit(1);
  }

  // Resolve email: dari argumen, atau ambil satu-satunya admin dari D1.
  let email = args.email;
  if (!email) {
    console.log('Mengambil daftar akun admin dari database klien...');
    const listRes = await cfApi(
      `/accounts/${accountId}/d1/database/${databaseId}/query`,
      apiToken,
      {
        method: 'POST',
        body: JSON.stringify({
          sql: `SELECT email FROM site_users WHERE role = 'admin' ORDER BY created_at ASC`,
        }),
      }
    );
    if (!listRes.ok) {
      console.error(`Gagal membaca site_users: ${listRes.data.errors?.[0]?.message || listRes.status}`);
      process.exit(1);
    }
    const rows = (listRes.data.result as Array<{ results?: Array<{ email: string }> }>)?.[0]?.results || [];
    if (rows.length === 0) {
      console.error('Tidak ada akun admin pada database klien ini.');
      process.exit(1);
    }
    if (rows.length === 1) {
      email = rows[0].email;
    } else {
      console.log('Ada lebih dari satu akun admin. Tentukan salah satu dengan --email:');
      for (const r of rows) console.log(`  - ${r.email}`);
      process.exit(1);
    }
  }

  // Resolve password baru: --password, --generate, atau prompt interaktif.
  let newPassword = args.password;
  if (!newPassword && args.generate) {
    newPassword = generatePassword();
  }
  if (!newPassword && args.yes) {
    console.error('Password baru wajib ditentukan saat memakai --yes (--password "..." atau --generate).');
    process.exit(1);
  }
  if (!newPassword) {
    const rl = createInterface({ input, output });
    try {
      newPassword = (await rl.question('Password baru untuk customer (min. 8 karakter): ')).trim();
    } finally {
      rl.close();
    }
  }

  if (!newPassword || newPassword.length < 8) {
    console.error('Password baru minimal 8 karakter.');
    process.exit(1);
  }

  console.log(`\nKlien        : ${clientName} (${args.folder})`);
  console.log(`Email admin  : ${email}`);
  console.log(`Password baru: ${newPassword.replace(/./g, '*')} (${newPassword.length} karakter)\n`);

  if (!args.yes) {
    const ok = await confirmPrompt(`Yakin reset password admin ${clientName}? Tindakan ini menimpa password lama.`);
    if (!ok) {
      console.log('Dibatalkan.');
      process.exit(0);
    }
  }

  // Tulis hash scrypt + salt baru ke D1 klien.
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPasswordScrypt(newPassword, salt);

  const updateRes = await cfApi(
    `/accounts/${accountId}/d1/database/${databaseId}/query`,
    apiToken,
    {
      method: 'POST',
      body: JSON.stringify({
        sql: `UPDATE site_users
              SET password_hash = ?, password_salt = ?, password_algorithm = 'scrypt'
              WHERE site_id = ? AND email = ? AND role = 'admin'`,
        params: [passwordHash, salt, env.CUSTOMER_SLUG || args.folder.replace(/^\d+_/, ''), email.toLowerCase()],
      }),
    }
  );

  if (!updateRes.ok) {
    console.error(`Gagal update password: ${updateRes.data.errors?.[0]?.message || updateRes.status}`);
    process.exit(1);
  }

  const meta = (updateRes.data.result as Array<{ meta?: { changes?: number } }>)?.[0];
  if (!meta?.meta?.changes) {
    console.error('Tidak ada baris yang ter-update. Periksa email admin & site_id klien.');
    process.exit(1);
  }

  // Sinkronkan password di config.env arsip agar serah terima berikutnya akurat.
  let envRaw = fs.readFileSync(envPath, 'utf-8');
  if (envRaw.includes('ADMIN_PASSWORD=')) {
    envRaw = envRaw.replace(/ADMIN_PASSWORD=".*"/, `ADMIN_PASSWORD="${newPassword}"`);
    fs.writeFileSync(envPath, envRaw, 'utf-8');
    console.log('config.env arsip klien telah diperbarui dengan password baru.');
  }

  console.log('\n=== Password Berhasil Direset ===\n');
  console.log('Pesan WhatsApp siap salin untuk klien:\n');
  console.log('------------------------------------------------------------');
  console.log(`Halo kak ${clientName}! 👋`);
  console.log('');
  console.log('Password login ruang admin website Anda sudah kami reset yang baru ya.');
  console.log('');
  console.log(`🔐 Email    : ${email}`);
  console.log(`🔑 Password : ${newPassword}`);
  console.log('');
  console.log('Silakan login di halaman admin, lalu ganti password ini dengan password pilihan Anda sendiri lewat menu Keamanan.');
  console.log('------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('Terjadi kesalahan:', err instanceof Error ? err.message : err);
  process.exit(1);
});

#!/usr/bin/env tsx
/**
 * Pindahkan nilai rahasia dari `.env.local` ke Worker secrets Cloudflare.
 *
 * Mengapa perlu: nilai env yang di-inline saat `next build` hanya terbaca
 * oleh bundel saat build. Setelah menjadi Worker secret, nilai itu yang
 * menentukan perilaku runtime di Cloudflare (env Worker didahulukan, lalu
 * nilai build-time — lihat `populateProcessEnv` di
 * `node_modules/@opennextjs/cloudflare/dist/cli/templates/init.js`), sehingga:
 *   - rotasi rahasia bisa dilakukan TANPA deploy ulang, dan
 *   - nilai lama di `.env.local` tidak lagi mengendalikan produksi.
 *
 * `.env.local` tetap dibutuhkan oleh `npm run dev` dan berbagai script
 * pemeliharaan lokal, jadi file itu tidak dihapus.
 *
 * Pemakaian:
 *   npx tsx scripts/cloudflare/put-worker-secrets.ts                 # dry-run
 *   npx tsx scripts/cloudflare/put-worker-secrets.ts --apply         # tulis
 *   npx tsx scripts/cloudflare/put-worker-secrets.ts --apply --keys=CRON_SECRET
 *
 * Output sengaja hanya nama key + status. Nilai rahasia TIDAK pernah dicetak.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const ROOT_DIR = process.cwd();

// Key yang nilainya rahasia dan dibutuhkan saat runtime (auth, notifikasi,
// kredensial D1/R2, cron). `NEXT_PUBLIC_*` sengaja tidak masuk: nilai itu
// sudah tertanam di bundle klien oleh desain Next.js, bukan Worker secret.
const SECRET_KEYS = [
  'JWT_SECRET',
  'PASSWORD_SALT',
  'ADMIN_PASSWORD_SCRYPT',
  'ADMIN_PIN',
  'REVALIDATION_TOKEN',
  'CRON_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_SECRET',
  'TELEGRAM_ADMIN_CHAT_ID',
  'NOTIFICATION_API_KEY',
  'AI_API_KEY',
  'CLOUDFLARE_D1_API_TOKEN',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
];

function loadLocalEnv(): void {
  const envPath = path.resolve(ROOT_DIR, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local tidak ditemukan — tidak ada sumber nilai rahasia.');
  }
  dotenv.config({ path: envPath, quiet: true });
}

function parseSelectedKeys(): string[] {
  const flag = process.argv.find((arg) => arg.startsWith('--keys='));
  if (!flag) return SECRET_KEYS;
  return flag
    .slice('--keys='.length)
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

function putSecret(key: string, value: string): { ok: boolean; detail: string } {
  // Satu string perintah (bukan argv + shell) supaya aman dari deprecation
  // Node DEP0190. Key berasal dari konstanta di atas, bukan input pengguna.
  const result = spawnSync(`npx wrangler secret put "${key}"`, {
    input: value,
    encoding: 'utf8',
    shell: true,
    cwd: ROOT_DIR,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const stderr = (result.stderr || '').trim();
  if (result.status === 0) return { ok: true, detail: 'ok' };
  return { ok: false, detail: stderr ? stderr.split(/\r?\n/).slice(-2).join(' | ') : `exit ${result.status}` };
}

function main(): void {
  const apply = process.argv.includes('--apply');
  const selected = parseSelectedKeys();

  loadLocalEnv();

  const present = selected.filter((key) => Boolean(process.env[key]));
  const empty = selected.filter((key) => !process.env[key]);

  console.log(`Mode      : ${apply ? 'APPLY — menulis secret ke Worker Cloudflare' : 'dry-run — tanpa perubahan'}`);
  console.log(`Target    : Worker di wrangler.jsonc (lihat field "name")`);
  console.log(`Key pilihan: ${selected.length} | berisi nilai: ${present.length} | kosong: ${empty.length}`);
  console.log('');

  for (const key of present) console.log(`  [ada]    ${key}`);
  for (const key of empty) console.log(`  [kosong] ${key} (dilewati — tidak ada nilai)`);
  console.log('');

  if (!apply) {
    const list = spawnSync('npx wrangler secret list', {
      encoding: 'utf8',
      shell: true,
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const names = (list.stdout || '').match(/"name"\s*:\s*"([^"]+)"/g)?.map((m) => m.replace(/.*"name"\s*:\s*"([^"]+)".*/, '$1')) ?? [];
    console.log(names.length ? `Secret di Worker saat ini: ${names.join(', ')}` : 'Secret di Worker saat ini: (belum ada)');
    console.log('\nJalankan ulang dengan --apply untuk benar-benar menulis.');
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const key of present) {
    const outcome = putSecret(key, process.env[key] as string);
    if (outcome.ok) {
      ok += 1;
      console.log(`  [ok]   ${key}`);
    } else {
      failed += 1;
      console.error(`  [FAIL] ${key} -> ${outcome.detail}`);
    }
  }

  console.log(`\nSelesai: ${ok} secret ditulis, ${failed} gagal.`);
  if (failed > 0) process.exitCode = 1;
}

main();

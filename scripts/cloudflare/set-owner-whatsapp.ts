/**
 * Set / ganti nomor WhatsApp owner (key `owner_whatsapp` di `platform_settings`).
 * Dipakai tombol "Chat Admin", "Bantuan WA (Terlanjur Bayar)" di halaman order,
 * dan wizard aktivasi R2 (`getOwnerWhatsapp`).
 *
 * Pemakaian:
 *   npx tsx scripts/cloudflare/set-owner-whatsapp.ts 08817472310          # D1 OWNER
 *   npx tsx scripts/cloudflare/set-owner-whatsapp.ts 08817472310 --client <folder-arsip>
 *                                                                         # D1 KLIEN (wizard R2)
 *   Tanpa nomor = tampilkan nilai saat ini (read-only, D1 owner).
 *
 * Format diterima: 08xx / 628xx / +628xx — otomatis dinormalisasi ke 628xx.
 *
 * Kenapa perlu mode --client: wizard R2 klien membaca `platform_settings` milik
 * D1 KLIEN (getOwnerWhatsapp dijalankan di deployment klien), yang hanya terisi
 * saat onboarding bila ADMIN_WHATSAPP ada di .env.local. Klien yang di-onboard
 * sebelum nomor tercatat (mis. gladi) perlu diisi manual lewat mode ini.
 *
 * Catatan owner 2026-11-14: nomor 628817472310 SEMENTARA — akan diganti suatu
 * saat. Jalankan ulang script ini (D1 owner + semua arsip klien aktif).
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadProductEnv } from './product-env';
import { getCurrentD1DatabaseId, queryD1ForDatabase } from './backup-common';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ARCHIVE_DIR = path.join(ROOT_DIR, 'arsip-klien');

function parseEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function normalize(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (!/^62\d{8,13}$/.test(digits)) {
    return { ok: false, error: `Nomor tidak valid setelah normalisasi: "${digits}"` };
  }
  return { ok: true, value: digits };
}

async function main() {
  loadProductEnv();

  const rawArgs = process.argv.slice(2);
  const clientIdx = rawArgs.indexOf('--client');
  const clientFolder = clientIdx >= 0 ? rawArgs[clientIdx + 1] : '';
  const positional = rawArgs.filter((a, i) => a !== '--client' && i !== clientIdx + 1);
  const raw = positional[0];

  // Mode klien: override kredensial env ke akun Cloudflare klien dari arsip
  // sebelum queryD1ForDatabase dipakai (helper membaca env di waktu panggilan).
  let targetLabel = 'D1 owner';
  if (clientFolder) {
    const envPath = path.join(ARCHIVE_DIR, clientFolder, 'config.env');
    if (!fs.existsSync(envPath)) {
      console.error(`✗ config.env tidak ditemukan di arsip-klien/${clientFolder}.`);
      process.exit(1);
    }
    const clientEnv = parseEnv(fs.readFileSync(envPath, 'utf-8'));
    const accountId = clientEnv.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = clientEnv.CLOUDFLARE_API_TOKEN;
    const databaseId = clientEnv.CLOUDFLARE_D1_DATABASE_ID;
    if (!accountId || !apiToken || !databaseId) {
      console.error(
        `✗ config.env ${clientFolder} tidak lengkap (butuh CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID).`
      );
      process.exit(1);
    }
    process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
    process.env.CLOUDFLARE_D1_API_TOKEN = apiToken;
    process.env.CLOUDFLARE_D1_DATABASE_ID = databaseId;
    targetLabel = `D1 klien ${clientFolder}`;
  }

  const databaseId = getCurrentD1DatabaseId();
  if (!databaseId) {
    console.error(`✗ Database ${targetLabel} tidak ditemukan (CLOUDFLARE_D1_DATABASE_ID).`);
    process.exit(1);
  }

  if (!raw) {
    // Read-only: tampilkan nilai saat ini.
    const rows = await queryD1ForDatabase<{ value: string }>(
      databaseId,
      `SELECT value FROM platform_settings WHERE key = 'owner_whatsapp' LIMIT 1`
    );
    console.log(
      `${targetLabel} — nomor WA owner saat ini: ${
        rows.length > 0 ? rows[0].value : 'owner_whatsapp belum diisi.'
      }`
    );
    return;
  }

  const check = normalize(raw);
  if (!check.ok) {
    console.error(`✗ ${check.error}`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  await queryD1ForDatabase(
    databaseId,
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ('owner_whatsapp', ?, ?)
     ON CONFLICT(key)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify({ number: check.value, updatedAt: now }), now]
  );

  // Verifikasi baca balik — jangan klaim sukses tanpa bukti.
  const rows = await queryD1ForDatabase<{ value: string }>(
    databaseId,
    `SELECT value FROM platform_settings WHERE key = 'owner_whatsapp' LIMIT 1`
  );
  const written = rows[0]?.value ? (JSON.parse(rows[0].value) as { number?: string }) : null;
  if (written?.number === check.value) {
    console.log(`✓ owner_whatsapp terpasang di ${targetLabel}: ${check.value} (terverifikasi baca balik).`);
  } else {
    console.error(`✗ Verifikasi gagal — nilai di DB: ${rows[0]?.value}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`✗ Gagal: ${(err as Error).message}`);
  process.exit(1);
});

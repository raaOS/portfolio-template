/**
 * Set / ganti template aktif klien (`sites.active_template_key` di D1 KLIEN).
 *
 * Satu deployment klien selalu memuat ketiga template sekaligus; template yang
 * tampil hanya ditentukan nilai ini — dibaca runtime oleh homepage (ISR 60s,
 * `src/app/page.tsx`) dan desktop admin (filter `templateScope` sejak v1.3.90
 * lewat `GET /api/admin/site-template`). Jadi ganti template = satu UPDATE,
 * TANPA build/deploy ulang.
 *
 * Pemakaian:
 *   npx tsx scripts/cloudflare/set-client-template.ts <folder-arsip>             # read-only
 *   npx tsx scripts/cloudflare/set-client-template.ts <folder-arsip> spatial-gallery
 *   npm run client:template -- <folder-arsip> spatial-gallery
 *
 * Key valid dibaca dari `src/lib/templates/registry.ts` (jangan hardcode list di sini).
 *
 * Yang dilakukan saat mengganti:
 *   1. Wajib ada bukti kepemilikan (`site_template_entitlements` di D1 klien) —
 *      template baru dicatat lewat portal lokal. `--force` = darurat, tanpa order.
 *   2. UPDATE baris `sites` di D1 klien (kredensial dari arsip-klien/<folder>/config.env)
 *   3. Sinkronkan `ACTIVE_TEMPLATE_KEY` di config.env arsip agar portal & re-provision
 *      tidak mengembalikan template lama diam-diam (server onboarding membaca kunci itu)
 *   4. Verifikasi baca balik D1 — tidak klaim sukses tanpa bukti
 *
 * Catatan konten (v1.3.88): konten CRUD inti (project, profil, testimoni, dll.)
 * dirender semua template — tidak ada yang hilang saat pindah. Pengaturan khusus
 * template (wallpaper macOS, konfigurasi spatial/canvas) tidak ikut pindah; klien
 * merapikan tampilan versi baru lewat panel admin mereka.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  SYSTEM_DEFAULT_TEMPLATE_ID,
  TEMPLATES,
  getTemplate,
} from '../../src/lib/templates/registry';
import { parseEnv, upsertEnvFile } from '../onboarding/env-file';
import { queryD1ForDatabase } from './backup-common';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ARCHIVE_DIR = path.join(ROOT_DIR, 'arsip-klien');

interface SiteRow {
  id: string;
  name: string | null;
  active_template_key: string | null;
}

function printUsage() {
  console.log('Set / ganti template aktif klien (tanpa build/deploy ulang).');
  console.log('');
  console.log('  npx tsx scripts/cloudflare/set-client-template.ts <folder-arsip>');
  console.log('      → tampilkan template aktif + template yang sudah dibeli (read-only)');
  console.log('  npx tsx scripts/cloudflare/set-client-template.ts <folder-arsip> <template-key>');
  console.log('      → aktifkan template yang SUDAH DIBELI, sinkronkan arsip, verifikasi baca balik');
  console.log('  npx tsx scripts/cloudflare/set-client-template.ts <folder-arsip> <template-key> --force');
  console.log('      → darurat: aktifkan walau tidak ada bukti pembelian (TIDAK membuat order)');
  console.log('');
  console.log(`  template-key valid: ${TEMPLATES.map((t) => t.id).join(', ')}`);
  console.log('  <folder-arsip>    : nama folder di arsip-klien/ (mis. 01_gladi-2026-10-24)');
  console.log('');
  console.log('  Catatan: pembelian template baru dicatat lewat portal lokal');
  console.log('  (PENGELOLA_KLIEN.bat → Detail Klien → Template & Pembelian) supaya');
  console.log('  muncul sebagai order di panel owner. Skrip ini TIDAK membuat order.');
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const force = rawArgs.includes('--force');
  const args = rawArgs.filter((arg) => arg !== '--force');
  if (args.includes('--help') || args.length === 0) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const folderRaw = args[0];
  const templateRaw = args[1];
  const folder = path.basename(folderRaw.replace(/[\\/]+$/, ''));

  if (!folder || folder === '.' || folder === '..') {
    console.error(`✗ Nama folder arsip tidak valid: "${folderRaw}"`);
    process.exit(1);
  }
  if (args.length > 2) {
    console.error(`✗ Terlalu banyak argumen: ${args.slice(2).join(' ')}`);
    process.exit(1);
  }

  // Validasi template key SEBELUM menyentuh kredensial/network: salah ketik cukup
  // ditolak di sini dan tidak pernah menulis buta.
  const nextKey = templateRaw ? templateRaw.trim() : '';
  if (nextKey && !getTemplate(nextKey)) {
    console.error(
      `✗ Template "${nextKey}" tidak dikenal. Key valid: ${TEMPLATES.map((t) => t.id).join(', ')}.`
    );
    process.exit(1);
  }

  const envPath = path.join(ARCHIVE_DIR, folder, 'config.env');
  if (!fs.existsSync(envPath)) {
    console.error(`✗ config.env tidak ditemukan di arsip-klien/${folder}.`);
    process.exit(1);
  }
  const clientEnv = parseEnv(fs.readFileSync(envPath, 'utf-8'));
  const accountId = clientEnv.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = clientEnv.CLOUDFLARE_API_TOKEN;
  const databaseId = clientEnv.CLOUDFLARE_D1_DATABASE_ID;
  const wantedSiteId = (clientEnv.CUSTOMER_SITE_ID || '').trim();
  if (!accountId || !apiToken || !databaseId) {
    console.error(
      `✗ config.env ${folder} tidak lengkap (butuh CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID).`
    );
    process.exit(1);
  }

  // Override kredensial env ke akun Cloudflare KLIEN — queryD1ForDatabase membaca
  // env di waktu panggilan, jadi harus terpasang SEBELUM query mana pun.
  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
  process.env.CLOUDFLARE_D1_API_TOKEN = apiToken;
  process.env.CLOUDFLARE_D1_DATABASE_ID = databaseId;

  const rows = await queryD1ForDatabase<SiteRow>(
    databaseId,
    'SELECT id, name, active_template_key FROM sites'
  );

  // Invarian managed service: 1 klien = 1 D1 = 1 baris sites. Jumlah lain =
  // gejala D1 tercampur → jangan nebak, berhenti.
  if (rows.length !== 1) {
    console.error(
      `✗ D1 ${folder} berisi ${rows.length} baris sites (harus tepat 1). Tidak ada yang diubah — cek dulu.`
    );
    process.exit(1);
  }

  const site = rows[0];
  if (wantedSiteId && wantedSiteId !== site.id) {
    console.error(
      `✗ CUSTOMER_SITE_ID arsip ("${wantedSiteId}") ≠ id baris sites di D1 ("${site.id}"). Tidak ada yang diubah — arsip dan D1 tidak sinkron.`
    );
    process.exit(1);
  }

  const label = `${folder} (${site.id}${site.name ? ` — ${site.name}` : ''})`;
  const currentKey = site.active_template_key || SYSTEM_DEFAULT_TEMPLATE_ID;

  // Bukti kepemilikan: `site_template_entitlements` di D1 klien. Portal menulis
  // tabel ini saat pembelian; skrip ini hanya boleh memindahkan template yang
  // memang sudah dibeli (kecuali --force darurat).
  let ownedKeys: string[] = [];
  let entitlementTableReady = true;
  try {
    const rows = await queryD1ForDatabase<{ template_id: string }>(
      databaseId,
      'SELECT template_id FROM site_template_entitlements WHERE site_id = ?',
      [site.id]
    );
    ownedKeys = rows.map((row) => String(row.template_id));
  } catch {
    entitlementTableReady = false;
  }

  if (!nextKey) {
    console.log(
      `${label} — template aktif: ${currentKey} (${getTemplate(currentKey)?.name || 'tidak dikenal registry'})`
    );
    console.log(
      `   Dimiliki: ${
        ownedKeys.length > 0
          ? ownedKeys.join(', ')
          : entitlementTableReady
          ? '(belum ada entitlement)'
          : '(tabel entitlement tidak terbaca)'
      }`
    );
    console.log(
      `   Aktifkan template yang sudah dibeli: npx tsx scripts/cloudflare/set-client-template.ts ${folder} <${TEMPLATES.map((t) => t.id).join('|')}>`
    );
    return;
  }

  if (!ownedKeys.includes(nextKey)) {
    if (!force) {
      console.error(
        `✗ ${label} belum memiliki template "${nextKey}" (tidak ada baris entitlement).`
      );
      if (!entitlementTableReady) {
        console.error(
          '  Tabel site_template_entitlements belum ada/terbaca di D1 klien ini.'
        );
      }
      console.error(
        '  Catat pembelian lewat portal: PENGELOLA_KLIEN.bat → Detail Klien → Template & Pembelian.'
      );
      console.error('  Untuk klien lama, isi kepemilikan historis dulu:');
      console.error(
        '    npx tsx scripts/cloudflare/backfill-template-entitlements.ts --apply'
      );
      console.error(
        '  Darurat tanpa bukti pembelian: tambahkan --force (template aktif, TIDAK ada order baru).'
      );
      process.exit(1);
    }
    console.warn(
      `⚠️  --force: "${nextKey}" tidak tercatat sebagai template yang dibeli ${folder}.`
    );
    console.warn('   Template tetap diaktifkan, tetapi TIDAK ada order/bukti pembelian dibuat.');
  }

  let changed = false;
  if (currentKey !== nextKey) {
    await queryD1ForDatabase(
      databaseId,
      'UPDATE sites SET active_template_key = ?, updated_at = ? WHERE id = ?',
      [nextKey, new Date().toISOString(), site.id]
    );

    // Verifikasi baca balik — jangan klaim sukses tanpa bukti.
    const after = await queryD1ForDatabase<{ active_template_key: string | null }>(
      databaseId,
      'SELECT active_template_key FROM sites WHERE id = ?',
      [site.id]
    );
    if (after[0]?.active_template_key !== nextKey) {
      console.error(
        `✗ Verifikasi gagal — nilai di DB: ${after[0]?.active_template_key ?? '(null)'}`
      );
      process.exit(1);
    }
    changed = true;
  }

  // Sinkronkan arsip. Server onboarding/portal membaca ACTIVE_TEMPLATE_KEY dari
  // sini (mis. saat re-provision / update template); kalau arsip dibiarkan,
  // template bisa kembali ke nilai lama tanpa disadari.
  upsertEnvFile(envPath, { ACTIVE_TEMPLATE_KEY: nextKey });
  const archiveKey = parseEnv(fs.readFileSync(envPath, 'utf-8')).ACTIVE_TEMPLATE_KEY;

  console.log(
    changed
      ? `✓ ${label}: ${currentKey} → ${nextKey} (terverifikasi baca balik).`
      : `✓ ${label} sudah aktif template ${nextKey} — D1 tidak diubah.`
  );
  if (archiveKey === nextKey) {
    console.log(`  config.env arsip disinkronkan (ACTIVE_TEMPLATE_KEY="${nextKey}").`);
  } else {
    // D1 sudah berubah; jangan gagal keras, tapi jangan diam juga.
    console.error(
      `⚠️  Gagal menyinkronkan ACTIVE_TEMPLATE_KEY di arsip (terbaca: ${archiveKey ?? '(kosong)'}). Perbaiki manual agar re-provision tidak mengembalikan template lama.`
    );
    process.exit(2);
  }
  console.log(
    '  Situs pengunjung berganti ≤60 detik (ISR); dashboard admin menyesuaikan setelah refresh.'
  );
  console.log('  Konten tidak berubah; pengaturan tampilan khas template baru mulai dari default.');
}

main().catch((err) => {
  console.error(`✗ Gagal: ${(err as Error).message}`);
  process.exit(1);
});

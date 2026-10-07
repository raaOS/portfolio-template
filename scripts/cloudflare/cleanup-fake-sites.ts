#!/usr/bin/env tsx
/**
 * Hapus baris `sites` PALSU hasil `activateOrder` era multi-tenant.
 *
 * Latar: konsep tenant `/{slug}` dihapus (keputusan owner 2026-10-07).
 * Sejak perubahan itu `activateOrder` TIDAK lagi menanam baris ke tabel
 * `sites` (label generatif Opsi A). Baris lama peninggalan era tenant punya
 * pola id `site_<epochMillis>_<rand>` dan tidak pernah dibaca route mana
 * pun (tidak ada FK, tenant route sudah mati).
 *
 * Baris SAH yang TIDAK boleh disentuh:
 *   - `default-site` (seed) dan baris id = CUSTOMER_SITE_ID onboarding
 *     (keduanya tidak cocok pola `site_<digit>...` kecuali slug klien yang
 *     kebetulan diawali `site_` + angka — diverifikasi eksplisit di bawah).
 *
 * Run:
 *   npx tsx scripts/cloudflare/cleanup-fake-sites.ts              # SELECT saja
 *   npx tsx scripts/cloudflare/cleanup-fake-sites.ts --delete --yes
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { isD1Configured, queryD1 } from '../../src/lib/cloudflareD1';

interface SiteRow {
  id: string;
  slug: string;
  name: string | null;
  status: string;
  created_at: string | null;
}

// Tabel yang bisa punya kolom `site_id` (skema runtime + skema bootstrap).
// `audit_logs` sengaja TIDAK diblokir: itu riwayat, boleh tetap merujuk
// label lama (orders.site_id juga dibiarkan sebagai jejak).
const DEPENDENT_TABLES = [
  'projects',
  'media_assets',
  'site_custom_domains',
  'site_analytics',
  'site_quota_overrides',
  'site_template_entitlements',
  'site_users',
];

async function main(): Promise<void> {
  if (!isD1Configured()) {
    console.error('D1 belum terkonfigurasi — cek CLOUDFLARE_D1_DATABASE_ID & token di .env.local');
    process.exit(1);
  }

  const wantDelete = process.argv.includes('--delete');
  const confirmed = process.argv.includes('--yes');

  // Id tambahan eksplisit di luar pola GLOB (mis. sisa tenant load-test
  // `site-<uuid>`): --id=<id> boleh diulang.
  const extraIds = process.argv
    .filter((arg) => arg.startsWith('--id='))
    .map((arg) => arg.slice('--id='.length));

  if (process.argv.includes('--list-all')) {
    const all = await queryD1<SiteRow>(
      `SELECT id, slug, name, status, created_at FROM sites ORDER BY created_at`
    );
    console.log(`Seluruh baris tabel sites (${all.length}):`);
    for (const row of all) {
      console.log(
        `  - ${row.id} | slug=${row.slug} | status=${row.status} | created=${row.created_at ?? '?'} | ${row.name ?? ''}`
      );
    }
    return;
  }

  const fakeRows = await queryD1<SiteRow>(
    `SELECT id, slug, name, status, created_at FROM sites WHERE id GLOB 'site_[0-9]*' ORDER BY created_at`
  );
  const extraRows =
    extraIds.length > 0
      ? await queryD1<SiteRow>(
          `SELECT id, slug, name, status, created_at FROM sites WHERE id IN (${extraIds.map(() => '?').join(',')})`,
          extraIds
        )
      : [];
  const targets = [...fakeRows, ...extraRows.filter((r) => !fakeRows.some((f) => f.id === r.id))];

  console.log(`Baris target dihapus: ${targets.length}`);
  for (const row of targets) {
    console.log(
      `  - ${row.id} | slug=${row.slug} | status=${row.status} | created=${row.created_at ?? '?'} | ${row.name ?? ''}`
    );
  }

  if (targets.length === 0) {
    console.log('Tidak ada baris palsu. Selesai.');
    return;
  }

  if (!wantDelete) {
    console.log('\nMode SELECT saja. Tambah --delete --yes untuk menghapus baris di atas.');
    return;
  }

  if (!confirmed) {
    console.error('Tolak: hapus destruktif butuh flag --yes (bersama --delete).');
    process.exit(1);
  }

  // Penjaga dependen: jangan hapus site yang masih dirujuk data lain.
  const fakeIds = targets.map((row) => row.id);
  const placeholders = fakeIds.map(() => '?').join(',');
  const violations: string[] = [];

  for (const table of DEPENDENT_TABLES) {
    try {
      const rows = await queryD1<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${table} WHERE site_id IN (${placeholders})`,
        fakeIds
      );
      if ((rows[0]?.n ?? 0) > 0) {
        violations.push(`${table} (${rows[0].n} baris)`);
      }
    } catch {
      // Tabel tidak ada di skema deployment ini — lewati.
    }
  }

  if (violations.length > 0) {
    console.error('\nTOLAK menghapus — masih ada data merujuk site palsu:');
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(2);
  }

  const deleteWhere = [`id GLOB 'site_[0-9]*'`];
  if (extraIds.length > 0) {
    deleteWhere.push(`id IN (${extraIds.map(() => '?').join(',')})`);
  }
  const res = await queryD1(`DELETE FROM sites WHERE ${deleteWhere.join(' OR ')}`, extraIds);
  void res;

  const check = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sites WHERE id GLOB 'site_[0-9]*'`
  );
  const left = check[0]?.n ?? -1;
  console.log(`\nSelesai. Baris palsu tersisa: ${left}`);
  if (left !== 0) process.exit(3);
}

main().catch((err) => {
  console.error('Gagal:', err);
  process.exit(1);
});

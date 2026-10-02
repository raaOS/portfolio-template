#!/usr/bin/env tsx
/**
 * Pembersihan database: sisa kolom/tabel paket Lite/Pro, langganan, dan
 * tabel reset password self-service.
 *
 * Kode (v1.3.15+) sudah tidak membaca maupun menulis jejak berikut:
 *   - kolom `sites.plan`
 *   - kolom `orders.plan`
 *   - tabel `site_subscriptions` (serta index `idx_site_subscriptions_site`)
 *   - tabel `client_password_resets` (fitur reset password self-service sudah dihapus)
 *
 * Skrip ini HANYA menyiapkan eksekusi. Jalankan setelah kode versi baru
 * sudah ter-deploy, supaya kode lama tidak lagi membaca kolom yang dihapus.
 *
 * Run (dry-run, aman):
 *   npx tsx scripts/cloudflare/remove-plan-columns.ts
 *
 * Run (eksekusi ke D1):
 *   npx tsx scripts/cloudflare/remove-plan-columns.ts --apply
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { isD1Configured, getMissingD1EnvKeys, queryD1 } from '../../src/lib/cloudflareD1';

const APPLY = process.argv.includes('--apply');

interface ColumnInfo {
  name: string;
}

interface MasterRow {
  name: string;
}

async function tableColumns(tableName: string): Promise<string[]> {
  const rows = await queryD1<ColumnInfo>(`PRAGMA table_info(${tableName})`);
  return (rows || []).map((row) => row.name);
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await queryD1<MasterRow>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName]
  );
  return Boolean(rows && rows.length > 0);
}

async function indexExists(indexName: string): Promise<boolean> {
  const rows = await queryD1<MasterRow>(
    `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
    [indexName]
  );
  return Boolean(rows && rows.length > 0);
}

async function main() {
  if (!isD1Configured()) {
    console.error(`D1 env belum lengkap. Missing: ${getMissingD1EnvKeys().join(', ')}`);
    process.exit(1);
  }

  const plan: Array<{ label: string; sql: string | null; present: boolean }> = [];

  for (const tableName of ['sites', 'orders']) {
    const columns = await tableColumns(tableName);
    const hasPlan = columns.includes('plan');
    plan.push({
      label: `ALTER TABLE ${tableName} DROP COLUMN plan`,
      sql: hasPlan ? `ALTER TABLE ${tableName} DROP COLUMN plan` : null,
      present: hasPlan,
    });
  }

  const hasSubscriptions = await tableExists('site_subscriptions');
  plan.push({
    label: 'DROP TABLE site_subscriptions',
    sql: hasSubscriptions ? 'DROP TABLE IF EXISTS site_subscriptions' : null,
    present: hasSubscriptions,
  });

  const hasSubscriptionIndex = await indexExists('idx_site_subscriptions_site');
  plan.push({
    label: 'DROP INDEX idx_site_subscriptions_site',
    sql: hasSubscriptionIndex ? 'DROP INDEX IF EXISTS idx_site_subscriptions_site' : null,
    present: hasSubscriptionIndex,
  });

  const hasPasswordResets = await tableExists('client_password_resets');
  plan.push({
    label: 'DROP TABLE client_password_resets',
    sql: hasPasswordResets ? 'DROP TABLE IF EXISTS client_password_resets' : null,
    present: hasPasswordResets,
  });

  console.log('Rencana pembersihan jejak paket Lite/Pro, langganan, dan reset password');
  console.log('----------------------------------------------------');
  for (const step of plan) {
    console.log(`  ${step.present ? '[ada ]' : '[n/a ]'} ${step.label}`);
  }

  const pending = plan.filter((step) => step.sql !== null);
  if (pending.length === 0) {
    console.log('Tidak ada yang perlu dibersihkan. Database sudah bersih.');
    return;
  }

  if (!APPLY) {
    console.log('');
    console.log('Dry-run. Belum ada perubahan. Tambahkan --apply untuk mengeksekusi.');
    return;
  }

  console.log('');
  for (const step of pending) {
    await queryD1(step.sql as string);
    console.log(`  [ok] ${step.label}`);
  }
  console.log('Selesai.');
}

main().catch((err) => {
  console.error('Gagal menjalankan pembersihan:', err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Backfill kepemilikan template untuk klien yang sudah onboard SEBELUM fitur
 * pembelian template (rilis 1.3.92).
 *
 * Yang diisi (idempoten, aman diulang):
 *   1. Katalog `portfolio_templates` di D1 klien (3 template dari registry).
 *   2. Entitlement template yang SEDANG AKTIF di `sites.active_template_key`
 *      (klien sudah membayarnya saat onboarding).
 *   3. Order historis di D1 OWNER untuk pembelian pertama itu, supaya panel
 *      Order & Pembayaran mencatat pendapatannya. Dedupe: kalau sudah ada order
 *      untuk site/template yang sama, tidak dibuat lagi.
 *
 * TIDAK mengubah `sites.active_template_key` dan TIDAK mengubah arsip.
 *
 * Pemakaian:
 *   npx tsx scripts/cloudflare/backfill-template-entitlements.ts                 # dry-run
 *   npx tsx scripts/cloudflare/backfill-template-entitlements.ts --apply
 *   npx tsx scripts/cloudflare/backfill-template-entitlements.ts --apply --no-orders
 *   npx tsx scripts/cloudflare/backfill-template-entitlements.ts --folder 01_gladi-2026-10-24
 *
 * Env owner dibaca dari .env.local (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_API_TOKEN,
 * CLOUDFLARE_D1_DATABASE_ID). Kredensial D1 klien dibaca per folder dari
 * arsip-klien/<folder>/config.env. Tidak ada kredensial yang dicetak.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadProductEnv } from './product-env';
import { parseEnv } from '../onboarding/env-file';
import { clientUrls } from '../onboarding/client-deploy';
import { isSafeArchiveFolderName } from '../onboarding/portal-clients';
import {
  DEFAULT_TEMPLATE_PRICE,
  TEMPLATES,
  ensureTemplateCatalog,
} from '../onboarding/template-purchase';
import { getTemplate } from '../../src/lib/templates/registry';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ARCHIVE_DIR = path.join(ROOT_DIR, 'arsip-klien');
const MIGRATION_TAG = 'migrasi-1.3.92';

type D1Param = string | number | null;

interface D1Result<T> {
  success?: boolean;
  error?: string;
  results?: T[];
}

interface OwnerContext {
  accountId: string;
  apiToken: string;
  databaseId: string;
}

interface SiteRow {
  id: string;
  slug: string | null;
  name: string | null;
  active_template_key: string | null;
  created_at: string | null;
}

interface OrderRow {
  id: string;
  template_id: string | null;
}

function printUsage() {
  console.log('Backfill katalog + kepemilikan template klien lama (dry-run default).');
  console.log('');
  console.log('  npx tsx scripts/cloudflare/backfill-template-entitlements.ts');
  console.log('      → tampilkan rencana, tidak menulis apa pun');
  console.log('  npx tsx scripts/cloudflare/backfill-template-entitlements.ts --apply');
  console.log('      → tulis entitlement + order historis');
  console.log('  Opsi:');
  console.log('    --apply           benar-benar menulis (tanpa ini hanya dry-run)');
  console.log('    --no-orders       hanya katalog + entitlement (tanpa order owner)');
  console.log('    --folder <nama>   batasi ke satu folder arsip');
}

/**
 * Query D1 dengan kredensial EKSPLISIT. Sengaja tidak memakai process.env:
 * skrip ini berpindah antara D1 klien dan D1 owner di proses yang sama.
 */
async function runD1<T = Record<string, unknown>>(
  accountId: string,
  apiToken: string,
  databaseId: string,
  sql: string,
  params: D1Param[] = []
): Promise<T[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const payload = (await res.json().catch(() => null)) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: D1Result<T>[];
  } | null;

  if (!res.ok || !payload?.success) {
    const detail = payload?.errors?.map((error) => error.message).filter(Boolean).join('; ');
    throw new Error(`D1 HTTP ${res.status}: ${detail || 'query gagal'}`);
  }

  const first = payload.result?.[0];
  if (first && first.success === false) {
    throw new Error(first.error || 'statement D1 gagal');
  }
  return first?.results ?? [];
}

function readOwnerContext(): OwnerContext | null {
  loadProductEnv();
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = (
    process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''
  ).trim();
  const databaseId = (process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim();
  if (!accountId || !apiToken || !databaseId) return null;
  return { accountId, apiToken, databaseId };
}

function generateMigrationOrderId(createdAt: string): string {
  const parsed = Date.parse(String(createdAt || '').replace(' ', 'T'));
  const date = Number.isFinite(parsed) ? new Date(parsed) : new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-MIG-${dateStr}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function formatDateTime(value: string | null): string {
  return value && value.trim() ? value : '(tidak tercatat)';
}

interface BackfillPlan {
  folder: string;
  site: SiteRow;
  templateKey: string;
  entitlementExists: boolean;
  orderExists: boolean;
  orderId: string;
  websiteUrl: string;
}

async function buildPlan(
  folder: string,
  config: Record<string, string>,
  clientDbId: string,
  owner: OwnerContext | null,
  withOrders: boolean
): Promise<BackfillPlan> {
  const accountId = config.CLOUDFLARE_ACCOUNT_ID || '';
  const apiToken = config.CLOUDFLARE_API_TOKEN || '';

  const sites = await runD1<SiteRow>(
    accountId,
    apiToken,
    clientDbId,
    'SELECT id, slug, name, active_template_key, created_at FROM sites'
  );

  if (sites.length !== 1) {
    throw new Error(
      `D1 berisi ${sites.length} baris sites (harus tepat 1). Tidak ada yang diubah — periksa database.`
    );
  }

  const site = sites[0];
  const expectedSiteId = (config.CUSTOMER_SITE_ID || '').trim();
  if (expectedSiteId && expectedSiteId !== site.id) {
    throw new Error(
      `CUSTOMER_SITE_ID arsip ("${expectedSiteId}") ≠ id baris sites di D1 ("${site.id}").`
    );
  }

  const templateKey = (site.active_template_key || 'os-desktop').trim();
  if (!getTemplate(templateKey)) {
    throw new Error(
      `Template aktif "${templateKey}" tidak dikenal registry. Perbaiki dulu (portal/CLI), lalu ulangi.`
    );
  }

  const entitlementRows = await runD1<{ id: string }>(
    accountId,
    apiToken,
    clientDbId,
    `SELECT id FROM site_template_entitlements
      WHERE site_id = ? AND template_id = ? LIMIT 1`,
    [site.id, templateKey]
  );

  let orderExists = false;
  if (withOrders) {
    if (!owner) {
      throw new Error(
        'D1 owner tidak siap (env .env.local tidak lengkap) — jalankan dengan --no-orders atau lengkapi env.'
      );
    }
    const slug = site.slug || config.CUSTOMER_SLUG || folder.replace(/^\d+_/, '');
    const orderRows = await runD1<OrderRow>(
      owner.accountId,
      owner.apiToken,
      owner.databaseId,
      `SELECT id, template_id FROM orders
        WHERE site_id = ? OR LOWER(desired_slug) = LOWER(?)`,
      [site.id, slug]
    );
    // Order lama kadang belum punya template_id (sebelum kolom itu dipakai).
    // Anggap itu pembelian pertama klien → jangan bikin order kedua.
    orderExists = orderRows.some(
      (row) => row.template_id === templateKey || row.template_id == null
    );
  }

  return {
    folder,
    site,
    templateKey,
    entitlementExists: entitlementRows.length > 0,
    orderExists,
    orderId: generateMigrationOrderId(site.created_at || ''),
    websiteUrl: clientUrls(config, folder).websiteUrl,
  };
}

async function applyPlan(
  plan: BackfillPlan,
  config: Record<string, string>,
  clientDbId: string,
  owner: OwnerContext | null,
  withOrders: boolean
): Promise<void> {
  const accountId = config.CLOUDFLARE_ACCOUNT_ID || '';
  const apiToken = config.CLOUDFLARE_API_TOKEN || '';

  const clientQuery = (sql: string, params: D1Param[] = []) =>
    runD1(accountId, apiToken, clientDbId, sql, params);

  await ensureTemplateCatalog(clientQuery, { price: DEFAULT_TEMPLATE_PRICE });

  if (!plan.entitlementExists) {
    const purchasedAt =
      plan.site.created_at && plan.site.created_at.trim()
        ? plan.site.created_at
        : new Date().toISOString();

    await clientQuery(
      `INSERT OR IGNORE INTO site_template_entitlements
         (id, site_id, template_id, purchased_at, price, granted_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        `ent-${crypto.randomUUID()}`,
        plan.site.id,
        plan.templateKey,
        purchasedAt,
        DEFAULT_TEMPLATE_PRICE,
        MIGRATION_TAG,
      ]
    );

    const verify = await clientQuery(
      `SELECT id FROM site_template_entitlements
        WHERE site_id = ? AND template_id = ? LIMIT 1`,
      [plan.site.id, plan.templateKey]
    );
    if (verify.length === 0) {
      throw new Error('Entitlement gagal tersimpan (verifikasi baca balik kosong).');
    }
  }

  if (withOrders && !plan.orderExists) {
    if (!owner) throw new Error('D1 owner tidak siap untuk menulis order historis.');

    const now = new Date().toISOString();
    const slug = plan.site.slug || config.CUSTOMER_SLUG || plan.folder.replace(/^\d+_/, '');
    const createdAt =
      plan.site.created_at && plan.site.created_at.trim() ? plan.site.created_at : now;
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await runD1(
      owner.accountId,
      owner.apiToken,
      owner.databaseId,
      `INSERT INTO orders (
         id, site_id, template_id, desired_slug, buyer_name, buyer_email,
         buyer_whatsapp, amount, payment_method, status, site_url,
         provisioned_at, expires_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'migrasi_historis', 'activated', ?, ?, ?, ?, ?)`,
      [
        plan.orderId,
        plan.site.id,
        plan.templateKey,
        slug,
        config.CUSTOMER_NAME || config.CUSTOMER_SLUG || plan.folder,
        config.ADMIN_EMAIL || '',
        '-',
        DEFAULT_TEMPLATE_PRICE,
        plan.websiteUrl,
        createdAt,
        expiresAt,
        createdAt,
        now,
      ]
    );

    const verify = await runD1<{ id: string }>(
      owner.accountId,
      owner.apiToken,
      owner.databaseId,
      'SELECT id FROM orders WHERE id = ? LIMIT 1',
      [plan.orderId]
    );
    if (verify.length === 0) {
      throw new Error('Order historis gagal tersimpan (verifikasi baca balik kosong).');
    }
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help')) {
    printUsage();
    return;
  }

  const apply = rawArgs.includes('--apply');
  const withOrders = !rawArgs.includes('--no-orders');
  const folderIndex = rawArgs.indexOf('--folder');
  const folderFilter = folderIndex >= 0 ? rawArgs[folderIndex + 1] || '' : '';

  const unknown = rawArgs.filter(
    (arg, index) =>
      !['--apply', '--no-orders', '--help', '--folder'].includes(arg) &&
      !(folderIndex >= 0 && index === folderIndex + 1)
  );
  if (unknown.length > 0) {
    console.error(`✗ Argumen tidak dikenal: ${unknown.join(' ')}`);
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(ARCHIVE_DIR)) {
    console.error(`✗ Folder arsip-klien/ tidak ditemukan di ${ROOT_DIR}`);
    process.exit(1);
  }

  const owner = readOwnerContext();
  if (withOrders && !owner) {
    console.error(
      '✗ Order historis diminta, tetapi env owner (.env.local) tidak lengkap: butuh ' +
        'CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID.'
    );
    console.error('  Perbaiki env, atau jalankan dengan --no-orders (hanya entitlement).');
    process.exit(1);
  }

  const folders = fs
    .readdirSync(ARCHIVE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSafeArchiveFolderName(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .filter((name) => (folderFilter ? name === folderFilter : true));

  if (folders.length === 0) {
    console.error(
      folderFilter
        ? `✗ Folder "${folderFilter}" tidak ditemukan di arsip-klien/.`
        : '✗ Tidak ada folder klien di arsip-klien/.'
    );
    process.exit(1);
  }

  console.log('Backfill katalog + kepemilikan template');
  console.log(`Mode        : ${apply ? 'TULIS (--apply)' : 'DRY-RUN (tidak menulis)'}`);
  console.log(`Order owner : ${withOrders ? 'ya' : 'tidak (--no-orders)'}`);
  console.log(`Katalog     : ${TEMPLATES.map((template) => template.id).join(', ')}`);
  console.log(`Harga acuan : Rp${DEFAULT_TEMPLATE_PRICE.toLocaleString('id-ID')}`);
  console.log('');

  let createdEntitlements = 0;
  let skippedEntitlements = 0;
  let createdOrders = 0;
  let skippedOrders = 0;
  const skippedFolders: string[] = [];
  const failures: string[] = [];

  for (const folder of folders) {
    const configPath = path.join(ARCHIVE_DIR, folder, 'config.env');
    if (!fs.existsSync(configPath)) {
      skippedFolders.push(`${folder}: config.env tidak ada`);
      console.log(`[SKIP] ${folder} — config.env tidak ada`);
      continue;
    }

    let config: Record<string, string>;
    try {
      config = parseEnv(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
      failures.push(`${folder}: config.env tidak terbaca (${(error as Error).message})`);
      console.log(`[FAIL] ${folder} — config.env tidak terbaca`);
      continue;
    }

    const clientDbId = config.CLOUDFLARE_D1_DATABASE_ID || '';
    if (!config.CLOUDFLARE_ACCOUNT_ID || !config.CLOUDFLARE_API_TOKEN || !clientDbId) {
      // Arsip lama/owner sendiri (mis. 00_site-owner) tidak punya kredensial D1
      // klien. Itu bukan klien portal — lewati dengan jelas, jangan dihitung gagal.
      skippedFolders.push(`${folder}: kredensial D1 klien tidak ada di config.env`);
      console.log(`[SKIP] ${folder} — kredensial D1 klien tidak ada (bukan klien portal)`);
      continue;
    }

    let plan: BackfillPlan;
    try {
      plan = await buildPlan(folder, config, clientDbId, owner, withOrders);
    } catch (error) {
      failures.push(`${folder}: ${(error as Error).message}`);
      console.log(`[FAIL] ${folder} — ${(error as Error).message}`);
      continue;
    }

    console.log(`[${plan.site.id}] ${folder} (${plan.site.name || 'tanpa nama'})`);
    console.log(`  template aktif : ${plan.templateKey}`);
    console.log(
      `  entitlement    : ${
        plan.entitlementExists ? 'sudah ada — dilewati' : `BARU (Rp${DEFAULT_TEMPLATE_PRICE.toLocaleString('id-ID')}, oleh ${MIGRATION_TAG})`
      }`
    );
    if (withOrders) {
      console.log(
        `  order historis : ${
          plan.orderExists ? 'sudah ada — dilewati' : `BARU ${plan.orderId} (Rp${DEFAULT_TEMPLATE_PRICE.toLocaleString('id-ID')})`
        }`
      );
    } else {
      console.log('  order historis : dilewati (--no-orders)');
    }
    console.log(`  purchased_at   : ${formatDateTime(plan.site.created_at)}`);

    if (plan.entitlementExists) skippedEntitlements += 1;
    else createdEntitlements += 1;

    if (withOrders) {
      if (plan.orderExists) skippedOrders += 1;
      else createdOrders += 1;
    }

    if (!apply) continue;

    try {
      await applyPlan(plan, config, clientDbId, owner, withOrders);
      console.log('  hasil          : OK (terverifikasi baca balik)');
    } catch (error) {
      failures.push(`${folder}: ${(error as Error).message}`);
      console.log(`  hasil          : GAGAL — ${(error as Error).message}`);
    }
  }

  console.log('');
  console.log('Ringkasan rencana:');
  console.log(`  entitlement baru : ${createdEntitlements}`);
  console.log(`  entitlement ada  : ${skippedEntitlements}`);
  if (withOrders) {
    console.log(`  order baru       : ${createdOrders}`);
    console.log(`  order sudah ada  : ${skippedOrders}`);
  }
  console.log(`  gagal            : ${failures.length}`);
  console.log(`  dilewati         : ${skippedFolders.length}`);

  if (!apply) {
    console.log('');
    console.log('DRY-RUN: tidak ada yang ditulis. Jalankan dengan --apply untuk menerapkan.');
  }

  if (failures.length > 0) {
    console.log('');
    console.log('Detail kegagalan:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`✗ Gagal: ${(error as Error).message}`);
  process.exit(1);
});

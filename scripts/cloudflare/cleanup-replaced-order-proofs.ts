#!/usr/bin/env tsx
/**
 * cleanup-replaced-order-proofs.ts
 *
 * Hapus versi LAMA bukti bayar yang diganti (replaced) pada order, di R2
 * prefix `orders/{id}/`. File lama tertinggal setiap kali pembeli mengunggah
 * ulang bukti: D1 `payment_proof_url` menunjuk file baru, tetapi file lama
 * tidak pernah dihapus (lihat tabel retensi bukti bayar di
 * docs/operations/support-playbook.md — pengamatan PK8 v1.3.27).
 *
 * AMAN: satu-satunya referensi file di prefix `orders/{id}/` adalah kolom
 * `payment_proof_url` milik order itu sendiri. File di prefix tersebut yang
 * BUKAN payment_proof_url saat ini tidak direferensikan di mana pun
 * (orderService hanya menghapus seluruh prefix saat cancel/sweep, dan
 * membaca payment_proof_url untuk menampilkan/memeriksa bukti).
 *
 * Cakupan penghapusan (--delete): hanya order status `activated` sesuai
 * izin owner (2026-10-08). Order lain dilaporkan tapi tidak disentuh.
 * Order tanpa payment_proof_url, atau yang current key-nya tidak bisa
 * ditentukan dengan pasti, di-SKIP konservatif.
 *
 * Pemakaian:
 *   npx tsx scripts/cloudflare/cleanup-replaced-order-proofs.ts                 # laporan (dry-run)
 *   npx tsx scripts/cloudflare/cleanup-replaced-order-proofs.ts --delete --yes  # hapus
 */

import { config as loadEnv } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { isD1Configured, getMissingD1EnvKeys, queryD1 } from '../../src/lib/cloudflareD1';
import {
  deleteFromR2,
  isR2StorageConfigured,
  getMissingR2EnvKeys,
  listR2Objects,
} from '../../src/lib/r2Storage';
import { extractStoragePath } from '../../src/lib/urlResolver';

/** Cakupan hapus (izin owner): order yang sudah aktif/terverifikasi. */
const DELETE_SCOPED_STATUS = 'activated';

interface OrderRow {
  id: string;
  status: string;
  payment_proof_url: string | null;
}

interface OrderReport {
  id: string;
  status: string;
  currentKey: string | null;
  replacedKeys: { key: string; size: number }[];
  skipped?: string;
}

function resolveCurrentKey(order: OrderRow): string | null {
  const url = (order.payment_proof_url || '').trim();
  if (!url) return null;
  // Jalur normal: URL publik R2 -> key.
  const direct = extractStoragePath(url);
  if (direct) return direct;
  // Fallback defensif: URL mungkin memakai base URL berbeda dari env —
  // ambil substring key dari pola prefix order itu sendiri.
  const marker = `orders/${order.id}/`;
  const at = url.indexOf(marker);
  if (at >= 0) {
    const withoutQuery = url.slice(at).split('?')[0].split('#')[0];
    return withoutQuery;
  }
  return null;
}

async function buildReport(): Promise<OrderReport[]> {
  const orders = await queryD1<OrderRow>(
    'SELECT id, status, payment_proof_url FROM orders ORDER BY created_at'
  );

  if (orders.length === 0) {
    // Perilaku sama seperti audit-orphan-*: D1 kosong = kemungkinan kegagalan
    // baca, jangan pernah lanjut ke mode hapus.
    throw new Error('D1 mengembalikan 0 order. Kemungkinan kegagalan baca — berhenti.');
  }

  const report: OrderReport[] = [];
  for (const order of orders) {
    const objects = await listR2Objects({ prefix: `orders/${order.id}/` });
    if (objects.length === 0) continue;

    const currentKey = resolveCurrentKey(order);
    const note = !currentKey
      ? order.payment_proof_url?.trim()
        ? 'payment_proof_url ada tapi key-nya tidak terdeteksi'
        : 'payment_proof_url kosong'
      : undefined;

    report.push({
      id: order.id,
      status: order.status,
      currentKey,
      replacedKeys: objects
        .filter((o) => !currentKey || o.key !== currentKey)
        .map((o) => ({ key: o.key, size: o.size })),
      skipped: note,
    });
  }
  return report;
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function printReport(report: OrderReport[]) {
  if (report.length === 0) {
    console.log('Tidak ada file sama sekali di prefix orders/*/ — tidak ada yang perlu dibersihkan.');
    return;
  }
  for (const row of report) {
    const scope = row.status === DELETE_SCOPED_STATUS ? `[Cakupan hapus]` : `[Luas cakupan]`;
    console.log(`\n${scope} ${row.id}  status=${row.status}  current=${row.currentKey ?? '(none)'}`);
    if (row.skipped) console.log(`  ! dilewati: ${row.skipped}`);
    for (const f of row.replacedKeys) {
      console.log(`  - GANTI LAMA: ${f.key}  (${humanSize(f.size)})`);
    }
  }
  const inScope = report.filter((r) => r.status === DELETE_SCOPED_STATUS && !r.skipped);
  const candidates = inScope.flatMap((r) => r.replacedKeys);
  const outScopeFiles = report
    .filter((r) => r.status !== DELETE_SCOPED_STATUS)
    .flatMap((r) => r.replacedKeys);
  console.log(`\nTotal order punya file : ${report.length}`);
  console.log(`Kandidat hapus (${DELETE_SCOPED_STATUS}): ${candidates.length} file`);
  console.log(`Di luar cakupan (tidak disentuh): ${outScopeFiles.length} file`);
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function deleteReplaced(report: OrderReport[], skipConfirm: boolean): Promise<void> {
  const targets = report.filter(
    (r) => r.status === DELETE_SCOPED_STATUS && !r.skipped && r.replacedKeys.length > 0
  );
  const files = targets.flatMap((r) => r.replacedKeys.map((f) => f.key));

  if (files.length === 0) {
    console.log('Tidak ada file untuk dihapus (cakupan aktif bersih).');
    return;
  }

  console.log(`\nAkan menghapus ${files.length} file dari R2 (order ${DELETE_SCOPED_STATUS}):`);
  for (const key of files) console.log(`  - ${key}`);

  if (!skipConfirm) {
    const ok = await confirm('Lanjut hapus permanen?');
    if (!ok) {
      console.log('Dibatalkan.');
      return;
    }
  }

  let deleted = 0;
  let failed = 0;
  for (const key of files) {
    try {
      await deleteFromR2(key);
      console.log(`  ✓ deleted ${key}`);
      deleted++;
    } catch (e) {
      console.error(`  ✗ failed ${key}: ${(e as Error).message}`);
      failed++;
    }
  }

  // Mutasi -> Baca Ulang: daftar ulang prefix order yang disentuh,
  // pastikan file current masih ada dan file lama sudah hilang.
  console.log('\nBaca ulang setelah mutasi:');
  for (const row of targets) {
    const after = await listR2Objects({ prefix: `orders/${row.id}/` });
    const keys = after.map((o) => o.key);
    const currentStillThere = row.currentKey ? keys.includes(row.currentKey) : keys.length === 0;
    const status = currentStillThere ? 'OK' : 'PERIKSA!';
    console.log(`  ${row.id}: sisa ${keys.length} file (current ${currentStillThere ? 'ada' : 'HILANG?'}) -> ${status}`);
    for (const k of keys) console.log(`      ${k}`);
  }

  console.log(`\nDone. deleted=${deleted}, failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const wantDelete = args.has('--delete');
  const skipConfirm = args.has('--yes') || args.has('-y');

  if (!isR2StorageConfigured()) {
    throw new Error(`Cloudflare R2 env tidak lengkap. Missing: ${getMissingR2EnvKeys().join(', ')}`);
  }
  if (!isD1Configured()) {
    throw new Error(`Cloudflare D1 env tidak lengkap. Missing: ${getMissingD1EnvKeys().join(', ')}`);
  }

  const report = await buildReport();
  printReport(report);

  if (wantDelete) {
    await deleteReplaced(report, skipConfirm);
  } else if (report.some((r) => r.status === DELETE_SCOPED_STATUS && r.replacedKeys.length > 0)) {
    // Ada kandidat tapi belum mode hapus.
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

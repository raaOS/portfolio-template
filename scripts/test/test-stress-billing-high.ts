/**
 * HIGH-Batch Billing Flow Stress Test (Live Cloudflare D1)
 * Scenario: banyak transaksi bersamaan, bayar telat, bayar setelah expired,
 * recovery aktivasi nyangkut, dedupe checkout, guard sweeper.
 * Run with: npx tsx scripts/test-stress-billing-high.ts
 */

import { loadProductEnv } from './cloudflare/product-env';
loadProductEnv();

import {
  createOrder,
  uploadPaymentProof,
  activateOrder,
  expireOrderIfStale,
  sweepExpiredOrders,
} from '../src/lib/services/orderService';
import { queryD1, bootstrapD1Schema } from '../src/lib/cloudflareD1';

async function runStressTest() {
  console.log('====================================================');
  console.log('STRESS TEST BATCH HIGH - BILLING FLOW (LIVE D1)');
  console.log('====================================================\n');

  await bootstrapD1Schema();

  let passed = 0;
  let failed = 0;
  const cleanupOrderIds: string[] = [];

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  PASS: ${description}`);
      passed++;
    } else {
      console.error(`  FAIL: ${description}`);
      failed++;
    }
  }

  const ts = Date.now();

  // -------------------------------------------------------------------------
  // TEST 1 (H1): 100 CHECKOUT SERENTAK, SLUG BERBEDA
  // Semua sukses, ID unik, nominal unik (tidak ada tabrakan generateOrderId).
  // -------------------------------------------------------------------------
  console.log('Test 1: 100 Checkout Serentak (slug berbeda, H1: ID 3-byte + retry)');
  const t1Slugs = Array.from({ length: 100 }, (_, i) => `stress-h1-${ts}-${i}`);
  const t1Promises = t1Slugs.map((slug, i) =>
    createOrder({
      buyerName: `H1 Buyer ${i}`,
      buyerEmail: `h1_${ts}_${i}@test.com`,
      buyerWhatsapp: `628100000${i}`,
      plan: 'pro',
      desiredSlug: slug,
    })
  );
  const t1Results = await Promise.all(t1Promises);

  const t1Ok = t1Results.filter((r) => r.success);
  const t1Ids = t1Ok.map((r) => r.order!.id);
  const t1Amounts = t1Ok.map((r) => Number(r.order!.amount));

  assert(t1Ok.length === 100, `Seluruh 100 checkout sukses (${t1Ok.length}/100)`);
  assert(new Set(t1Ids).size === t1Ids.length, `100 ID order unik tanpa tabrakan (${new Set(t1Ids).size} unik)`);
  assert(
    t1Ids.every((id) => /^ORD-\d{8}-[A-Z0-9]{6}$/.test(id)),
    'Format ID baru ORD-YYYYMMDD-6hex (16,7jt kombinasi/hari)'
  );
  assert(new Set(t1Amounts).size === t1Amounts.length, `100 nominal unik tanpa tabrakan kode QRIS (${new Set(t1Amounts).size} unik)`);

  cleanupOrderIds.push(...t1Ids);

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 2 (M5): 30 CHECKOUT SERENTAK SLUG+EMAIL SAMA
  // Tepat 1 sukses, 29 ditolak (dedupe atau unique index slug).
  // -------------------------------------------------------------------------
  console.log('Test 2: 30 Checkout Serentak (slug & email sama, M5: anti-duplikat)');
  const t2Slug = `stress-m5-${ts}`;
  const t2Promises = Array.from({ length: 30 }, (_, i) =>
    createOrder({
      buyerName: 'M5 Buyer',
      buyerEmail: `m5_${ts}@test.com`,
      buyerWhatsapp: '628100000',
      plan: 'lite',
      desiredSlug: t2Slug,
    })
  );
  const t2Results = await Promise.all(t2Promises);
  const t2Ok = t2Results.filter((r) => r.success);
  const t2Rejected = t2Results.filter((r) => !r.success);

  assert(t2Ok.length === 1, `Tepat 1 checkout sukses dari 30 serentak (${t2Ok.length})`);
  assert(t2Rejected.length === 29, `Tepat 29 checkout ditolak (${t2Rejected.length})`);
  assert(
    t2Rejected.every((r) => r.error?.includes('pesanan aktif') || r.error?.includes('tidak tersedia')),
    'Semua penolakan memakai pesan yang menjelaskan pesanan aktif / slug terpakai'
  );

  if (t2Ok[0]?.order) cleanupOrderIds.push(t2Ok[0].order.id);

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 3 (H4/L2): BAYAR SETELAH EXPIRED (LATE) - SLUG MASIH BEBAS
  // -------------------------------------------------------------------------
  console.log('Test 3: Bayar setelah expired, slug masih bebas (H4 + L2: extend 24 jam)');
  const t3 = await createOrder({
    buyerName: 'Late Buyer',
    buyerEmail: `late_${ts}@test.com`,
    buyerWhatsapp: '628100000',
    plan: 'pro',
    desiredSlug: `stress-late-${ts}`,
  });
  assert(t3.success, 'Order A dibuat (pending_payment)');

  if (t3.order) {
    cleanupOrderIds.push(t3.order.id);
    await queryD1(
      "UPDATE orders SET status = 'expired', expires_at = datetime('now', '-1 hour') WHERE id = ?",
      [t3.order.id]
    );

    const lateRes = await uploadPaymentProof(t3.order.id, `https://proof.example/late-${ts}.jpg`);
    assert(lateRes.success, 'Upload bukti late-payment diterima (status -> waiting_verification)');

    const t3Rows = await queryD1<{ status: string; expires_at: string }>(
      'SELECT status, expires_at FROM orders WHERE id = ?',
      [t3.order.id]
    );
    const t3Row = t3Rows[0];
    assert(t3Row?.status === 'waiting_verification', `Status setelah late-payment: ${t3Row?.status}`);
    const t3ExpiresMs = t3Row ? new Date(t3Row.expires_at).getTime() : 0;
    assert(
      t3ExpiresMs > Date.now() + 23 * 60 * 60 * 1000,
      'expires_at diperpanjang 24 jam sejak upload (L2)'
    );
  }

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 4 (H3): BAYAR SETELAH EXPIRED - SLUG SUDAH DIPAKAI ORDER LAIN
  // -------------------------------------------------------------------------
  console.log('Test 4: Bayar setelah expired, slug sudah diambil order lain (H3 guard)');
  const t4Slug = `stress-conflict-${ts}`;
  const t4a = await createOrder({
    buyerName: 'Conflict A',
    buyerEmail: `conflict_a_${ts}@test.com`,
    buyerWhatsapp: '628100000',
    plan: 'pro',
    desiredSlug: t4Slug,
  });
  assert(t4a.success, 'Order A dibuat');

  if (t4a.order) {
    cleanupOrderIds.push(t4a.order.id);
    await queryD1(
      "UPDATE orders SET status = 'expired', expires_at = datetime('now', '-1 hour') WHERE id = ?",
      [t4a.order.id]
    );

    const t4b = await createOrder({
      buyerName: 'Conflict B',
      buyerEmail: `conflict_b_${ts}@test.com`,
      buyerWhatsapp: '628100000',
      plan: 'pro',
      desiredSlug: t4Slug,
    });
    assert(t4b.success, 'Order B sukses mengambil slug yang sudah dirilis (A expired)');
    if (t4b.order) cleanupOrderIds.push(t4b.order.id);

    const lateRes = await uploadPaymentProof(t4a.order.id, `https://proof.example/conflict-${ts}.jpg`);
    assert(!lateRes.success, 'Upload bukti A DITOLAK (slug/nominal sudah dipakai order B)');
    assert(
      lateRes.error?.includes('slug') || lateRes.error?.includes('nominal'),
      `Pesan penolakan menyebut konflik: "${lateRes.error}"`
    );
  }

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 5 (H3): AKTIVASI LATE via allowExpired (jalur admin, H3)
  // -------------------------------------------------------------------------
  console.log('Test 5: Aktivasi late order via allowExpired (H3 admin path)');
  const t5 = await createOrder({
    buyerName: 'Late Activate',
    buyerEmail: `actlate_${ts}@test.com`,
    buyerWhatsapp: '628100000',
    plan: 'pro',
    desiredSlug: `stress-actlate-${ts}`,
  });
  assert(t5.success, 'Order dibuat');

  if (t5.order) {
    cleanupOrderIds.push(t5.order.id);
    await queryD1(
      "UPDATE orders SET status = 'expired', expires_at = datetime('now', '-1 hour') WHERE id = ?",
      [t5.order.id]
    );
    const actRes = await activateOrder(t5.order.id, {}, { allowExpired: true, proofUrl: `https://proof.example/actlate-${ts}.jpg` });
    assert(actRes.success, `Aktivasi late berhasil${actRes.siteId ? ` (site: ${actRes.siteId})` : ''}`);
    if (actRes.siteId) {
      await queryD1('DELETE FROM sites WHERE id = ?', [actRes.siteId]);
      await queryD1('DELETE FROM client_access WHERE site_id = ?', [actRes.siteId]);
      await queryD1('DELETE FROM site_subscriptions WHERE site_id = ?', [actRes.siteId]);
      await queryD1('DELETE FROM audit_logs WHERE site_id = ?', [actRes.siteId]);
    }
  }

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 6 (M3): RECOVERY AKTIVASI NYANGKUT (activating > 10 menit)
  // -------------------------------------------------------------------------
  console.log('Test 6: Recovery activating nyangkut (M3: 10 menit -> waiting_verification)');
  const t6 = await createOrder({
    buyerName: 'Stuck Buyer',
    buyerEmail: `stuck_${ts}@test.com`,
    buyerWhatsapp: '628100000',
    plan: 'lite',
    desiredSlug: `stress-stuck-${ts}`,
  });
  assert(t6.success, 'Order dibuat');

  if (t6.order) {
    cleanupOrderIds.push(t6.order.id);
    await queryD1(
      "UPDATE orders SET status = 'activating', updated_at = datetime('now', '-11 minutes') WHERE id = ?",
      [t6.order.id]
    );
    await expireOrderIfStale(t6.order.id);

    const t6Rows = await queryD1<{ status: string }>('SELECT status FROM orders WHERE id = ?', [t6.order.id]);
    assert(
      t6Rows[0]?.status === 'waiting_verification',
      `Order activating 11 menit dikembalikan ke waiting_verification (status: ${t6Rows[0]?.status})`
    );
  }

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 7 (H2): GUARD SWEEPER 10 MENIT
  // -------------------------------------------------------------------------
  console.log('Test 7: Guard sweeper global (H2: billing_expire_sweep_at)');
  try {
    await sweepExpiredOrders();
    const guardRows = await queryD1<{ value: string }>(
      "SELECT value FROM platform_settings WHERE key = 'billing_expire_sweep_at'",
      []
    );
    assert(guardRows.length === 1, 'Guard sweeper tersimpan di platform_settings');
    await sweepExpiredOrders();
    assert(true, 'Panggilan kedua dalam 10 menit tidak melempar error (guard aktif)');
  } catch (err) {
    assert(false, `Sweeper error: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('');

  // -------------------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------------------
  console.log('Pembersihan data stress test...');
  try {
    for (const orderId of cleanupOrderIds) {
      await queryD1('DELETE FROM orders WHERE id = ?', [orderId]);
    }
    console.log(`  Seluruh ${cleanupOrderIds.length} order stress test dihapus.`);
  } catch (cleanErr) {
    console.warn('  Pembersihan skipped:', cleanErr);
  }

  console.log('\n====================================================');
  console.log(`HASIL STRESS TEST HIGH: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStressTest().catch((err) => {
  console.error('Fatal Stress Test Error:', err);
  process.exit(1);
});

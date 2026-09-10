/**
 * High-Concurrency Stress Test Script for Remediation Fixes
 * Tests Cloudflare D1 under heavy parallel load (Race conditions, Slug Collisions, UPSERT locks).
 * Run with: npx tsx scripts/test-stress-remediation.ts
 */

import { loadProductEnv } from './cloudflare/product-env';
loadProductEnv();

import { createOrder, verifyOrderAccessToken } from '../src/lib/services/orderService';
import { analyticsService } from '../src/lib/services/analyticsService';
import { queryD1, bootstrapD1Schema } from '../src/lib/cloudflareD1';

async function runStressTest() {
  console.log('====================================================');
  console.log('🔥 MENJALANKAN STRESS TEST KONKURENSI LANGSUNG (LIVE D1)');
  console.log('====================================================\n');

  await bootstrapD1Schema();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // STRESS TEST 1: CONCURRENT SLUG COLLISION (20 SIMULTANEOUS CHECKOUTS)
  // -------------------------------------------------------------------------
  console.log('📌 Stress Test 1: 20 Simultaneous Checkouts with the SAME Slug');
  const stressSlug = `stress-slug-${Date.now()}`;
  const createdOrderIds: string[] = [];

  const checkoutPromises = Array.from({ length: 20 }, (_, i) =>
    createOrder({
      buyerName: `Stress Buyer ${i + 1}`,
      buyerEmail: `stress_${i + 1}@test.com`,
      buyerWhatsapp: `6281000${i + 1}`,
      plan: 'pro',
      desiredSlug: stressSlug,
    })
  );

  const checkoutResults = await Promise.all(checkoutPromises);
  const successfulCheckouts = checkoutResults.filter((r) => r.success);
  const rejectedCheckouts = checkoutResults.filter((r) => !r.success);

  for (const r of successfulCheckouts) {
    if (r.order?.id) createdOrderIds.push(r.order.id);
  }

  assert(
    successfulCheckouts.length === 1,
    `Tepat 1 checkout berhasil dari 20 request serentak (Hasil: ${successfulCheckouts.length} sukses)`
  );
  assert(
    rejectedCheckouts.length === 19,
    `Tepat 19 checkout ditolak karena Slug Collision (Hasil: ${rejectedCheckouts.length} ditolak)`
  );
  assert(
    rejectedCheckouts.every((r) => r.error?.includes('tidak tersedia')),
    'Seluruh 19 request yang ditolak mendapatkan pesan error Zero Slug Collision yang tepat'
  );

  console.log('');

  // -------------------------------------------------------------------------
  // STRESS TEST 2: CONCURRENT ANALYTICS WRITE (50 SIMULTANEOUS RECORD HITS)
  // -------------------------------------------------------------------------
  console.log('📌 Stress Test 2: 50 Simultaneous Analytics Hits (D1 UPSERT Lock)');
  const stressSiteId = `site_stress_analytics_${Date.now()}`;

  const analyticsPromises = Array.from({ length: 50 }, () =>
    analyticsService.recordHit(stressSiteId, 'page_view')
  );

  const analyticsResults = await Promise.all(analyticsPromises);
  const successfulHits = analyticsResults.filter((r) => r === true);

  assert(
    successfulHits.length === 50,
    `Seluruh 50 hit analitik serentak berhasil diproses (Hasil: ${successfulHits.length}/50)`
  );

  const summary = await analyticsService.getSummary(stressSiteId);
  assert(
    summary.totalViews === 50,
    `Total views di D1 persisten sesuai 100% dengan akumulasi 50 hits (Dibutuhkan: 50, D1: ${summary.totalViews})`
  );

  console.log('');

  // -------------------------------------------------------------------------
  // STRESS TEST 3: CONCURRENT ACCESS TOKEN VERIFICATION (30 PARALLEL CHECKS)
  // -------------------------------------------------------------------------
  console.log('📌 Stress Test 3: 30 Parallel Access Token Verifications');
  if (successfulCheckouts[0]?.order?.id && successfulCheckouts[0]?.accessToken) {
    const validToken = successfulCheckouts[0].accessToken;
    const orderId = successfulCheckouts[0].order.id;

    const tokenPromises = Array.from({ length: 30 }, () =>
      verifyOrderAccessToken(orderId, validToken)
    );

    const tokenResults = await Promise.all(tokenPromises);
    const validPasses = tokenResults.filter((r) => r === true);

    assert(
      validPasses.length === 30,
      `Seluruh 30 verifikasi SHA-256 token serentak berhasil (Hasil: ${validPasses.length}/30)`
    );
  } else {
    assert(false, 'Stress Test 3 skipped (No order created in Test 1)');
  }

  console.log('');

  // -------------------------------------------------------------------------
  // CLEANUP STRESS DATA
  // -------------------------------------------------------------------------
  console.log('🧹 Pembersihan Data Stress Test di Cloudflare D1...');
  try {
    for (const orderId of createdOrderIds) {
      await queryD1('DELETE FROM orders WHERE id = ?', [orderId]);
    }
    await queryD1('DELETE FROM site_analytics WHERE site_id = ?', [stressSiteId]);
    await queryD1('DELETE FROM audit_logs WHERE site_id = ?', [stressSiteId]);
    console.log('  ✅ Seluruh data stress test di Cloudflare D1 berhasil dibersihkan.');
  } catch (cleanErr) {
    console.warn('  ⚠️ Pembersihan data stress test skipped:', cleanErr);
  }

  console.log('\n====================================================');
  console.log(`📊 HASIL STRESS TEST CLOUDFLARE D1: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStressTest().catch((err) => {
  console.error('Fatal Stress Test Error:', err);
  process.exit(1);
});

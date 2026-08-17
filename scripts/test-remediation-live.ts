/**
 * Direct Live Cloudflare D1 Integration Test Script
 * Tests the real Cloudflare D1 Database using actual REST API queries.
 * Run with: npx tsx scripts/test-remediation-live.ts
 */

import { loadProductEnv } from './cloudflare/product-env';
loadProductEnv();

import { createOrder, uploadPaymentProof, verifyOrderAccessToken } from '../src/lib/services/orderService';
import { analyticsService } from '../src/lib/services/analyticsService';
import { isSlugAvailable, validateSlugFormat } from '../src/lib/services/slugService';
import { normalizeCustomDomain } from '../src/lib/services/customDomainService';
import { queryD1, bootstrapD1Schema } from '../src/lib/cloudflareD1';

async function runLiveD1Tests() {
  console.log('====================================================');
  console.log('⚡ MENJALANKAN VERIFIKASI LANGSUNG KE CLOUDFLARE D1 (LIVE DB)');
  console.log('====================================================\n');

  // Ensure DB schema & indexes are applied live
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
  // TEST 1: FIX #3 - Real Order Creation, Token Generation & D1 Query
  // -------------------------------------------------------------------------
  console.log('📌 Test 1: Real Order Creation & Access Token Verification (Cloudflare D1)');
  let testOrderId: string | undefined;
  let testAccessToken: string | undefined;
  const testSlug = `real-d1-test-${Date.now()}`;

  try {
    const orderRes = await createOrder({
      buyerName: 'Direct D1 Buyer',
      buyerEmail: 'd1test@makeitbetter.my.id',
      buyerWhatsapp: '628999000111',
      plan: 'pro',
      desiredSlug: testSlug
    });

    assert(orderRes.success === true, 'createOrder sukses menulis ke Cloudflare D1');
    assert(typeof orderRes.accessToken === 'string' && orderRes.accessToken.length === 64, 'Capability access token 64 hex char dihasilkan');
    assert(orderRes.order !== undefined && orderRes.order.id.startsWith('ORD-'), 'Order ID tersimpan di D1 dengan format ORD-');

    if (orderRes.order && orderRes.accessToken) {
      testOrderId = orderRes.order.id;
      testAccessToken = orderRes.accessToken;

      const validTokenCheck = await verifyOrderAccessToken(testOrderId, testAccessToken);
      assert(validTokenCheck === true, 'verifyOrderAccessToken memverifikasi SHA-256 hash dari D1 secara akurat');

      const invalidTokenCheck = await verifyOrderAccessToken(testOrderId, 'token_palsu_1234567890123456789012345678901234567890123456789012345678901234');
      assert(invalidTokenCheck === false, 'verifyOrderAccessToken menolak token palsu');

      const proofRes = await uploadPaymentProof(testOrderId, 'https://example.com/live-proof.jpg');
      assert(proofRes.success === true, 'uploadPaymentProof berhasil memperbarui status order ke waiting_verification di D1');
    }
  } catch (err) {
    assert(false, `Test 1 mengalami exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 2: FIX #5 - Real Unique Index Constraint Guard on Orders (D1)
  // -------------------------------------------------------------------------
  console.log('📌 Test 2: Real Slug Collision Guard pada Cloudflare D1 Index');
  try {
    const duplicateOrderRes = await createOrder({
      buyerName: 'Attacker Duplicate',
      buyerEmail: 'attacker@makeitbetter.my.id',
      buyerWhatsapp: '628999000222',
      plan: 'pro',
      desiredSlug: testSlug // Slug yang sama dengan test 1
    });

    assert(duplicateOrderRes.success === false, 'Cloudflare D1 menolak order dengan slug yang sudah aktif (Partial Unique Index)');
    assert(duplicateOrderRes.error?.includes('tidak tersedia') === true, 'Pesan error Zero Slug Collision sesuai');
  } catch (err) {
    assert(false, `Test 2 mengalami exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('');

  // -------------------------------------------------------------------------
  // TEST 3: FIX #6 - Real Site Analytics D1 Write & Aggregated Read
  // -------------------------------------------------------------------------
  console.log('📌 Test 3: Real Site Analytics UPSERT & Read (Cloudflare D1)');
  const testSiteId = `live_site_analytics_${Date.now()}`;
  try {
    const initialSummary = await analyticsService.getSummary(testSiteId);
    assert(initialSummary.totalViews === 0, 'Site baru di D1 mengembalikan baseline totalViews == 0 (tanpa data 42 fiktif)');

    await analyticsService.recordHit(testSiteId, 'page_view');
    await analyticsService.recordHit(testSiteId, 'page_view');
    await analyticsService.recordHit(testSiteId, 'project_view', 'real-project-bento');
    await analyticsService.recordHit(testSiteId, 'app_view', 'Explorer');

    const updatedSummary = await analyticsService.getSummary(testSiteId);
    assert(updatedSummary.totalViews === 2, 'D1 site_analytics berhasil mengagregasi 2 page_views');
    assert(updatedSummary.uniqueProjectsCount === 1, 'D1 site_analytics merekam 1 project view');
    assert(updatedSummary.topProjects[0]?.slug === 'real-project-bento', 'D1 merekam project terpopuler "real-project-bento"');
  } catch (err) {
    assert(false, `Test 3 mengalami exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('');

  // -------------------------------------------------------------------------
  // CLEANUP TEST DATA IN LIVE D1
  // -------------------------------------------------------------------------
  console.log('🧹 Pembersihan Data Uji di Cloudflare D1...');
  try {
    if (testOrderId) {
      await queryD1('DELETE FROM orders WHERE id = ?', [testOrderId]);
    }
    await queryD1('DELETE FROM site_analytics WHERE site_id = ?', [testSiteId]);
    await queryD1('DELETE FROM audit_logs WHERE site_id = ?', [testSiteId]);
    console.log('  ✅ Data uji sementara di Cloudflare D1 berhasil dibersihkan.');
  } catch (cleanErr) {
    console.warn('  ⚠️ Pembersihan data uji skipped:', cleanErr);
  }

  console.log('\n====================================================');
  console.log(`📊 HASIL VERIFIKASI LANGSUNG CLOUDFLARE D1: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveD1Tests().catch((err) => {
  console.error('Fatal D1 Live Test Execution Error:', err);
  process.exit(1);
});

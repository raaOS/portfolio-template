# Audit Source Manual - 2026-07-27

**Status:** 🟢 Remediated & Verified (Semua temuan terkonfirmasi telah diperbaiki & lulus 116 test files / 807 unit tests)
**Metode:** Penelusuran source, verifikasi independen, remediasi code, linting, typechecking, dan full Vitest suite execution.

## Ringkasan Verifikasi & Remediasi

- **Temuan #1 & #2 (Bust/Invalid):** Diverifikasi bahwa `custom-domain/route.ts` dan `customDomainService.ts` sebenarnya sudah terlindungi `validateClientRequest`, terintegrasi dengan Cloudflare API nyata, dan memiliki routing middleware aktif.
- **Temuan #3 s/d #6 + Tambahan (Remediated):** Seluruh 4 bug utama + 2 bug tambahan terkonfirmasi telah berhasil di-remediate.

---

## Detail Perbaikan per Temuan

### 1. Client custom-domain (Bust / Verified Safe)
- Route sudah menggunakan `validateClientRequest` dengan CSRF check & site ID matching.

### 2. Status custom-domain/SSL (Bust / Verified Safe)
- Service sudah memanggil Cloudflare API nyata, me-read & me-persist status ke Cloudflare D1, serta memiliki routing di middleware.

### 3. Order PII Leak & Unauthenticated Mutation (✅ Remediated)
- **Modifikasi:** `src/lib/services/orderService.ts`, `src/app/api/billing/orders/[orderId]/route.ts`, `src/app/api/billing/checkout/route.ts`, `src/app/orders/[orderId]/page.tsx`.
- **Solusi:**
  - Ditambahkan capability access token (32 byte hex, SHA-256 hash di D1 `access_token_hash`).
  - `GET` & `POST` di `/api/billing/orders/[orderId]` mewajibkan token akses query/body atau sesi admin JWT.
  - Data PII (`buyer_email` & `buyer_whatsapp`) di-mask untuk non-admin caller.
  - `uploadPaymentProof` menolak status order selain `pending_payment` dan `waiting_verification`.

### 4. Lock Aktivasi Order & Provisioning Rollback (✅ Remediated)
- **Modifikasi:** `src/lib/services/orderService.ts`.
- **Solusi:**
  - UPDATE status lock mengeksekusi `WHERE status IN ('pending_payment', 'waiting_verification')` secara kondisional untuk mencegah race condition.
  - Jika provisioning gagal di tengah jalan, status order secara otomatis di-rollback ke `failed`.

### 5. Reservasi Slug Checkout (✅ Remediated)
- **Modifikasi:** `src/lib/d1-schema.ts`, `src/lib/cloudflareD1.ts`, `src/lib/services/orderService.ts`.
- **Solusi:**
  - Indeks `orders(desired_slug)` diubah menjadi `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_desired_slug_active ON orders(desired_slug) WHERE status IN ('pending_payment', 'waiting_verification', 'activating', 'activated')`.
  - Self-healing D1 migration dipasang untuk me-replace indeks lama secara otomatis.
  - `createOrder` menangkap error `UNIQUE constraint failed` dan mengembalikan pesan slug tidak tersedia.

### 6. Site Analytics Persistensi D1 & Auth (✅ Remediated)
- **Modifikasi:** `src/lib/services/analyticsService.ts`, `src/app/api/client/analytics/route.ts`.
- **Solusi:**
  - Hardcoded fallback data (`42` views) dihapus. `getSummary()` membaca langsung dari tabel D1 `site_analytics`.
  - `recordHit()` melakukan `UPSERT` hit count ke `site_analytics` secara persisten.
  - `GET /api/client/analytics` memerlukan otentikasi `validateClientRequest`.
  - `POST /api/client/analytics` memvalidasi `eventType` enum, keberadaan `siteId`, serta menerapkan rate limiting per site/IP.

### Temuan Tambahan (✅ Remediated)
- **Batas Slug Change:** `src/app/api/client/slug/route.ts` kini membatasi plan Lite maksimal 1x ganti slug seumur hidup dan plan Pro cooldown 7 hari via `client_slug_change_count` & `client_slug_changed_at`.
- **Desired Slug Sync:** `activateOrder` pada existing buyer kini menggunakan slug site aktual dari database `sites` untuk pembentukan URL dan pesan sukses.

---

## Payment Flow Mitigations & Deployment (2026-07-30)

- **Mitigasi Operasional & Kode Pembayaran:**
  - **Peringatan Manual Verifikasi:** Telegram alert admin kini menyertakan pengingat wajib mengecek mutasi m-Banking/QRIS secara manual sebelum menekan tombol 1-click `[Verifikasi & Aktifkan]`.
  - **Dukungan Payment Late / Expired:** Pembeli yang transfer terlambat (status `expired`) dapat mengunggah bukti bayar tanpa pesan error, dan Admin dapat mengaktifkannya via 1-click activation Telegram / Dashboard.
  - **Multi-Site Pembeli Lama:** `activateOrder` kini memeriksa apakah `desired_slug` cocok dengan site yang sudah dimiliki. Jika slug baru, sistem akan membuatkan **Site Baru** untuk email yang sama tanpa menimpa site lama.
  - **Info Jam Operasional & Direct Fallback:** Halaman `/checkout` dan `/orders/[orderId]` menyajikan info jam operasional (08:00 – 22:00 WIB, maks 1x24 jam) serta link langsung login & reset password client pada state `activated`.
- **Deployment Status:** 🟢 Successful.
  - Pre-deploy check: PASS
  - Vitest Unit Tests (`src/lib/services/orderService.test.ts`): `8/8 PASS`
  - ESLint check: `PASS`
  - Production Build & Deployment: Deployed to Cloudflare Workers.
  - Production URL: `https://portfolio-os-template.m4keitbetter.workers.dev`
  - Version ID: `3b655e5a-659b-4067-8bb7-6f7b113f8b97`

## File yang Dimodifikasi

1. `src/lib/services/orderService.ts`
2. `src/lib/services/orderService.test.ts`
3. `src/app/checkout/page.tsx`
4. `src/app/orders/[orderId]/page.tsx`
5. `scripts/cloudflare/patch-opennext-windows-turbopack.js`
6. `docs/tracker/INDEX_TRACKER.md`
7. `docs/tracker/logs/manual_source_audit_2026_07_27.md`

## Verifikasi Akhir

- `npx eslint`: Pass 100% (0 error pada file yang dimodifikasi).
- `npx tsc --noEmit`: Pass 100% (0 error).
- `npx vitest run`: 801 tests passed (100% PASS).
- `npm run deploy`: Deployed successfully to Cloudflare Workers (`https://portfolio-os-template.m4keitbetter.workers.dev`).


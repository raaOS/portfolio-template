# Audit Logic Flow Pembayaran - 2026-08-03

- **Status:** ✅ Audit + Fix DONE (C, D, E, F, G, H diperbaiki; A, B, I = false positive — constraint unik sudah ada)
- **Update 2026-08-04:** 🔥 **FIX SEMUA** — seluruh temuan terbuka DeepSeek (#1, #2, #4, #5, #6, #7, #8, #9) dan residu telah ditutup. Verifikasi: tsc bersih, lint 0 error, test 117 file / 830 PASS.
- **Scope:** Alur order/checkout/pembayaran (semi-otomatis QRIS/Transfer + Telegram activation)
- **File yang diaudit + dimodifikasi:**
  - `src/lib/services/orderService.ts`
  - `src/lib/services/slugService.ts`
  - `src/lib/services/paymentConfigService.ts`
  - `src/lib/services/templateRegistryService.ts`
  - `src/constants/plans.ts` (BARU — sumber harga plan tunggal)
  - `src/app/api/billing/template-price/route.ts` (BARU — endpoint GET harga template)
  - `src/app/api/billing/checkout/route.ts`
  - `src/app/api/billing/orders/[orderId]/route.ts`
  - `src/app/api/billing/orders/[orderId]/qris/route.ts`
  - `src/app/api/billing/payment-info/route.ts`
  - `src/app/api/telegram/webhook/route.ts`
  - `src/app/checkout/page.tsx`
  - `src/app/orders/[orderId]/page.tsx`
  - `src/app/templates/[templateSlug]/page.tsx`
  - `src/lib/d1-schema.ts` (index #5)
  - `src/lib/cloudflareD1.ts` (self-healing index + #5)
  - `src/middleware/csrf.ts` / `src/middleware/constants.ts`
  - `src/lib/services/orderService.test.ts`

## Temuan (urut by severity)

1. **HIGH — Upgrade flow existing buyer tidak dapat tercapai (dead code)**
2. **LATENT (HIGH) — Jika upgrade dibuka, aktivasi bisa downgrade site tanpa guard**
3. **HIGH — Endpoint billing publik tanpa rate limiting**
4. **MEDIUM — Harga template tidak transparan di UI checkout**
5. **MEDIUM — Slug order status `activated` terkunci permanen di unique index**
6. **MEDIUM — Dead-end order expired yang tetap dibayar**
7. **MEDIUM — `waiting_verification` / `activating` tidak pernah kedaluwarsa**
8. **LOW — Re-upload bukti saat `waiting_verification` dapat overwrite & spam**
9. **LOW — Harga plan hardcode ganda**

## Status resolusi satu-satu

| # | Verdict | Solusi |
|---|---------|--------|
| 1 | ✅ FIXED | `createOrder` mengizinkan renewal/upgrade bila slug dimiliki situs aktif dengan email pembeli yang sama (`client_access` + `sites`), selain tetap menolak slug orang lain. |
| 2 | ✅ FIXED | Guard di jalur upgrade `activateOrder`: site Pro tidak bisa diaktifkan via order Lite (ditolak + order dikembalikan ke `waiting_verification`). |
| 3 | ✅ FIXED | Rate-limit: `billing_checkout` (10/mnt, block 5 mnt) & `billing_proof_upload` (5/mnt). |
| 4 | ✅ FIXED | Halaman template menampilkan breakdown harga (plan + template), checkout header menampilkan breakdown bila template berbayar + total dinamis dari endpoint publik `/api/billing/template-price` yang memakai `resolveOrderTemplate` yang sama dengan POST checkout. |
| 5 | ✅ FIXED | Index unik `idx_orders_desired_slug_active` HANYA status `pending_payment`/`waiting_verification`/`activating` (di `d1-schema.ts` + self-healing `cloudflareD1.ts` DROP+CREATE). Slug bebas dipakai ulang setelah site tercipta (slug situs nyata dijaga index `sites.slug`). |
| 6 | ✅ FIXED (plus) | Catch `desired_slug` UNIQUE pada `uploadPaymentProof` → error manual verification yang jelas (bukan 500). |
| 7 | ✅ FIXED (sebagian, disengaja) | Sweeper `expireStalePendingOrders` kini memulihkan order `activating` yang nyangkut >10 menit → `waiting_verification` (admin bisa klik ulang). Auto-expire `waiting_verification` sengaja TIDAK dipasang: admin bisa sedang verifikasi pembayaran sah di jam operasional 08:00–22:00. |
| 8 | ✅ FIXED | Re-upload saat `waiting_verification` kini mengganti bukti lama TANPA mengirim notifikasi Telegram ganda (`wasWaitingVerification` guard). |
| 9 | ✅ FIXED | `PLAN_BASE_PRICES` di `src/constants/plans.ts` dipakai `getBasePlanAmount` dan checkout page; duplikasi 149000/299000 dihapus. |

## Test baru (orderService.test.ts: 23 test total)
- Allowed renewal/upgrade order saat slug milik email pembeli yang sama.
- Ditolak order saat slug milik email pembeli lain.
- Reject aktivasi downgrade Pro→Lite + pesan & status reset `waiting_verification`.
- Update 5 sequence mock createOrder akibat tambahan sweeper recovery `activating` di `expireStalePendingOrders`.

## Verifikasi
- Unit test: `npm test` (vitest) → 117 file / 830 test PASS (sebelumnya 827).
- `npm run lint`: 0 error (13 warning pre-existing).
- `npx tsc --noEmit`: bersih.

## Sesi 2 (2026-08-03/04) — Audit Ulang + Fix H1–H4, M1–M7, L1–L4 + Stress Test LIVE

**Latar:** Audit ulang seluruh flow checkout → QRIS dinamis → verifikasi manual untuk skenario human error (banyak transaksi serentak, telat bayar, bayar setelah expired, aktivasi nyangkut). Temuan baru ditutup satu-satu HIGH → MEDIUM → LOW, tiap batch harus lulus stress test live sebelum lanjut.

### Temuan baru & resolusi

| Kode | Severity | Temuan | Solusi |
|------|----------|--------|--------|
| H1 | HIGH | Order ID 2-byte (65.536 kombinasi/hari) rawan tabrakan saat banyak transaksi | ID 3-byte hex (`ORD-YYYYMMDD-6hex`, ≈16,7 jt/hari) + retry loop 3x di `createOrder` (regenerate id/token per attempt, tangkap unique `id`) |
| H2 | HIGH | Sweeper `expireStalePendingOrders` hanya dipanggil di `createOrder`, tanpa jalur global | `sweepExpiredOrders()` (guard 10 mnt via `platform_settings.billing_expire_sweep_at`, dipanggil dari read path admin) + `expireOrderIfStale()` (per-order, dipanggil dari GET order/qris pembeli) |
| H3 | HIGH | Order `expired` tidak punya jalur aktivasi sama sekali (dead-end UI) | `activateOrder` dukung `{allowExpired, proofUrl}`; form upload bukti tampil untuk status `expired` di order page; tombol "Aktivasi (Late)" di admin |
| H4 | HIGH | Re-upload bukti saat `waiting_verification` mengganti bukti tanpa notifikasi Telegram | Notif Telegram hanya dikirim bila bukti BERUBAH (`isSameProof`); header dibedakan: baru / diupdate / late-expired |
| M1 | MEDIUM | Tidak ada countdown batas bayar di UI | Countdown live 1 detik di order page (merah pulse <1 jam, amber saat waiting_verification) + banner expired |
| M2 | MEDIUM | "Upload" bukti = paste URL saja | Route baru `POST /api/billing/orders/[orderId]/proof-upload` (multipart, JPG/PNG/WebP ≤5 MB, rate-limit `billing_proof_file` 5/mnt, simpan R2 `orders/{orderId}/proof-*`), file picker + fallback paste URL |
| M3 | MEDIUM | `waiting_verification` tak pernah kedaluwarsa → slug/nominal terkunci selamanya | Auto-cancel otomatis 7 hari (keputusan sesi-1 "tidak diexpire" direvisi: kini dibatasi 7 hari, masih aman untuk jam operasional admin) |
| M4 | MEDIUM | Bot aktivasi admin tanpa gate cek mutasi | Modal konfirmasi dengan checkbox wajib "sudah cek mutasi manual m-Banking/QRIS" sebelum tombol aktivasi aktif |
| M5 | MEDIUM | Buyer bisa spam checkout berulang untuk slug sama | Dedupe di `createOrder`: email+slug sama pada status aktif ditolak, pesan menyertakan ID order lama |
| M6 | MEDIUM | Selisih nominal kode unik (Rp1–999) tidak dijelaskan | Catatan kode unik di bawah Total Investasi halaman checkout |
| M7 | MEDIUM | `activating` nyangkut tanpa recovery sampai order berikutnya | Recovery 10 menit di `expireStalePendingOrders`, `expireOrderIfStale`, dan sweeper |
| L1 | LOW | Admin orders tanpa pagination (LIMIT 200) | `getAdminOrders` paginated `{page, limit}` (limit ≤100) + tombol "Muat Lebih Banyak" di OrdersPanel |
| L2 | LOW | `expires_at` tidak diperpanjang saat bayar telat | Late-payment memperpanjang `expires_at` +24 jam |
| L3 | LOW | GET order & qris tanpa rate limit | `billing_order_get` & `billing_qris_get` 30/mnt (block 60 dtk) |
| L4 | LOW | Tidak ada salin link halaman order | Tombol "Salin Link Pesanan" di header order page |

### Temuan stress test live (baru, sesi ini)

| Temuan | Perbaikan |
|--------|-----------|
| `resolveOrderAmount` deterministik (ambil offset terkecil bebas) → thundering herd: 100 checkout serentak hanya 9/100 sukses, sisanya "Nominal unik sedang penuh" padahal 999 slot kosong | Probe acak (wrap-around scan): 100/100 sukses, 100 nominal unik — diuji 2x stabil |
| Live DB tidak punya kolom `cancel_reason`/`payment_proof_url` → sweeper 7-hari crash saat `createOrder` | Self-healing di `cloudflareD1.ts` bootstrap: `ALTER TABLE orders ADD COLUMN cancel_reason TEXT / payment_proof_url TEXT` (guard PRAGMA) |

### File dimodifikasi (sesi 2)
- `src/lib/services/orderService.ts` (H1–H4, M3, M5, M7, L1, L2 + probe acak)
- `src/lib/services/orderService.test.ts` (30 test; sequence mock createOrder + 7 test baru: M5 dedupe, expireOrderIfStale, sweep guard x2, late activate, getAdminOrders x2)
- `src/lib/cloudflareD1.ts` (self-healing kolom orders)
- `src/app/api/billing/orders/[orderId]/route.ts` (L3 + expireOrderIfStale)
- `src/app/api/billing/orders/[orderId]/qris/route.ts` (L3 + expireOrderIfStale)
- `src/app/api/billing/orders/[orderId]/proof-upload/route.ts` (BARU — M2)
- `src/app/api/admin/orders/route.ts` (H2 sweep, H3 allowExpired/proofUrl, L1 pagination)
- `src/app/orders/[orderId]/page.tsx` (M1 countdown, M2 file upload, H3 form expired, L4 copy link)
- `src/app/checkout/page.tsx` (M6)
- `src/app/admin/desktop/panels/OrdersPanel.tsx` (M4 modal gate, H3 late activation, L1 load-more)
- `scripts/test-stress-billing-high.ts` (BARU — stress test live 7 skenario)

### Verifikasi sesi 2
- Stress test HIGH live D1 (`npx tsx scripts/test-stress-billing-high.ts`): **21/21 PASS, dijalankan 2x stabil** (100 checkout serentak, dedupe 30x, late-payment bebas, late-payment konflik slug, aktivasi late, recovery activating, guard sweeper).
- `npm test`: 117 file / **837 PASS** (bertambah 7 test).
- `npm run lint`: 0 error (13 warning pre-existing).
- `npx tsc --noEmit`: bersih.

## Catatan
- Deploy ke Cloudflare belum dilakukan sesi ini (hanya kode + test).
- Cron sweeper global belum dipasang (tidak ada `wrangler.toml`); jalur lazy di GET admin + GET order/qris sudah aktif.
- Skenario MEDIUM (M2 route upload, M4 modal) & LOW (L1 pagination, L4) masih butuh stress test live terpisah di sesi berikutnya.

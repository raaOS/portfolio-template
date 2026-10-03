# Hardening Keamanan Alur Order & Billing — Tahap 4–5 Audit (v1.3.11)

**Tanggal:** 2026-10-02
**Status:** 🟢 Completed (lokal; deploy menunggu perintah owner)
**Versi template:** v1.3.11

## Ringkasan

Enam perbaikan bertarget pada alur order/billing, hasil audit keamanan tahap 4–5. Semua perubahan bersifat security-hardening murni tanpa mengubah UX: pembeli tetap memakai alur checkout, upload bukti bayar, dan salin-link order seperti biasa.

## Daftar Perbaikan

### #4 — Token URL → Referrer Leak Ditutup (BARU)
- **File:** `src/app/orders/layout.tsx` (**baru dibuat**)
- **Masalah:** Saat pembeli membuka halaman order lalu mengklik link eksternal (bank, medsos), browser mengirim header `Referer` berisi URL lengkap termasuk token order ke situs tujuan. Token bisa terekam di log pihak ketiga.
- **Fix:** Layout route `/orders/*` mengembalikan header `Referrer-Policy: no-referrer` + meta `<meta name="robots" content="noindex,nofollow">`.
- **Dampak:** Fitur "salin link" tetap jalan penuh; hanya kebocoran referer yang tertutup.

### #7 — SSRF Guard Bukti Bayar
- **File:** `src/lib/services/orderService.ts:245` (`normalizePaymentProofUrl`)
- **Masalah:** URL bukti bayar dari input user difetch oleh server tanpa validasi host — memungkinkan Server-Side Request Forgery ke internal network.
- **Fix:** Tolak localhost/loopback/RFC1918/169.254/CGNAT sebelum fetch dilakukan.

### #8a — Audit Trail Upload Bukti
- **File:** `src/app/api/billing/orders/[orderId]/route.ts:116`
- **Fix:** Panggil `logActivity('billing.proof_upload', {...})` setelah upload berhasil.

### #8b — Audit Trail CancelOrder
- **File:** `src/lib/services/orderService.ts:1046`
- **Fix:** Panggil `logActivity('billing.order_cancel', {...})` sebelum return sukses di `cancelOrder()`.

### #5 — Rate-Limit Checkout
- **File:** `src/app/api/billing/checkout/route.ts`
- **Status:** Cap per-IP sudah aktif via `enforceRequestRateLimit`. Ditambah same-origin guard di handler untuk menutup celah CSRF pada endpoint publik.

### #3 — CSRF Billing (Opsi A)
- **File:** `src/middleware/csrf.ts`
- **Fix:** Same-Origin fallback untuk endpoint publik yang tidak membawa cookie session (alur checkout tamu). Tidak mengubah proteksi double-submit-cookie untuk endpoint admin/client ber-auth.

### #2 — Webhook Timing-Safe
- **File:** `src/app/api/telegram/webhook/route.ts`
- **Masalah:** Perbandingan secret webhook pakai `===` (string comparison biasa) — rentan timing attack.
- **Fix:** Ganti ke `crypto.timingSafeEqual` dengan length guard sebelum komparasi.

## Verifikasi

| Gerbang | Hasil |
|---|---|
| Vitest | **61 passed / 61** (4 file test: middleware ×3 + orderService). Nol regresi. |
| `git diff --stat` | 5 modified + 1 untracked baru = **6 file**, **+149/-5** baris. |
| TypeScript | Bersih (tidak ada error baru). |
| ESLint | Bersih (tidak ada warning baru). |

## File yang Dimodifikasi / Dibuat

| File | Status | Baris |
|---|---|---|
| `src/app/orders/layout.tsx` | **BARU** | +~25 |
| `src/app/api/billing/checkout/route.ts` | Modified | +30/-0 |
| `src/app/api/billing/orders/[orderId]/route.ts` | Modified | +7/-0 |
| `src/app/api/telegram/webhook/route.ts` | Modified | +16/-2 |
| `src/lib/services/orderService.ts` | Modified | +34/-0 |
| `src/middleware/csrf.ts` | Modified | +52/-2 |
| `CHANGELOG.md` | Modified | +15/-0 |
| `docs/tracker/INDEX_TRACKER.md` | Modified | entri 122 ditambahkan |

## Sisa Backlog (Di Luar Scope)

- **#6 — Konsistensi guard Admin vs Customer:** Topik refactor terpisah, bukan security hole aktif. Aman ditunda sampai sprint refactor berikutnya.

## Catatan Deploy

Perubahan ini **belum dideploy ke produksi**. Menunggu perintah owner untuk `npm run deploy` (gate pre-deploy + build + cf:deploy).
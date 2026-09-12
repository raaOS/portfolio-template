# Tracker Log: Security Audit API & Auth Layer

**Status:** ✅ Fully Remediated (2026-09-13 — semua temuan #1-#4 ditutup)
**Mulai:** 2026-08-11
**Selesai:** 2026-08-11 (audit) / 2026-09-13 (remediasi penuh)

## 🎯 Tujuan (Objective)
- Verifikasi keamanan lapisan API & autentikasi: auth admin/client, CSRF middleware, rate limit, token R2 upload, scope multi-tenant, dan endpoint mutasi publik.
- Konfirmasi temuan dengan pembacaan penuh file sumber (bukan hanya grep).

## 📋 Task List
- [x] Audit `src/middleware.ts` + `src/middleware/auth.ts` + `src/middleware/csrf.ts` (flow CSRF/auth/refresh).
- [x] Audit `src/lib/auth.ts` (JWT admin, sliding refresh 30 menit), `src/lib/clientAuth.ts` (scoped siteId + flag disabled), `src/lib/security/token.ts`, `src/lib/admin/siteMutationAuth.ts`.
- [x] Audit `src/app/api/admin/login/route.ts` (scrypt + rate limit + audit + geolocation), `logout`, `check-auth`, `pin/verify`, `password/change`.
- [x] Audit upload pipeline: `/api/admin/upload` (multipart edge, `getClientIP`, `uploadPaymentProof`), `/api/admin/upload/direct` (signed token, tanpa origin binding), `/api/admin/upload/presign` (folder/type/size/CT-bound).
- [x] Audit billing: `/api/billing/orders` (PII scoped by accountId, expiry 15 menit, slug UNIQUE retry), `/api/billing/checkout`, `/api/billing/qris`, `/api/billing/upload-proof`.
- [x] Audit `/api/revalidate` (HMAC secret) vs middleware CSRF allowlist.
- [x] Audit `src/middleware/constants.ts` (protectedRoutes/publicRoutes).
- [x] Periksa client-side CSRF header (`x-csrf-token`) pada semua mutasi UI.

## 📂 File yang Dimodifikasi (Modified Files)
- Tidak ada file source yang diubah (audit read-only). Log ini satu-satunya perubahan.
- File yang dibaca penuh untuk verifikasi (referensi untuk AI berikutnya):
  - `src/middleware.ts`, `src/middleware/auth.ts`, `src/middleware/csrf.ts`, `src/middleware/constants.ts`
  - `src/lib/auth.ts`, `src/lib/clientAuth.ts`, `src/lib/admin/siteMutationAuth.ts`
  - `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`
  - `src/app/api/admin/upload/route.ts`, `src/app/api/admin/upload/direct/route.ts`, `src/app/api/admin/upload/presign/route.ts`
  - `src/app/api/projects/[id]/route.ts`, `src/app/api/billing/*`, `src/app/api/revalidate/route.ts`

## 🔍 Temuan Audit — Status Remediasi (Update 2026-09-13)

### HIGH — Fungsional (bug nyata)
1. **`POST /api/revalidate` tidak pernah bisa dipanggil dari luar.** ✅ RESOLVED
   - Sudah ada di CSRF allowlist `src/middleware/csrf.ts:42` (ditambahkan pada commit `bed0e19`, terverifikasi ulang 2026-09-13 dengan test `src/app/api/revalidate/route.test.ts` — 4/4 PASS).

### MEDIUM — Hardening keamanan
2. **Brute-force login admin dapat dibypass dengan rotasi User-Agent / spoof XFF.** ✅ RESOLVED
   - Key rate limit admin login kini IP-only (`src/app/api/admin/login/route.ts:127-141`, komentar "SECURITY FIX"); `getClientIP` memprioritaskan `cf-connecting-ip` (`src/lib/security/request.ts:19-39`); customer login `/api/auth/login` juga IP-only dengan guard 3/5min + block 30min. Backoff progresif per-akun belum diimplementasikan — dianggap cukup dengan blokir 30 menit untuk skala managed service.
3. **Token direct upload (`/api/admin/upload/direct`) adalah bearer token tanpa binding.** ✅ RESOLVED (2026-09-13, commit `c1b5fd9`)
   - `siteId` kini diikat ke dalam token HMAC (`R2TokenPayload.siteId` di `src/lib/r2Storage.ts`) dan diverifikasi ulang di route direct: token site X hanya boleh menulis ke prefix `sites/X/`; token legacy tanpa siteId ditolak untuk key site-scoped (403). Ditambah rate limit per IP 30 attempt/5min + block 5min sebelum verifikasi token. Test baru: 4 case (mismatch, legacy-token-reject, legacy-asset-allow, rate-limit-429).
4. **`x-test-bypass` melewati rate limit login di development.** ✅ RESOLVED
   - Dihapus pada bug sweep 2026-08-14 (FIX #57). Bypass kini hanya untuk `NODE_ENV=test` / `E2E_TEST=true`.

## ✅ Kontrol yang Terverifikasi Aman
- Cookie admin `httpOnly` + `sameSite=strict` + `secure` di production (`login/route.ts:250-256`); sliding refresh 30 menit (`auth.ts`).
- CSRF ganda: middleware (allowlist) + validasi ulang di handler login.
- Client auth scoped `siteId`; login client diblokir jika flag `disabled`; draft project 404 untuk non-owner/non-admin.
- Presign: folder whitelist (`wallpapers`), video-only, ceiling 60MB, content-type diikat ke signature.
- Order billing scoped per `accountId`, expiry 15 menit, slug UNIQUE + retry, bukti bayar hanya path R2.
- Storage key site-scoped (`sites/{siteId}/...`), middleware custom domain rewrite tidak menyentuh `/api/`.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Semua temuan audit (#1-#4) sudah ditutup. Verifikasi akhir 2026-09-13: tsc 0 error, eslint 0 error, 109 files / 825 tests PASS.
- Belum diverifikasi offline: `getGeoInfo` (panggilan eksternal ip-api.com saat login), endpoint comments/feedback/contact/analytics (hanya dibaca parsial), dan alur `useChatSync`/`useRealtimeSync` (interval sudah sesuai AGENTS.md).

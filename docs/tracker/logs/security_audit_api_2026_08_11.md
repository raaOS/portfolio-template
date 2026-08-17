# Tracker Log: Security Audit API & Auth Layer

**Status:** 🟢 Completed (audit selesai, temuan belum di-remediate — menunggu keputusan)
**Mulai:** 2026-08-11
**Selesai:** 2026-08-11

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

## 🔍 Temuan Audit (Belum di-remediate)

### HIGH — Fungsional (bug nyata)
1. **`POST /api/revalidate` tidak pernah bisa dipanggil dari luar.**
   - CSRF middleware memblokir semua POST/PUT/DELETE/PATCH yang tidak ada di allowlist (`src/middleware/csrf.ts:20-37`), dan `/api/revalidate` tidak terdaftar.
   - Penelepon webhook/cron (GitHub, scheduler) tidak mungkin menyediakan cookie `csrf_token` + header `x-csrf-token`, sehingga selalu 403 sebelum HMAC secret dicek di `src/app/api/revalidate/route.ts`.
   - **Rekomendasi:** tambahkan `/api/revalidate` ke allowlist CSRF (endpoint sudah aman via HMAC `REVALIDATION_TOKEN`), atau jadikan GET-only dengan HMAC di query param.

### MEDIUM — Hardening keamanan
2. **Brute-force login admin dapat dibypass dengan rotasi User-Agent / spoof XFF.**
   - Rate limit dikunci `login_${ip}|${userAgent}` (`src/app/api/admin/login/route.ts:122-134`); UA/IP header dapat diubah attacker untuk mengganti kunci. `getClientIP` di `src/lib/security/utils.ts` jatuh ke `x-forwarded-for` bila tidak ada `cf-connecting-ip` (spoofable di luar Cloudflare).
   - **Rekomendasi:** kunci hanya IP (atau IP saja tanpa UA), gunakan `cf-connecting-ip` secara eksklusif, tambah backoff progresif/lockout per akun.
3. **Token direct upload (`/api/admin/upload/direct`) adalah bearer token tanpa binding Origin/Host/sesi.**
   - Token 10 menit terikat key/content-type/size (`src/app/api/admin/upload/presign/route.ts:134`), tetapi route publik `direct` (`src/middleware/constants.ts:39`) tidak memverifikasi asal request. Token yang bocor memungkinkan upload ke bucket site dari browser mana pun.
   - **Rekomendasi:** ikat siteId/issuer ke token dan verifikasi ulang di route direct; tambah rate limit per IP pada PUT.
4. **`x-test-bypass` melewati rate limit login di development** (`src/app/api/admin/login/route.ts:123-126`) — aman hanya jika NODE_ENV strict; jangan pernah diaktifkan di production.

## ✅ Kontrol yang Terverifikasi Aman
- Cookie admin `httpOnly` + `sameSite=strict` + `secure` di production (`login/route.ts:250-256`); sliding refresh 30 menit (`auth.ts`).
- CSRF ganda: middleware (allowlist) + validasi ulang di handler login.
- Client auth scoped `siteId`; login client diblokir jika flag `disabled`; draft project 404 untuk non-owner/non-admin.
- Presign: folder whitelist (`wallpapers`), video-only, ceiling 60MB, content-type diikat ke signature.
- Order billing scoped per `accountId`, expiry 15 menit, slug UNIQUE + retry, bukti bayar hanya path R2.
- Storage key site-scoped (`sites/{siteId}/...`), middleware custom domain rewrite tidak menyentuh `/api/`.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Temuan #1 (revalidate) bersifat fungsional dan harus diremediasi sebelum webhook revalidasi dipakai.
- Belum diverifikasi offline: `getGeoInfo` (panggilan eksternal ip-api.com saat login), endpoint comments/feedback/contact/analytics (hanya dibaca parsial), dan alur `useChatSync`/`useRealtimeSync` (interval sudah sesuai AGENTS.md).
- Jika ingin lanjut remediasi, mulai dari #1 (1 baris allowlist + test) lalu #2 dan #3. Jalankan `npm test`, `npm run lint`, dan `npx tsc --noEmit` setelah perubahan.

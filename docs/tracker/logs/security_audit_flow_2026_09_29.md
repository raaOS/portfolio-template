# Tracker Log: Security Audit Alur Login, Pembayaran & API

**Status:** ✅ Audit selesai — **seluruh temuan (4 HIGH / 8 MEDIUM / 7 LOW) sudah di-remediasi**
**Tanggal:** 2026-09-29 (audit) + remediasi bertahap (HIGH → MEDIUM → LOW) di hari yang sama
**Tipe:** Audit keamanan + perbaikan kode sesuai izin owner ("perbaiki semua secara bertahap dari high sampai low")

## 🎯 Tujuan (Objective)
- Menganalisis keamanan alur utama aplikasi: login/autentikasi, pembayaran/billing, dan attack surface API lainnya.
- Setiap temuan diverifikasi dengan membaca file sumber langsung (bukan hanya hasil grep/subagent).

## 📋 Task List
- [x] Baca `docs/tracker/INDEX_TRACKER.md` + log audit keamanan sebelumnya (`security_audit_api_2026_08_11.md`) untuk menghindari duplikasi temuan remediasi.
- [x] Audit lapisan auth: `middleware/{constants,csrf,customer-auth}.ts`, `api/auth/login`, `api/admin/login`, `api/setup`, `lib/auth.ts`.
- [x] Audit alur billing: `api/billing/*`, `orderService.ts`, `api/telegram/webhook`, `api/admin/orders`.
- [x] Audit attack surface lain: `api/settings`, `api/translate`, `api/admin/upload|icons`, security headers/CSP, rate limiter.
- [x] Verifikasi manual temuan severity tinggi langsung ke file sumber.

## 🔍 Temuan (Ringkas — detail di laporan chat & referensi file)

### HIGH
1. **`GET /api/settings` publik mengembalikan seluruh row `settings` minus `bannedWords`** — `src/app/api/settings/route.ts:24-33`. Jika key `settings/adminPassword` (hash scrypt) dan `settings/adminPin` pernah ditulis oleh endpoint legacy `src/app/api/admin/password/route.ts:50` / `pin/route.ts:47`, hash ikut terkirim ke caller tanpa autentikasi. Salt (`PASSWORD_SALT`) TIDAK ikut bocor → brute-force offline tetap butuh salt.
2. **Rate limit route-level memakai key `ip|userAgent`** — `src/lib/security/request.ts:41-47`. Rotasi User-Agent me-reset counter untuk 19 route pemakai `enforceRequestRateLimit` (termasuk `pin/verify` PIN 4 digit, `translate`, `checkout`, `proof-upload`). Login (`/api/auth/login`, `/api/admin/login`) sudah IP-only (aman).
3. **Endpoint AI publik memakai API key owner** — `src/app/api/translate/route.ts:48-61` (tanpa auth, hanya `FEATURE_AI` + rate limit yang bisa dibypass UA); sama untuk `chat/voice`, `chat/send`.
4. **`/api/setup` terbuka tanpa auth & rate limit** — `src/app/api/setup/route.ts:26-35`. Re-seed dicegah guard atomic `hasAdmin`, tapi siapa pun yang menang pertama pada D1 kosong = takeover admin; juga bisa dipakai banjir scrypt (DoS CPU).

### MEDIUM
5. **Webhook Telegram: otorisasi hanya shared secret, tanpa cek `chat.id` admin & tanpa rate limit** — `src/app/api/telegram/webhook/route.ts:21-48` (diverifikasi: tidak ada perbandingan `TELEGRAM_ADMIN_CHAT_ID`).
6. **CSRF allowlist memakai `startsWith`** — `src/middleware/csrf.ts:44` dengan entri `/api/billing/orders` → jalur admin `POST /api/billing/orders/<id>` bebas CSRF (termitigasi cookie `sameSite:'strict'`).
7. **JSON-LD di-`JSON.stringify` ke `<script>` tanpa escape `<`** — `src/app/[siteSlug]/projects/[slug]/page.tsx:54-68` dan `src/app/(site)/projects/[slug]/page.tsx:47` → stored XSS bila judul/deskripsi project mengandung `</script>`.
8. **CSP `script-src 'unsafe-inline'`** — `src/middleware/utils.ts:57` → CSP tidak memitigasi XSS; jalur static asset (`/api/r2/*`, `isStaticAsset`) bahkan keluar lebih awal dari middleware (`src/middleware.ts:71-73`) sehingga tanpa CSP/nosniff.
9. **`DELETE /api/admin/icons` tanpa validasi prefix folder** — `src/app/api/admin/icons/route.ts:70-90` (`FOLDER_PATH` tidak dipakai untuk guard) → semua objek `assets/*`,`temp/*` bisa dihapus oleh sesi admin mana pun.
10. **`updateSettingsSchema.passthrough()`** — `src/lib/validations/schemas.ts:118` → admin dapat menulis key arbitrer ke row `settings` (berpasangan dengan temuan #1).
11. **Bukti bayar bisa upload ulang berulang dan mereset timer auto-cancel 7 hari** — `src/lib/services/orderService.ts:658` (status `expired` diizinkan) + `:87-89` (auto-cancel berbasis `updated_at`) → slug & nominal unik bisa dikunci tanpa bayar.
12. **Flood checkout menghabiskan pool nominal unik (default 999)** — `orderService.ts:285-301` + `checkout/route.ts:43` (tanpa captcha; limit per `ip|UA`) → checkout gagal untuk semua orang.

### LOW (terverifikasi/kemungkinan)
- SQL literal `"activated"` (double-quote) di `orderService.ts:893` — bisa gagal bila `SQLITE_DQS=0` (perlu verifikasi D1 produksi).
- Token akses order tidak pernah kedaluwarsa & dikirim via query string (`orderService.ts:49-55`).
- `templateId` diterima checkout tapi tidak pernah disimpan/dientitle (`checkout/route.ts:52,77` vs `orderService.ts:566-570`).
- Retensi objek bukti bayar R2 setelah `cancelOrder` (DB dibersihkan, R2 tidak).
- Entri legacy `admin_token` JWT tidak membawa klaim `siteId` (`src/lib/auth.ts:82-86`) — berisiko hanya bila `JWT_SECRET` dipakai bersama antar deployment.
- Perbandingan secret webhook Telegram non-constant-time (`webhook/route.ts:28`).
- `error.message` dibocorkan di 500 route publik `api/music/search/route.ts:142`.

## ✅ Kontrol yang Terverifikasi Benar
- Tidak ditemukan SQL injection (semua query via binding `?`), tidak ada hardcoded secret, `JWT_SECRET` kosong → fail-closed.
- Cookie auth `httpOnly` + `secure` + `sameSite:'strict'` + TTL 2 jam; CSRF double-submit constant-time.
- Rate limit login IP-only, fail-closed saat D1 error di produksi.
- Setup race `INSERT ... WHERE NOT EXISTS` → re-seed setelah admin ada tidak bisa.
- Harga/billing 100% server-side (`PLAN_BASE_PRICES`), baca order wajib token 256-bit atau admin, aktivasi hanya dari webhook (secret) atau admin+CSRF.
- Presign/direct upload R2: HMAC + exp + binding `siteId` + key di-derive server.
- `/api/revalidate` HMAC `timingSafeEqual` + fail-closed; SSRF di-allowlist host (`api/img`).

## 📂 File yang Dimodifikasi

### Remediasi HIGH
- `src/app/api/settings/route.ts` — allowlist eksplisit `PUBLIC_SETTINGS_KEYS = ['maintenanceMode', 'allowComments']` untuk caller non-admin (menutup leak `settings/adminPassword`/`adminPin`).
- `src/lib/security/request.ts` — key `enforceRequestRateLimit` jadi `${scope}:${getClientIP(request)}` (menutup bypass rotasi User-Agent di 19 route).
- `src/app/api/chat/send/route.ts` — key rate limit dari `getClientIdentifier` → `getClientIP` (IP-only).
- `src/app/api/translate/route.ts` — kuota harian keras baru `translate_daily` 200 req/24 jam per IP (plafon biaya API key owner) di samping limit per-menit.
- `src/app/api/setup/route.ts` — rate limit IP-only untuk GET (30/10mnt) dan POST (5/10mnt, block 30mnt, kurangi DoS scrypt & brute-force seeding); `siteId` dihapus dari response GET (tidak dipakai setup page).

### Remediasi MEDIUM
- `src/app/api/telegram/webhook/route.ts` — timing-safe `safeEqual`, guard `TELEGRAM_ADMIN_CHAT_ID` (callback dari chat lain diabaikan), sanitasi digit `buyer_whatsapp` sebelum ditanam ke pesan HTML, rate limit 30 req/menit.
- `src/middleware/csrf.ts` — allowlist dipadukan per-segmen (`pathname === entry || startsWith(entry + '/')`) — path baru yang kebetulan berawalan sama tidak lagi lolos CSRF.
- `src/app/(site)/projects/[slug]/page.tsx`, `src/app/[siteSlug]/projects/[slug]/page.tsx`, `src/app/layout.tsx` — `.replace(/</g, '\\u003c')` pada JSON-LD (tutup stored XSS via `</script>` di judul/deskripsi project).
- `src/middleware.ts` — jalur static asset (`/api/r2/*`, gambar, dll.) tidak lagi keluar tanpa security header; jalur itu kini dapat `addSecurityHeaders` (nosniff/CSP/X-Frame-Options/Referrer-Policy) tanpa mengorbankan skip CSRF/auth.
- `next.config.mjs` — HSTS & Referrer-Policy disamakan dengan middleware (sebelumnya beda nilai: `63072000` vs `31536000`, `origin-` vs `strict-origin-when-cross-origin` → header kembar dengan nilai konflik).
- `src/app/api/admin/icons/route.ts` — guard prefix `assets/icons-library/` sebelum loop variant delete (tutup penghapusan objek wallpaper/temp oleh sesi admin mana pun).
- `src/lib/validations/schemas.ts` — `updateSettingsSchema` `.passthrough()` → `.strict()` (hanya 3 key yang tersimpan ke row `settings`).
- `src/lib/services/orderService.ts` — upload ulang bukti dari `waiting_verification` TIDAK me-reset `updated_at` (timer auto-cancel 7 hari tetap dihitung dari bukti pertama; first upload & late payment tetap jendela baru).
- `src/app/api/billing/checkout/route.ts` — limit POST 10/menit → 5/menit (block 10 menit) + rate limit GET cek slug 30/menit (kunci pool nominal unik 999 slot tetap terbatas).

### Remediasi LOW
- `src/lib/services/orderService.ts` — SQL literal `"activated"` → `'activated'`; `template_id` kini ikut INSERT order (sebelumnya `templateId` dari checkout hilang diam-diam); cleanup objek R2 `orders/{orderId}/` saat `cancelOrder` dan saat auto-cancel sweeper (query `RETURNING id`, tetap 1 query — urutan mock test tidak bergeser); token akses order kadaluarsa 90 hari sejak `created_at` (tautan `?token=` yang bocor tidak berlaku selamanya).
- `src/app/api/music/search/route.ts` — `error.message` internal tidak lagi diteruskan ke respons 500 publik.
- `src/lib/auth.ts` — `admin_token` kini membawa klaim `siteId` + `verifyAdminToken` menolak token yang tidak cocok (token lama tanpa klaim ditolak → logout sesi 2 jam, aman).
- `src/middleware/customer-auth.ts` — verifikasi `siteId` payload vs `CUSTOMER_SITE_ID` per-request (lapisan pertama; guard handler tetap memeriksa).
- Telegram timing-safe: lihat remediasi MEDIUM di atas.

### Verifikasi (gate penuh setelah seluruh tahap)
- `tsc --noEmit` → 0 error
- `eslint src` → 0 error
- `vitest run` (seluruh suite) → **PASS (exit 0)** — termasuk `settings`, `translate`, `chat/*`, `orderService` (24 test), `csrf`, `customerAuth` (6 test).

## 📝 Catatan untuk AI Selanjutnya (Handoff)
- **Semua temuan di log ini sudah di-remediasi** dan diverifikasi (tsc/eslint/test hijau). Belum di-commit (perubahan di working tree).
- Sisa yang butuh keputusan/akses owner (bukan blocker): (a) CSP `script-src 'unsafe-inline'` — perbaikan selesai sebatas penambahan header di jalur static asset + escape JSON-LD; mengganti ke nonce CSP penuh adalah perubahan besar yang butuh keputusan produk; (b) verifikasi env produksi: nilai `PASSWORD_SALT`/`JWT_SECRET` per deployment, `TELEGRAM_BOT_SECRET` & `TELEGRAM_ADMIN_CHAT_ID`, `CLOUDFLARE_R2_PUBLIC_BASE_URL` (apakah menampilkan objek `orders/`), keberadaan key `settings/adminPassword` di D1 produksi, dan perilaku D1 terhadap SQL literal `"activated"` (kini tidak relevan — sudah pakai `'activated'`); (c) token `admin_token` lama (tanpa klaim `siteId`) akan ditolak setelah deploy → sesi admin aktif logout sekali.
- Audit sebelumnya yang sudah di-remediasi: `security_audit_api_2026_08_11.md` (jangan dibuka ulang), `audit_logic_defects_2026_09_11.md`.

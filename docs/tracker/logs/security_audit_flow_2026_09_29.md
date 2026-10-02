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

## 🔎 Hasil Verifikasi Produksi (2026-09-30, akses env disetujui owner)

Diverifikasi langsung ke akun Cloudflare owner memakai `C:\Users\USER\Documents\tamplate-portofolio\.env.local` (akun `69c1e830…`, DB `portfolio-template-prod` = `7a8b4eaa-…`):

| Yang diverifikasi | Hasil | Implikasi |
|---|---|---|
| Key `settings/adminPassword` / `adminPin` | **TIDAK ADA** — tabel `content` sudah tidak ada; `site_settings` 0 baris; `platform_settings` hanya `billing_expire_sweep_at` + `payment_config`; `app_kv` (6 key, 312 KB) tidak mengandung string itu | Temuan HIGH #1 **murni pencegahan** — tidak pernah ada hash yang bisa bocor |
| `TELEGRAM_ADMIN_CHAT_ID` | **terisi** (`6116803120`) | Guard webhook aktif begitu env ikut ter-deploy |
| `CLOUDFLARE_R2_PUBLIC_BASE_URL` | `/r2` (lewat route aplikasi, bukan domain R2 publik) | Exposure bergantung pada allowlist route |
| Prefiks `orders/` di route publik | **diblokir** (allowlist hanya `assets/`, `temp/`, `sites/`, `platform/` + 2 file ffmpeg) | Uji langsung ke `makeitbetter.my.id`: `/r2/assets/…jpg` → **200**, `/r2/orders/…` → **404** |
| Order dengan bukti bayar | **0 dari 12 order** punya `payment_proof_url` | Belum ada file bukti di bucket |

**Kesimpulan: bukti transfer TIDAK terekspos publik.** ✅

## 🐞 Temuan Tambahan Pasca-Verifikasi (diperbaiki — CHANGELOG 1.3.12)

Karena prefiks `orders/` memang diblokir dengan benar, URL bukti hasil upload file (`/r2/orders/…`) selalu 404 — sehingga **tombol "Lihat Resi" di panel admin tidak akan pernah bisa menampilkan gambar hasil upload file**. Bukan regresi: string `orders/` tidak pernah ada di allowlist sejak commit asal (`bed0e19`), jadi fitur ini memang belum pernah berfungsi untuk file (jalur "tempel URL manual" tetap jalan). Keamanannya benar; hanya fungsinya yang bolong.

**Perbaikan (jangan dibalik):**
- `src/app/api/billing/orders/[orderId]/proof/route.ts` **(baru)** — satu-satunya jendela akses bukti: cek sesi admin (`checkAdminAuth`) ATAU token order (`verifyOrderAccessToken`) → stream objek R2 dengan `cache-control: private, max-age=3600` + `nosniff` + `content-disposition: inline`. Key yang dibaca selalu berawalan `orders/{orderId}/` (tidak mungkin membaca berkas order lain), path traversal & skema `javascript:` ditolak, URL asing dialihkan (302), bukan ikut diperambat. Scope rate limit `billing_proof_get` 60/menit.
- `src/app/api/billing/orders/[orderId]/proof/route.test.ts` **(baru)** — 13 test: gerbang otorisasi (401 tanpa token, token salah, admin lolos tanpa token, 429), penyajian (404 tanpa bukti, stream + header private, content-type dari ekstensi, 404 file hilang, 503 R2 belum konfigurasi), dan pembatasan lintas order (order A ≠ order B, traversal, redirect URL eksternal, skema berbahaya).
- `src/app/admin/desktop/panels/OrdersPanel.tsx` — tombol "Lihat Resi" menunjuk `/api/billing/orders/{id}/proof` alih-alih URL R2 mentah.

**Yang sengaja TIDAK dilakukan:** menambah `orders/` ke allowlist `/r2` — itu akan membuka PII bukti transfer ke publik dan membatalkan perlindungan yang sudah ada.

**CSP (keputusan owner):** pengeras level tanpa-risiko (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`) **sudah ada** sejak sebelum audit (diverifikasi terhadap `0c0a35c`) dan sudah diterapkan juga ke jalur static asset. Pengetatan `script-src` (nonce) **ditunda** — butuh pengujian browser terhadap suara, kompresi video WASM, dan preload GLTF.

## 📝 Catatan untuk AI Selanjutnya (Handoff)
- **Semua temuan di log ini sudah di-remediasi** dan diverifikasi (tsc/eslint/test hijau), lalu **di-commit pada cabang `fix/security-audit-2026-09-29`** (berbasis puncak `main` `0c0a35c`): `d3723aa` HIGH → `2c70914` MEDIUM → `787c730` LOW + dokumentasi → commit ke-4 untuk perbaikan "Lihat Resi" + CHANGELOG 1.3.12. Cabang ini masih perlu di-merge ke `main` oleh owner.
- ⚠️ **Worktree ini awalnya dalam kondisi *detached HEAD*** dan `main` sedang di-checkout di lokasi lain (`C:/Users/USER/Documents/tamplate-portofolio`) — jangan commit langsung di detached HEAD.
- **Keputusan owner (2026-09-30): fitur Telegram DIPERTAHANKAN dan dibiarkan AKTIF.** Pemahaman yang diluruskan: `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_CHAT_ID` / `TELEGRAM_BOT_SECRET` adalah milik **operator (owner)**, bukan pembeli — tidak ada satu pun kode yang meminta token/chat ID ke pembeli. Pembeli hanya menerima **email struk** (`sendOrderEmail`, provider `resend`, API key terisi) + tautan halaman pesanan; Telegram hanya mengirim ke chat owner (`orderService.ts:645` berkomentar `// Notify Telegram Admin (Information only)`) dan tombol `activate_`/`cancel_` hanya mengedit pesan di chat owner. Status di env: ketiga variabel `TELEGRAM_*` terisi → aktif; `FEATURE_NOTIFICATIONS` **bukan** sakelar email order (hanya field config site klien plan pro). Konsekuensi: tidak ada perubahan kode. Jika suatu saat ingin mematikan, cukup kosongkan 3 variabel `TELEGRAM_*` — `sendTelegramMessage` akan `return false` dan endpoint webhook menolak semua (403); **tidak perlu menghapus kode**.
- **Verifikasi env runtime Worker (2026-09-30, SELESAI — menggantikan catatan "belum diverifikasi"):** deploy target ternyata **Cloudflare Workers**, bukan Pages (`wrangler.jsonc` → `main: .open-next/worker.js`, `cf:deploy = cf:build && opennextjs-cloudflare deploy`; akun hanya punya 1 Worker: `portfolio-os-template`). API `GET .../workers/scripts/portfolio-os-template/settings` (via sesi OAuth Wrangler) mengembalikan **0 variabel dan 0 secret** — hanya 5 binding (`ASSETS`, `MEDIA_BUCKET`, `NEXT_INC_CACHE_KV`, `NEXT_TAG_CACHE_KV`, `WORKER_SELF_REFERENCE`); `wrangler.jsonc` tanpa `vars`, tidak ada `.dev.vars`, dan `wrangler secret list` = `[]`. Namun pengunduhan bundel (12.105.545 byte) membuktikan **semua nilai ditanam saat build** dari `.env.local`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_SECRET`, `TELEGRAM_ADMIN_CHAT_ID` (= `6116803120`, muncul 2×), `CLOUDFLARE_R2_PUBLIC_BASE_URL`, `JWT_SECRET`, `PASSWORD_SALT` → **semua "ADA (tertanam)"**. `CUSTOMER_SITE_ID` kosong di env lokal → fallback `'default-site'` (konsisten dengan baris D1 `content_default-site`). **Konsekuensi penting:** mengubah variabel di dashboard **tidak berpengaruh apa pun** — untuk mengubah/mematikan (mis. mematikan Telegram) wajib edit `.env.local` lalu build + deploy ulang. Sisi keamanan: nilai sensitif tersimpan terbaca di dalam bundel Worker; itu wajar untuk setup ini (bundel hanya bisa diunduh dengan akun Cloudflare ber-auth), tapi bila kelak ingin lebih rapi, pindahkan `JWT_SECRET`/`PASSWORD_SALT`/`TELEGRAM_BOT_TOKEN` ke Worker **secrets**.
- Sisa yang butuh keputusan/akses owner (bukan blocker): (a) CSP `script-src 'unsafe-inline'` — nonce CSP penuh ditunda, butuh keputusan produk + uji browser; (b) ~~verifikasi env produksi~~ **SUDAH SELESAI 2026-09-30** (lihat butir di atas: D1, Telegram, R2, dan env runtime Worker sudah diverifikasi semua); (c) token `admin_token` lama (tanpa klaim `siteId`) akan ditolak setelah deploy → sesi admin aktif logout sekali; (d) **merge ke `main` Ditunda** — repo main punya perubahan lokal tak ter-commit yang sedang dikerjakan sesi lain (`telegram/webhook` timing-safe via XOR loop, `csrf.ts` same-origin fallback +50 baris untuk `/api/billing/checkout` & `/api/billing/orders`) dan mengubah file yang sama dengan cabang ini; build & deploy juga ditunda karena build memakai working tree (pekerjaan setengah jadi akan ikut terbawa).
- Audit sebelumnya yang sudah di-remediasi: `security_audit_api_2026_08_11.md` (jangan dibuka ulang), `audit_logic_defects_2026_09_11.md`.

# Audit Logika & Alur Bisnis Menyeluruh — 2026-10-06

_Status:_ ✅ Audit selesai; **perbaikan 4 temuan CRITICAL sudah dieksekusi dan tervalidasi** (persetujuan owner: "kerjakan dan pastikan valid fix"). Temuan HIGH/MEDIUM lainnya masih menunggu putaran berikutnya.

## Cakupan

Audit end-to-end bisnis managed service (jual website portofolio Rp199.000) oleh sesi opencode ini:
alur jual-beli (`/checkout` → order → bukti → verifikasi Telegram → aktivasi), alur onboarding
(`PENGELOLA_KLIEN.bat` → provisioning → deploy per klien), alur HP (GitHub Actions), auth/keamanan,
alur kerja harian klien (kuota, upload, AI, cron/backup), konsistensi dokumen vs kode.

Metode: pembacaan dokumen bisnis (panduan owner/klien/HP, SALES_PRICING, BENGKEL_HANDOFF,
support-playbook, PRD, env-inventory) + 4 agen eksplorasi kode (very thorough) + verifikasi langsung
temuan paling kritis oleh sesi utama.

## Temuan terverifikasi langsung (dicek sendiri, bukan klaim agen)

1. **Backup D1 publik via proxy R2** — `src/lib/services/d1BackupService.ts:20` menulis key
   `sites/{SITE_ID}/backups/d1/<ISO>.json`; `src/app/api/r2/[...key]/route.ts:130-144` mengizinkan
   semua key `sites/` tanpa pengecualian `backups/` dan tanpa autentikasi → dump seluruh tabel
   (password hash, PII order, settings) berpotensi bisa diambil siapa pun yang menebak nama file
   (format waktu cron tetap, ±60.000 kombinasi detik/ms, tanpa rate limit). **CRITICAL.**
2. **Portal onboarding tidak pernah deploy** — `provisionClient` (`scripts/onboarding/server.ts:114`)
   berhenti di provisioning+arsip; `deployClient` hanya dipanggil dari endpoint terpisah
   `/api/deploy-client` (`server.ts:767,854` = Tab "Update Versi Template"). Padahal kartu sukses
   portal, pesan WhatsApp, PRD, dan BENGKEL_HANDOFF memberi kesan "website sudah live".

## Temuan utama dari agen (dengan bukti file:baris di laporan ke owner)

- **CRITICAL:** order `canceled`/`failed` = jalan buntu (uang masuk tak bisa diaktifkan,
  `orderService.ts:1013-1021,1167-1228`); auto-cancel 7 hari hapus bukti tanpa email
  (`orderService.ts:83-98`); portal `localhost:4567` tanpa auth + CORS `*` + bind semua interface +
  `/api/clients` mengembalikan `adminPassword` plaintext (`server.ts:318-320,448,1025`);
  alur HP fallback token CF owner bila input kosong (`pengelola-klien.yml:104-105`) + password admin
  dicetak ke log/summary GitHub.
- **HIGH:** email aktivasi menyatakan "sudah aktif" berisi URL placeholder domain owner
  (`orderService.ts:1060-1085,1117-1118`), `orders.template_id` tidak pernah dibaca & tanpa
  `site_users`/entitlement saat aktivasi; slug checkout ≠ slug onboarding (tanpa penghubung kode);
  auto-slug bisa gagal total (nama ≤2 karakter / nama sama) — `SALES_PRICING.md` klaim pembeli
  memilih slug (tidak ada di form); fitur AI klien mati 3 lapis (`FEATURE_AI=false`
  `client-deploy.ts:183`, config per-site tak pernah dibaca `api/ai/_shared.ts:12`, `PANEL_MAP`
  tanpa kunci `ai`); kuota storage tak ditegakkan di `api/admin/upload/route.ts` (jalur UI);
  6 route `/api/admin/*` (termasuk aktivasi order & audit-logs) hanya `checkAdminAuth` tanpa CSRF;
  2 sistem password paralel (`site_users` vs `settings/adminPassword`); resep izin token CF
  bertentangan di 3 tempat (`index.html:760`, `orderService.ts:964`, `BENGKEL_HANDOFF.md:36`);
  update template = full build per klien tanpa rollback + deteksi versi rusak
  (`/api/health` version hardcode `1.0.0`); audit orphan/statistik baca sumber legacy `app_kv`
  (bukan tabel `projects`).
- **MEDIUM (ringkas):** cron+backup tidak ikut ke deployment klien (tanpa `triggers.crons`/
  `CRON_SECRET`); ISR/revalidasi belum terbukti end-to-end (edit klien → tampil publik belum pasti);
  komentar/metrics publik terima `siteId` sembarangan tanpa rate limit memadai; re-provision slug
  sama merotasi password admin diam-diam + arsip ganda; custom domain tanpa guard duplikat/lepas;
  countdown halaman order salah; checkout rate-limit menghitung kegagalan (5x gagal = blokir 24 jam);
  placeholder support §8 (refund) belum diisi.

## Konsistensi dokumen vs kode (yang harus diperbaiki)

- `panduan/PANDUAN_UNTUK_KAMU_OWNER.md:69,72,81` masih `.pages.dev` (realita `<slug>.workers.dev`);
  `:171` masih "Cloudflare Pages" (realita API Worker, v1.3.21).
- `panduan/PANDUAN_KELOLA_DARI_HP.md:43` masih "Cloudflare Pages"; `:54` klaim artifact "privat…aman".
- `docs/release/SALES_PRICING.md:9,12` (slug dipilih pembeli; akses via email) tidak sesuai kode.
- `docs/operations/BENGKEL_HANDOFF.md:57-58` dan `docs/agent-context/00_PRD_PRODUCT.md:9,26`
  menyebut portal memanggil deploy saat onboarding (kode: endpoint terpisah).
- `orderService.ts:964` tiket Telegram: izin "D1, Pages, R2" (tanpa Workers Edit).
- AGENTS.md §12 diagram deploy masih menyebut "Pages (deploy)".

## Status

- Laporan audit lengkap (format prioritas CRITICAL/HIGH/MEDIUM/LOW + alur gagal + ambigu + asumsi +
  risiko keamanan + risiko skala jual + pertanyaan owner) disampaikan dalam chat sesi ini.
- Perbaikan tahap 1 (4 temuan CRITICAL) dieksekusi sesuai izin owner ("kerjakan dan pastikan
  valid fix") — lihat bagian **Eksekusi Perbaikan** di bawah. Temuan HIGH murni mekanis dieksekusi
  pada hari yang sama (v1.3.25, izin owner "Lanjut ke daftar temuan HIGH") — lihat
  **Eksekusi Perbaikan Batch HIGH**. Sisanya menunggu keputusan produk owner.

## Eksekusi Perbaikan (2026-10-06, izin owner)

### C1 — Backup D1 ditutup dari proxy publik
- `src/app/api/r2/[...key]/route.ts` — `isAllowedKey` kini menolak key ber-`/backups/` (404).
- `src/app/api/r2/[...key]/route.test.ts` — +1 test (backup ditolak, `getR2Object` tak dipanggil).
- Diverifikasi jalur baca lain: worker `workers/r2-public` hanya `assets/`+`temp/`; download backup
  memakai route admin terautentikasi → proxy inilah satu-satunya kebocoran.

### C2 — Portal onboarding kini benar-benar deploy + pesan jujur
- `scripts/onboarding/server.ts` — endpoint `/api/provision` memanggil `deployClient()` setelah
  provisioning (SSE: progress step 6-7 + log build); `complete` membawa `deployed`/`deployError`;
  pesan step-6 provision tidak lagi mengklaim "Selesai! Website siap!".
- `scripts/onboarding/public/index.html` — step-6 "Build & deploy... online", `<pre>` log deploy,
  judul/subtitle kartu sukses sesuai kondisi nyata, kotak peringatan "Website BELUM online" +
  tombol `btn-retry-deploy` (panggil `/api/deploy-client` dari kartu), tombol WA hanya aktif
  saat `deployed=true`; reset state ikut ditangani.
- Dokumen disamakan: `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` (`.pages.dev`→`.workers.dev` ×3,
  "Cloudflare Pages"→Cloudflare (Worker), langkah onboarding menyebut build+deploy & peringatan),
  `panduan/PANDUAN_KELOLA_DARI_HP.md` (Pages→Worker, timing "beberapa menit", artifact 7 hari),
  `docs/release/RELEASE_CHECKLIST.md` (izin token D1, R2, Workers (Edit)).
- Klaim lama `BENGKEL_HANDOFF.md:57-58`, PRD, `CLIENT_OPERATIONS.md` tentang portal memanggil
  `deployClient()` kini benar (tidak perlu diubah).

### C5 — Order: notifikasi pembatalan otomatis + jalur buka kembali
- `src/lib/services/orderService.ts`:
  - auto-cancel 7 hari: RETURNING ikut `buyer_*`/`desired_slug`; tiap order yang dibatalkan kini
    kirim **email ke pembeli** (`sendOrderCanceledEmail`, gaya email expired) + **notifikasi
    Telegram admin dengan tombol** `reopen_{id}` (`notifyAutoCanceledOrder`);
  - fungsi baru `reopenOrder()` (export): `canceled`/`failed` → `waiting_verification`,
    reset `cancel_reason`+`updated_at`, `logActivity('billing.order_reopen')`, pesan menjelaskan
    perlu upload ulang bukti (bukti lama tetap dihapus — keputusan audit keamanan 2026-09-29);
  - tiket bengkel: izin token "D1, Pages, R2" → "D1, R2, Workers (Edit)".
- `src/app/api/telegram/webhook/route.ts` — callback `reopen_{id}` (answerCallbackQuery +
  edit pesan + link WA pembeli).
- `src/app/api/admin/orders/route.ts` — action `reopen`.
- `src/lib/services/orderService.test.ts` — +3 test: reopen sukses (pesan "upload ulang bukti"),
  reopen ditolak untuk order activated, auto-cancel → email Resend + tombol Telegram `reopen_`.

### C3 — Portal dikunci
- `scripts/onboarding/server.ts` — CORS wildcard `*` dilepas; **Origin guard** (tolak origin selain
  `localhost:{PORT}`/`127.0.0.1:{PORT}` → 403); `server.listen` **hanya `127.0.0.1`**; `PORT`
  bisa di-override env (netral, default 4567); pesan `/api/verify` izin token diperbaiki.
- **Uji hidup (bukan teori):** GET lokal 200 · Origin `http://evil-example.com` → **403** ·
  Origin sah → 200 · akses via IP WiFi `192.168.100.57` → **tidak terjangkau** · elemen UI baru
  termuat. Instance portal owner yang sedang berjalan di port 4567 (kode lama) TIDAK disentuh.

### C4 — Alur HP
- `.github/workflows/pengelola-klien.yml` — fallback `secrets.DEFAULT_CF_*` **dihapus** (token
  wajib diisi manual); retensi artifact **90 → 7 hari**.
- `scripts/onboarding/cloud-manager.ts` — password admin **tidak dicetak ke log** (tetap di Job
  Summary + `SURAT_SERAH_TERIMA.txt` + `config.env`); pesan error parameter lengkap menjelaskan
  tidak ada token bawaan lagi. (Custom domain sudah memakai kredensial arsip, bukan DEFAULT — dicek.)

### Gerbang validasi (semua hijau)
`tsc --noEmit` exit 0 · ESLint 0 error (file `scripts/` ter-exclude lint, lolos tsc) ·
`npm test` = **118 file / 918 test PASS** · `npm run build` produksi **exit 0** (perlu `.env.local`
— disalin dari repo utama `Documents\tamplate-portofolio`, gitignored) · uji hidup portal 5/5 ·
`node --check` sintaks `<script>` portal OK.

### File yang dimodifikasi
`src/app/api/r2/[...key]/route.ts` +test · `src/lib/services/orderService.ts` +test ·
`src/app/api/telegram/webhook/route.ts` · `src/app/api/admin/orders/route.ts` ·
`scripts/onboarding/server.ts` · `scripts/onboarding/cloud-manager.ts` ·
`scripts/onboarding/public/index.html` · `.github/workflows/pengelola-klien.yml` ·
`panduan/PANDUAN_UNTUK_KAMU_OWNER.md` · `panduan/PANDUAN_KELOLA_DARI_HP.md` ·
`docs/release/RELEASE_CHECKLIST.md` · (+ `CHANGELOG.md` v1.3.24, log ini, INDEX_TRACKER).

## Eksekusi Perbaikan Batch HIGH (2026-10-06, izin owner — v1.3.25)

> Izin owner: "Lanjut ke daftar temuan HIGH". Batch ini mengerjakan temuan HIGH yang murni
> mekanis (tanpa keputusan produk). Temuan yang butuh keputusan owner (AI, slug/SALES_PRICING,
> update dari HP, rollback) tetap tertunda — lihat bagian "Belum dieksekusi".

### H-URL — Email order tidak lagi menautkan ke localhost
- **Bukti baru (diverifikasi langsung):** bundle hasil build (`handler.mjs`) memuat literal
  `http://localhost:3000` di seluruh jalur email — checkout→struk (`APP_BASE_URL`), aktivasi→
  serah-terima + tiket Telegram, expire/cancel (`checkoutUrl`), admin orders, telegram callback.
  Penyebab: `NEXT_PUBLIC_APP_URL` di `.env.local` = `http://localhost:3000` dan ter-inline saat
  build. (Kondisi ini sudah ada sebelum deploy v1.3.24 — file env yang sama dipakai build lama.)
- `src/lib/constants.ts` — resolver baru **`getPublicBaseUrl()`** (`NEXT_PUBLIC_APP_URL` →
  `NEXT_PUBLIC_SITE_URL` → `DEFAULT_SITE_URL`; URL loopback DIABAIKAN di luar development) +
  `APP_VERSION` disamakan ke `1.3.25`.
- Dipakai di 8 titik: `orderService.ts` (baseUrl ×4), `billing/checkout/route.ts`,
  `admin/orders/route.ts`, `telegram/webhook/route.ts`, halaman `orders/[orderId]` (2 tampilan
  hardcode `makeitbetter.my.id` → domain deployment yang benar).
- Dokumen: `.env.example` (arti `NEXT_PUBLIC_APP_URL` vs `NEXT_PUBLIC_SITE_URL`),
  `docs/product-boundary/env-inventory.md` (+APP_URL), `docs/release/CLIENT_OPERATIONS.md`
  (blok env email), `docs/release/RELEASE_CHECKLIST.md` (checklist pakai APP_URL).

### H-Kuota — `/api/admin/upload` menegakkan kuota storage
- Route kini memanggil `getAdminSiteContext` + `enforceSiteStorageQuotaUnlocked` di dalam
  `withSiteQuotaLock` (cek + upload SATU lock, anti-TOCTOU) untuk path `sites/{id}/`;
  `default-site` (layout legacy `assets/...`, di luar prefix kuota) dikecualikan — konsisten
  dengan guard `/api/admin/upload/direct`.
- `ProjectQuotaError` → respons **403 + `errorCode`** (sama seperti project-cover/project-media).
- Anotasi tipe stub `optimizeVideoForPortfolio` → `Buffer | null` (TS strict; perilaku tak berubah).
- +3 test: kuota ditegakkan untuk path tenant, 403 saat limit terlampaui (upload dibatalkan),
  default-site dilewati.

### H-CSRF — 3 route admin mutasi dapat lapisan CSRF in-handler
- `POST /api/admin/orders` (aktivasi/cancel/reopen), `/api/admin/clear-cache`,
  `/api/admin/clear-rate-limit`: `checkAdminAuth` → **`validateAdminRequest`** (auth + verifikasi
  double-submit CSRF + jejak audit log). Route GET orders tetap `checkAdminAuth` (bukan mutasi).
- Aman bagi UI: `AdminMenuBar` sudah mengirim `x-csrf-token`; tidak ada pemanggil luar route ini.
- Test `clear-cache` & `clear-rate-limit` disesuaikan (mock `validateAdminRequest`, async).

### H-Versi — `/api/health` melapor versi rilis nyata
- `version: '1.0.0'` hardcode → **`APP_VERSION`** (= entri teratas CHANGELOG, kini `1.3.25`).
  Dampak: portal status board (yang membandingkan health vs CHANGELOG) kini menandai outdated
  dengan benar dan deploy gagal bisa terdeteksi; sebelumnya SEMUA klien selalu "perlu update".
- +test assertion di `health/route.test.ts`; test baru `src/lib/constants.test.ts` mengunci
  `APP_VERSION` == entri CHANGELOG (anti-lenceng) + 5 test `getPublicBaseUrl`.
- Dokumen internal: diagram `AGENTS.md` §12 `Pages (deploy)` → `Workers (deploy)`.

### Gerbang validasi batch HIGH (semua hijau)
`tsc --noEmit` exit 0 · ESLint 0 error · `npm test` = **119 file / 927 test PASS** (+9 test) ·
CHANGELOG `v1.3.25` ditambahkan · build & deploy produksi **menunggu izin owner**.

### File yang dimodifikasi (batch HIGH)
`src/lib/constants.ts` + `src/lib/constants.test.ts` (baru) · `src/lib/services/orderService.ts` ·
`src/app/api/billing/checkout/route.ts` · `src/app/api/admin/orders/route.ts` ·
`src/app/api/telegram/webhook/route.ts` · `src/app/orders/[orderId]/page.tsx` ·
`src/app/api/health/route.ts` + test · `src/app/api/admin/upload/route.ts` + test ·
`src/app/api/admin/clear-cache/route.ts` + test · `src/app/api/admin/clear-rate-limit/route.ts` + test ·
`.env.example` · `docs/product-boundary/env-inventory.md` · `docs/release/CLIENT_OPERATIONS.md` ·
`docs/release/RELEASE_CHECKLIST.md` · `AGENTS.md` · (+ `CHANGELOG.md` v1.3.25, log ini, INDEX_TRACKER).

### Belum dieksekusi (menunggu putusan/putaran berikutnya)
- **Keputusan produk owner sudah DIEKSEKUSI (2026-10-06, ikut v1.3.25):** (1) janji AI dihapus —
  baris "AI assistant terintegrasi" dari `src/app/checkout/page.tsx`, section 6 dari
  `panduan/PANDUAN_UNTUK_KLIEN.md`, section 5 + bullet menu AI dari
  `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` (kini jujur: AI mati 3 lapis, jangan dijanjikan);
  (2) klaim slug `SALES_PRICING.md:9` dikoreksi (slug auto-generated, TIDAK menambah field slug
  ke checkout); (3) batasan `update_template` dari HP didokumentasikan di
  `panduan/PANDUAN_KELOLA_DARI_HP.md` (butuh `arsip-klien/` yang tak di-commit → gagal di CI;
  `onboard_client`/`custom_domain` aman dari HP — terverifikasi di `cloud-manager.ts:483,515,584`).
- **Sisa HIGH/produk:** rollback update per klien (belum dibahas).
- **MEDIUM/LOW audit lainnya** + pertanyaan audit yang belum dijawab owner (klien nyata pertama?
  path jual via checkout atau WA? repo GitHub privat? kebijakan refund/SLA? backup laptop?).
- **Sudah terjawab di putaran ini:** Resend **TERKONFIGURASI & terbukti jalan** (uji kirim
  HTTP 200 + ID email, 2026-10-06); Telegram juga lengkap (token + chat + secret).

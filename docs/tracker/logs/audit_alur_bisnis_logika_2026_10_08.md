# Audit Alur Bisnis & Logika End-to-End — 2026-10-08

- **Status:** 🟢 Selesai (audit read-only → lalu remediasi 18 temuan atas izin owner, sama tanggal)
- **Permintaan:** Audit menyeluruh alur bisnis (order → pembayaran → aktivasi → onboarding → deploy → admin → backup → update) sebagai auditor, bukan pemberi saran; tanpa halusinasi; istilah teknis dijelaskan.
- **Metode:** 4 pemeriksaan paralel (order/pembayaran, onboarding/deploy, auth/keamanan, admin CRUD/backup/update) + verifikasi manual langsung ke kode untuk temuan krusial.

## Temuan krusial (diverifikasi manual, file:line)

1. 🔴 **Divergensi skema database klien.** Portal onboarding memasang `SHARED_SCHEMA_QUERIES` (10 tabel, `src/crud/shared/db/schema.ts:44-62` — tabel `projects` TANPA kolom `order_index`/`cover_media_id`, `media_assets` TANPA `sort_order`, TANPA tabel `project_narratives`). Runtime membaca project via `projectSqlService.getProjectsSql` → `ORDER BY order_index` (`projectSqlService.ts:143`), `SELECT * FROM project_narratives` (`:150`), `ORDER BY sort_order` (`:154`). Skema pemilik (`d1-schema.ts:47,55`) PUNYA kolom itu, tapi `CREATE TABLE IF NOT EXISTS` = no-op jika tabel sudah dibuat portal, dan self-heal (`cloudflareD1.ts:151-212`) hanya ALTER `metadata_json`/`sites`/`orders` — **tidak pernah menambah `order_index`**. Tidak ada migrasi di `scripts/onboarding/*` (grep `order_index|ALTER` = 0). Klaim "fallback ke app_kv" dari subagent **SALAH** (grep `getProjectsFallbackFromAppKv` = 0; `loaders.ts:205-215` fallback tetap memanggil `getProjectsSql` yang sama). ⇒ Homepage/project klien baru kemungkinan error "no such column". Belum pernah diuji dengan akun Cloudflare klien nyata (jujur di CHANGELOG 1.3.20). **Wajib 1 uji nyata.**
2. 🔴 **Hasil tulis skema/seed D1 diabaikan portal** — `server.ts:163-168, 179-182, 224-227` (dan `cloud-manager.ts:240-304`) tidak mengecek respons API. Gagal = DB kosong tapi sukses dilaporkan + email "online" dikirim.
3. 🔴 **UI aktivasi order tidak ada.** `OrdersPanel.tsx` dihapus; grep `api/admin/orders` di `src/` = hanya route itu sendiri. Aktivasi/batal/reopen hanya via tombol Telegram atau curl. Tanpa bot Telegram → order berbayar macet → auto-cancel 7 hari.
4. 🟠 **Race status order:** `uploadPaymentProof` UPDATE tanpa guard status (`orderService.ts:1010-1025`, `WHERE id = ?`) → order `activated` bisa balik ke `waiting_verification`. `cancelOrder` sama (`:1327-1335`) → order `activated` bisa `canceled`.
5. 🟠 **Portal = SQL interpolation** `clientSlug`/`adminEmail` mentah (`server.ts:173,193,219`) + no guard token pemilik vs token klien + re-provision slug sama menimpa arsip/klien lain (`server.ts:187-230`).
6. 🟠 **Token klien & password admin plaintext di GitHub Actions** (`pengelola-klien.yml:43-59`) + password dicetak di Step Summary (`cloud-manager.ts:479`).
7. 🟠 **Save konten false-success:** `contentService._doSave` catch → `return false` tapi route balas `{success:true}` (labels/experience/testimonials/notes) → UI "tersimpan" padahal gagal.
8. 🟠 **Bulk delete tanpa konfirmasi** (`ProjectToolbar.tsx:88-95`),单 delete ada dialog.
9. 🟠 **Update template tanpa backup prasyarat & tanpa migrasi kolom** — self-heal hanya 3 tabel; kolom baru di release lain tidak akan sampai ke DB klien.
10. 🟡 Lain-lain tercatat di laporan: slug bisa dijual 2× setelah aktivasi, URL `workers.dev` ditampilkan tanpa subdomain akun, checkout tanpa field slug tapi error menyuruh "pilih slug lain", email gagal diam-diam tanpa resend, quota upload bisa dibobol (Content-Length nol / jalur legacy `assets/`), rate-limit login pakai IP spoofable, JWT tidak bisa dicabut, backup tanpa alerting.

## File yang diverifikasi (bukan diubah)

- `src/lib/services/orderService.ts`, `src/app/api/billing/**`, `src/app/orders/**`
- `src/crud/shared/db/schema.ts`, `src/lib/d1-schema.ts`, `src/lib/cloudflareD1.ts`, `src/lib/services/project/projectSqlService.ts`, `src/lib/loaders.ts`, `src/app/page.tsx`
- `scripts/onboarding/server.ts`, `cloud-manager.ts`, `client-deploy.ts`, `onboard-reuse.ts`, `notify-online.ts`, `.github/workflows/pengelola-klien.yml`
- `src/middleware*`, `src/lib/auth.ts`, `src/lib/security/*`, `src/lib/dataRateLimit.ts`, `src/app/api/setup/route.ts`
- Backup: `src/lib/services/d1BackupService.ts`, `src/app/api/cron/daily/route.ts`, `scripts/cloudflare/restore-d1.ts`

## Remediasi (2026-10-08 — izin owner: "fix 18 temuan kamu")

Penomoran = **18 temuan laporan akhir** (berbeda dengan nomor daftar audit di atas). Dikerjakan paralel: 4 sub-agent (panel Orders; workflow+deploy; save/konfirmasi/setup guard; load test+env guard) + agen utama (klaster skema/portal/order/race).

| # | Temuan | Status | Inti perbaikan |
|---|---|---|---|
| 1 🔴 | Skema SHARED beda dari runtime | ✅ | `schema.ts`: +`order_index`/`cover_media_id` (projects), +`alt_text`/`sort_order`/`updated_at` (media_assets), +tabel `project_narratives`; portal (server.ts & cloud-manager.ts) pasang **SHARED lalu D1_SCHEMA_QUERIES** (union); self-heal `cloudflareD1.ts` ALTER ter-guard untuk 4 tabel |
| 2 🔴 | Hasil tulis D1 diabaikan | ✅ | Helper `d1Query()` melempar error + STEP 4c **verifikasi** (7 tabel wajib, baris site, baris admin) sebelum build/deploy/email — kedua jalur portal |
| 3 🔴 | Tidak ada UI aktivasi order | ✅ | `OrdersPanel.tsx` + `/admin/system/orders` (zona Sistem & Tampilan): filter/search/pagination, Aktifkan (allowExpired), Batalkan (alasan wajib), Buka Kembali — kontrak cocok `POST /api/admin/orders` |
| 4 🟠 | Race upload/batal order | ✅ | `orderService.ts`: UPDATE ber-guard status + `RETURNING` (pola lock yang sudah ada) di `uploadPaymentProof` & `cancelOrder`; cleanup bukti R2 dipindah SETELAH cancel terkonfirmasi; +2 test race |
| 5 🟠 | SQL interpolasi portal | ✅ | Semua query portal lewat `d1Query` binding parameter (`?`); grep interpolasi = 0 |
| 6 🟠 | Slug klien bisa menimpa klien lain | ✅ | `guardCrossClientSlug()` di `onboard-reuse.ts` — tolak slug arsip akun Cloudflare **berbeda** sebelum resource dibuat (re-provision akun sama tetap boleh); +4 test |
| 7 🟠 | Kredensial plaintext di GitHub Actions | ✅ sebagian | (a) workflow pakai `secrets.CF_API_TOKEN` + `secrets.CLIENT_ADMIN_PASSWORD`; (b) password keluar dari Job Summary & log → hanya di `arsip-klien/<slug>/`. **Owner wajib membuat 2 Secret itu di repo** |
| 8 🟠 | Save konten false-success | ✅ | experience/testimonial/hardSkill/hardSkillConcept/stickyNotes/labels: `saveData()===false` → throw → route balas error |
| 9 🟠 | Bulk delete tanpa konfirmasi | ✅ | `useAdminProjects.handleBulkUpdate`: `window.confirm` berisi jumlah + "tidak bisa dibatalkan" (khusus `delete`) |
| 10 🟠 | Update template tanpa backup + self-heal 3 tabel | ✅ | `handleUpdate` jalankan `backup:d1` per klien sebelum deploy (env klien, output `backups/d1/<ts>/preupdate-<slug>`, best-effort + log); self-heal kini 4 tabel (projects/media/sites/orders) |
| 11 🟡 | Verifikasi kredensial via wrangler | ❌ **premis salah** | Kedua portal SUDAH pakai REST (`/user/tokens/verify` + `/accounts/{id}`); tidak ada wrangler yang menerima token via argumen proses → tidak diubah |
| 12 🟡 | `.env.example` key basi + tanpa guard | ✅ | Key `AI_MONTHLY_TOKEN_LIMIT_LITE/PRO` dihapus (0 pemakaian); `release:audit` +guard nilai: key `*_TOKEN/*_SECRET/*_KEY/*_PASSWORD/*_SALT` berisi non-kosong → gagal (60/60 lolos) |
| 13 🟡 | Deploy tanpa build TS | ❌ **premis salah** | `next build` compile TS dari `src/`; `tsconfig` `noEmit:true`, 0 file JS di src, `ignoreBuildErrors:false` → tidak ada jalur JS stale → tidak diubah |
| 14 🟡 | Dua skema provisioning | ✅ | Portal pasang union kedua daftar (SHARED dulu → bentuk kolomnya menang); invarian "kolom 4 tabel bersama wajib selaras" didokumentasikan di AGENTS.md §12; Setup Flow disesuaikan |
| 15 🟡 | Deploy sukses tapi site mati | ✅ | `deployClient` step 8.5 `verifySiteLiveness()` (`/api/health`→`/`, 3×, backoff 2s, timeout 15s) — site mati = `ok:false`, email "Sudah Online" tidak terkirim |
| 16 🟢 | `/api/setup` terbuka di managed deploy | ✅ | `CUSTOMER_SITE_ID` terisi → POST 404, GET balas "setup selesai"; jalur lokal owner tetap jalan; +test |
| 17 🟢 | File mati | ✅ | Hapus `scripts/deploy/build-customer.sh` + `deploy-customer.sh` (0 referensi kode); referensi AGENTS.md & BENGKEL_HANDOFF disesuaikan. `docs/POSITIONING.md` & "matrix harga basi" **tidak ada/bersih** (tak diubah) |
| 18 🟢 | Tidak ada load test order | ✅ | Fase `--order-phase` di `multi-buyer-load-test.js` (default mati): N order → baca status via token → cancel di `finally`; guard `--run-live`/`--confirm-host`/allow-flag; smoke test lokal PASS/FAIL sesuai skenario |

### File yang dimodifikasi (29 tracked + 4 baru)

- **Skema/DB:** `src/crud/shared/db/schema.ts`, `src/lib/cloudflareD1.ts`, `src/lib/d1-schema.ts` (referensi)
- **Portal/onboarding:** `scripts/onboarding/server.ts`, `cloud-manager.ts`, `onboard-reuse.ts` (+test), `client-deploy.ts`, `.github/workflows/pengelola-klien.yml`
- **Order:** `src/lib/services/orderService.ts` (+test)
- **Admin UI:** `src/app/admin/desktop/registry.ts`, `WindowContentRenderer.tsx` (+baru: `panels/OrdersPanel.tsx`, `src/app/admin/system/orders/page.tsx`), `src/app/admin/hooks/useAdminProjects.ts`
- **Save konten:** `experienceService.ts`, `testimonialService.ts`, `hardSkillService.ts`, `hardSkillConceptService.ts`, `stickyNotesService.ts`, `src/app/api/about/labels/route.ts` (+test)
- **Setup guard:** `src/app/api/setup/route.ts` (+baru: `route.test.ts`)
- **Tooling/docs:** `.env.example`, `scripts/release/audit-release-package.js`, `scripts/load/multi-buyer-load-test.js`, hapus `scripts/deploy/*.sh`, `AGENTS.md`, `docs/operations/BENGKEL_HANDOFF.md`, `CHANGELOG.md` [1.3.29], `src/lib/constants.ts` (APP_VERSION)

### Koreksi laporan (premis salah — kode TIDAK diubah)

- **Temuan 11** — verifikasi kredensial sudah REST API di dua jalur; tidak ada `wrangler ... --token` di mana pun (grep = 0).
- **Temuan 13** — tidak ada jalur deploy JS stale (bukti: `tsconfig.json noEmit:true` + exclude berlaku karena `next build` meng-compile TS sumber; `ignoreBuildErrors:false`).
- **Temuan 17** — `docs/POSITIONING.md` tidak ada di repo; matrix harga/PRD sudah menyebut "Lite/Pro dihapus, Rp199.000 tunggal" (bersih).

### Hasil verifikasi (worktree, semua hijau)

`npx tsc --noEmit` **0 error** · `npm run lint` **0 error** · `npm test` **124 file / 984 test PASS** (+12 test baru: 4 slug guard, 2 race order, 5 setup guard, 1 labels save-false) · `node scripts/release/audit-release-package.js` **60/60** · `npm run build` **exit 0** (perlu `.env.local` — worktree segar tanpa env akan gagal di prerender `/` karena `loaders.ts:214` memanggil service loader tanpa catch saat D1 belum terkonfigurasi; pre-existing, bukan regresi).

> Catatan sampingan (di luar 18 temuan, TIDAK diubah): 6 error type lama di `scripts/cloudflare/seed-sql.ts`, `set-r2-cors.ts`, `scripts/maintenance/*` (memang tidak pernah masuk typecheck karena `scripts/` di-exclude tsconfig); `tsconfig` mengecualikan `scripts/`.

### Verifikasi live terhadap D1 dummy di akun owner (2026-10-09)

Atas persetujuan owner (tidak butuh akun klien baru — cukup 2 database D1 dummy di akun Cloudflare owner yang sudah ada), skrip `scratch/verify-finding1.ts` (gitignored, bisa dijalankan ulang: `npx tsx scratch/verify-finding1.ts`) menjalankan 4 fase berurutan dengan **query runtime asli** `projectSqlService` (7 probe: SELECT homepage, narratives, media, INSERT projects/media/narratives, next order_index) + blok verifikasi portal:

| Fase | Kondisi | Hasil |
|---|---|---|
| A1 | Portal LAMA (SHARED lama saja) | 7/7 probe **GAGAL** + verifikasi portal GAGAL (hilang `project_narratives`, `orders`, `platform_settings`) = **temuan #1 terbukti** |
| A2 | A1 + boot runtime lama (`D1_SCHEMA_QUERIES`) | Loop D1 **MELEMPAR** `no such column: order_index` di `idx_projects_site_status_order` (`d1-schema.ts:162`) — **temuan lanjutan:** index gagal SEBELUM self-heal sempat jalan → bootstrap aplikasi mati total pada DB lama |
| A3 | Runtime BARU: `healProjectMediaColumns()` → loop D1 → probe | 7/7 probe **LULUS** + verifikasi LULUS (perbaikan #1 utuh untuk DB lama) |
| B | Portal BARU (SHARED baru lalu D1 + verifikasi) | Verifikasi portal + 7/7 probe **LULUS** = **temuan #2 terbukti** |

**33/33 ekspektasi cocok.** Kedua database dummy (`uji-audit-temuan1-ctl`/`-fix`) **dihapus** di blok `finally`. Temuan A2 memaksa satu perbaikan tambahan di sesi yang sama: `src/lib/cloudflareD1.ts` → `healProjectMediaColumns()` dipanggil **sebelum** loop `D1_SCHEMA_QUERIES` (6 ALTER ter-guard per tabel, toleran tabel belum ada), blok self-heal lama tetap dipertahankan. Gerbang dijalankan ulang setelah perubahan ini: `tsc --noEmit` 0, ESLint 0, **124 file / 984 test PASS**.

## Insiden rotasi token Cloudflare & pemulihan produksi (2026-10-09)

**Insiden.** Saat membersihkan token di dashboard, owner menghapus SEMUA API token lama (termasuk token `fc5c0db16a827379ea2fd2c85392c256` yang ada di `.env.local` dan sebagai Worker secret `CLOUDFLARE_D1_API_TOKEN`). Dampak terukur: token lama → API Cloudflare **401**; `makeitbetter.my.id/api/projects` & `/api/about` → **500** (semua baca D1 gagal); homepage hanya menyajikan cache ISR (200 tapi konten basi).

**Perbaikan (tanpa build/deploy** — mengikuti desain v1.3.19 bahwa Worker secret didahulukan atas nilai build-time, lihat header `scripts/cloudflare/put-worker-secrets.ts`):

1. Token baru `portfolio-template-provision` dibuat oleh owner: `Account · D1 · Edit`, `Account · Workers R2 Storage · Edit`, `Account · Workers Scripts · Edit`, Account Resources = **All accounts**, tanpa IP filter. (Baris duplikat `Workers R2 Storage · Read` dibuang; Cloudflare mengunci `Edit`-nya karena sudah ada.)
2. Nilai token diisi owner ke `.env.local` key `CLOUDFLARE_D1_API_TOKEN` (repo utama), lalu disinkronkan ke copy worktree (encoding dipertahankan UTF-8 tanpa BOM).
3. Probe token baru: `user/tokens/verify` **active**; D1 **✓** (2 database); R2 **✓** (1 bucket); Workers **✓** (1 script) — **4/4**.
4. `npx tsx scripts/cloudflare/put-worker-secrets.ts --apply --keys=CLOUDFLARE_D1_API_TOKEN` → **1 secret ditulis, 0 gagal** (hanya 1 key disentuh; 12 secret lain tidak diubah).
5. **Bukti pemulihan:** `/api/projects` → **200** `success=true` (1 project); `/api/about` → **200** (struktur konten lengkap: hero, professional, …, lastUpdated). Token lama diverifikasi mati: D1/R2/Workers semuanya 401.

**Status token di akun owner (setelah pembersihan):** 1 token aktif = `portfolio-template-provision` (dipakai: Worker secret produksi + `.env.local` untuk dev/script lokal + GitHub Secret `CF_API_TOKEN`).

## Verifikasi yang masih WAJIB dilakukan owner

1. **Uji onboarding end-to-end saat klien pertama** — temuan #1/#2 kini sudah tuntas lewat D1 dummy (33/33); yang belum teruji tinggal alur penuh portal (provision → build/deploy → homepage) dengan akun Cloudflare klien nyata — ikuti runbook `GLADI_RESIK_KLIEN_PERDANA.md`.
2. ~~Pastikan nilai repository Secret `CF_API_TOKEN` = token yang sama~~ — **dikonfirmasi owner (2026-10-09):** secret sudah diisi nilai yang sama dengan `CLOUDFLARE_D1_API_TOKEN` di `.env.local` (token `portfolio-template-provision`, 3 izin: D1 Edit, Workers R2 Storage Edit, Workers Scripts Edit, All accounts). Catatan: nilai secret tidak bisa dibaca ulang oleh siapa pun (GitHub tidak menampilkan isi secret); tes penuhnya otomatis di langkah [1/7] onboarding klien pertama (verify token SEBELUM ada resource dibuat — kalau mati, run gagal cepat & bersih). `CLIENT_ADMIN_PASSWORD` **tidak perlu dibuat** (kosong = password admin klien di-generate otomatis; diputuskan owner 2026-10-09).
3. Cek `TELEGRAM_*` & `NOTIFICATION_*` terisi di produksi (temuan audit #3 lama).
4. Cek `WORKERS_SUBDOMAIN` isi `config.env` klien pertama (URL yang ditampilkan pembeli).
5. Jalankan load test order live bila ingin uji kapasitas: `node scripts/load/multi-buyer-load-test.js --run-live --confirm-host <host> --order-phase --order-count 5` (sudah ada guard allow-flag).

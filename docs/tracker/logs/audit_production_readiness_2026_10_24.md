# Tracker Log: Audit Kesiapan Produksi + Perbaikan Bertahap (2026-10-24)

**Status:** 🟢 Completed (kode & tes + gladi resik onboarding + build owner berhasil)
**Mulai:** 2026-10-24
**Selesai:** 2026-10-25

> **Catatan rilis (2026-10-26):** seluruh perubahan di log ini sudah dipindahkan dari salinan kerja ke `main` dan dirilis sebagai **v1.3.74**. Di salinan kerja pekerjaan ini sempat bernomor 1.3.72/1.3.73, tetapi entri CHANGELOG untuk kedua nomor itu tertimpa saat penyamaan dokumen; isinya dirangkum ulang di entri 1.3.74. Verifikasi ulang di `main`: tsc 0 error, eslint bersih, `npm run pre-deploy` exit 0 dengan 150 file / 1266 test PASS. Deploy produksi dijalankan **2026-10-27** — hasilnya di bagian "Deploy 1.3.74" paling bawah.

## 🎯 Tujuan (Objective)

Audit read-only kesiapan produksi template managed-service (alur bisnis, arsitektur,
keamanan, performa, QA, deployment), lalu memperbaiki temuan secara bertahap dari
risiko tertinggi tanpa refactor besar dan tanpa mengubah perilaku yang sudah benar.

## 📋 Task List

- [x] Tahap 0 — Perbaiki mismatch `app_kv` (K1) + preflight onboarding + tes regresi
- [x] Tahap 1 — Isolasi secret deploy: D1 binding klien, hapus token dari `vars`,
      `next-env.mjs` fail-closed, liveness ketat
- [x] Tahap 2 — Keamanan data/storage: backup gagal-tertutup, kuota upload,
      ekstensi dari content-type, scoping `assets/`, SVG hardening, header ganda,
      `requireOwnerMode`, storage usage, indeks unik project
- [x] Tahap 3 — Quality gate: CI `quality.yml`, `pre-deploy` menjalankan tsc/lint/test
- [x] Gladi resik onboarding nyata di akun Cloudflare uji (login, konten, health,
      token/vars, header, SVG) — berhasil
- [x] Verifikasi akhir build situs **owner** (`npm run build` dari worktree) — berhasil
- [ ] Hapus resource gladi resik (menunggu konfirmasi owner)

## 📂 File yang Dimodifikasi (Modified Files)

### Tahap 0 (v1.3.72)

- `src/lib/cloudflareD1.ts` — `getAppKvColumns()` (PRAGMA, memoized); `setD1Value` dan
  `compareAndSetD1Value` mengisi kolom `id` saat tabel memakai skema bersama portal.
- `scripts/onboarding/app-kv-preflight.ts` (baru) — probe tulis → baca → upsert → hapus.
- `scripts/onboarding/server.ts` — panggil preflight setelah skema dipasang (STEP 4b).
- `scripts/onboarding/cloud-manager.ts` — panggil preflight yang sama (jalur CLI).
- `src/lib/cloudflareD1.appKv.test.ts` (baru) — 3 tes dua bentuk tabel.
- `scripts/onboarding/app-kv-preflight.test.ts` (baru) — 4 tes preflight.
- `src/lib/constants.ts` — `APP_VERSION` 1.3.71 → 1.3.72.
- `CHANGELOG.md` — entri 1.3.72.

### Tahap 1

- `src/lib/cloudflareBinding.ts` (baru) — `hasLiveCloudflareContext()`,
  `getD1Binding()` (binding `env.DB`, fallback REST saat build/dev).
- `src/lib/cloudflareD1.ts` — memakai helper binding bersama.
- `src/crud/shared/db/connection.ts` — query D1 lewat binding lebih dulu; fallback REST;
  `isD1Configured()` mengenali runtime Worker tanpa token.
- `scripts/onboarding/client-deploy.ts` — binding `d1_databases` (`DB`) di wrangler
  klien; token D1 tidak lagi di `overrides`/`vars`; `next-env.mjs` fail-closed;
  liveness wajib 200 + `status:ok`.
- `scripts/onboarding/client-deploy.test.ts` — 20 tes (binding, build-only token,
  fail-closed, rewrite next-env, liveness, R2).

### Tahap 2

- `src/lib/services/d1BackupService.ts` — `readTableWithRetry()` + backup batal
  (tidak ada file parsial) saat satu tabel gagal.
- `src/app/api/admin/upload/direct/route.ts` — ukuran upload sebenarnya dipakai
  untuk cek kuota saat `Content-Length` tidak ada.
- `src/app/api/admin/upload/route.ts` — ekstensi dari `extFromContentType()`.
- `src/lib/media/uploadHelpers.ts` — ekstensi audio/ICNS + fallback scoping
  `assets/...` ke `sites/<id>/...`.
- `src/app/api/r2/[...key]/route.ts` — SVG `Content-Disposition: attachment` + CSP.
- `src/middleware/utils.ts` — header statis tidak lagi duplikat; hanya CSP.
- `src/app/api/admin/sites/route.ts` + `.../[siteId]/entitlements/route.ts` —
  `requireOwnerMode()` di semua handler.
- `src/app/api/admin/sites/route.test.ts` — stub `OWNER_MODE=true`.
- `src/lib/product/siteStorageUsage.ts` — `backups/` tidak dihitung.
- `src/crud/shared/db/schema.ts` — indeks unik `idx_projects_site_slug`.

### Tahap 3

- `.github/workflows/quality.yml` (baru) — tsc + lint + unit test pada push/PR.
- `scripts/deploy/pre-deploy-check.js` — wajib `CRON_SECRET`; jalankan
  `tsc --noEmit`, `npm run lint`, dan `npm test` sebelum build/deploy.

### Gladi Resik (temuan + perbaikan)

- `scripts/onboarding/client-deploy.ts` — `ClientEnvPlan.buildOnly` (token D1 hanya
  saat build); `ensureR2Bucket()` (create/verify + pesan actionable); preflight R2
  sebelum build; `CfEnvelope.errors.code`.
- `scripts/onboarding/server.ts` — STEP 3 R2 fail-closed (tidak lagi `console.warn`).
- `scripts/onboarding/cloud-manager.ts` — STEP 3 R2 fail-closed (jalur CLI).
- `scripts/onboarding/client-deploy.test.ts` — +5 tes (token build-only, 4 R2).

### Portal Detail Klien + Brankas (v1.3.73)

- `scripts/onboarding/env-file.ts` (baru) — parser env + `upsertEnvFile()` yang
  mempertahankan isi/CRLF `.env.local`; hanya hash/salt yang ditulis.
- `scripts/onboarding/portal-vault.ts` (baru) — scrypt hash/salt, validasi password,
  `VaultAttemptLimiter` (5 gagal → 5 menit), `VaultSessionStore` (120 detik),
  `getCookie()`; password asli tidak pernah disimpan.
- `scripts/onboarding/portal-clients.ts` (baru) — validasi nama folder arsip
  (anti-traversal/symlink), ringkasan tanpa password, detail dengan identifier
  dimask, dan `readClientSecrets()` allowlist.
- `scripts/onboarding/server.ts` — endpoint `/api/client-detail`, `/api/vault/setup`,
  `/api/vault/unlock`, `/api/vault/lock`, `/api/client-secrets`; Host loopback +
  `X-Portal-Request`; `/api/clients` dan `/api/custom-domain` tidak lagi mengirim
  `adminPassword`; `PORTAL_ENV_LOCAL_PATH` hanya untuk pengujian lokal.
- `scripts/onboarding/public/index.html` — tombol Detail, modal 4 bagian, 7 field
  rahasia, form buat/buka brankas, hitung mundur 30 detik, tombol sembunyikan,
  Esc/overlay close, perbaikan `colspan` tabel status 6 → 7.
- `scripts/onboarding/env-file.test.ts`, `portal-vault.test.ts`,
  `portal-clients.test.ts` (baru) — 20 tes.
- `src/lib/constants.ts` — `APP_VERSION` 1.3.72 → 1.3.73.
- `CHANGELOG.md` — entri 1.3.73.
- `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` — bagian 6b: cara pakai Detail + brankas.
- `docs/product-boundary/env-inventory.md` — daftar kunci brankas portal (nama saja).

### Dokumen

- `docs/tracker/logs/audit_production_readiness_2026_10_24.md` (file ini)
- `docs/tracker/INDEX_TRACKER.md` — entri baru

## 🐛 Bug & Perbaikan (Bug Tracker)

- **Bug K1 (KRITIS): database klien baru tidak bisa login / menyimpan konten.**
  - **Penyebab:** `SHARED_SCHEMA_QUERIES` membuat `app_kv` dengan `id TEXT PRIMARY KEY`
    (NOT NULL) + `key UNIQUE`; `setD1Value`/`compareAndSetD1Value` hanya mengirim
    `(key, value, updated_at)` → `NOT NULL constraint failed: app_kv.id`. Rate-limit
    login gagal → 429; seluruh simpan konten gagal. Database owner aman karena dibuat
    lewat `bootstrapD1Schema`/`cf:bootstrap` dengan bentuk `key TEXT PRIMARY KEY`.
  - **Perbaikan:** penulis adaptif (deteksi kolom `id`) + preflight onboarding yang
    menghentikan provisioning sebelum deploy bila `app_kv` tidak bisa ditulis.
  - **Bukti:** reproduksi lokal `node:sqlite`; 7 tes baru PASS; suite penuh
    146 file / **1222 test PASS**; `tsc --noEmit` 0 error; `eslint src` bersih;
    gladi resik onboarding nyata berhasil login + simpan/restore konten.

- **Bug K2 (TINGGI): token D1 owner/klien ditanam di `vars` Worker klien.**
  - **Penyebab:** `connection.ts` hanya bisa lewat REST sehingga build klien
    menyertakan `CLOUDFLARE_D1_API_TOKEN` di env runtime.
  - **Perbaikan:** binding `env.DB` di wrangler klien + dukungan binding di
    `connection.ts`; token tidak lagi masuk `overrides`.
  - **Token build-only:** `next build` masih perlu REST untuk prerender, jadi token
    dipasang di `buildOnly` (dipakai build, dibuang dari `next-env.mjs`, tidak masuk
    `vars`). Tanpa ini build klien akan gagal `Cloudflare D1 env is incomplete`.
  - **Catatan:** belum ada klien nyata, jadi tidak ada Worker klien lama yang
    membawa token ini. Klien pertama nanti otomatis memakai binding.

- **Bug K3 (TINGGI): backup parsial dilaporkan sukses.**
  - **Perbaikan:** retry 1x per tabel, lalu batalkan seluruh backup bila masih gagal.

- **Bug K4 (SEDANG): kuota upload bisa dilewati dengan request tanpa
  `Content-Length`; ekstensi file mengikuti nama kiriman user.**
  - **Perbaikan:** ukuran byte aktual + ekstensi kanonik dari content-type.

- **Bug K5 (SEDANG): SVG dari `/r2` bisa dieksekusi sebagai dokumen (stored XSS).**
  - **Perbaikan:** `Content-Disposition: attachment` + CSP ketat untuk SVG.

- **Bug K6 (SEDANG): header keamanan ganda + HSTS tidak valid.**
  - **Perbaikan:** header statis hanya di `next.config.mjs`; middleware hanya CSP.

- **Bug K7 (SEDANG): route `sites` & entitlement bisa diakses dari site klien.**
  - **Perbaikan:** `requireOwnerMode()` → 404 di deployment klien.

- **Bug K8 (TINGGI): kegagalan bucket R2 di-swallow, provisioning tetap "sukses".**
  - **Ditemukan saat gladi resik:** akun Cloudflare baru belum mengaktifkan R2 →
    API membalas `code: 10042`; portal hanya `console.warn`, menampilkan
    "Infrastruktur Siap", build 5–10 menit, lalu `wrangler deploy` gagal
    (`R2 bucket 'media-...' not found`, `10085`).
  - **Perbaikan:** `ensureR2Bucket()` dipakai portal + CLI + preflight deploy;
    kegagalan R2 sekarang menghentikan proses dengan pesan actionable (aktifkan R2 /
    buat bucket / perbaiki izin token), sebelum build panjang.
  - **Tes:** 4 tes baru (ada, 10042, 404, create saat sudah ada).

## ✅ Verifikasi v1.3.73 (Portal Detail + Brankas)

- `npx vitest run scripts/onboarding/env-file.test.ts scripts/onboarding/portal-vault.test.ts scripts/onboarding/portal-clients.test.ts` → **3 file / 20 tes PASS**.
- `npx vitest run` → **149 file / 1242 tes PASS**.
- `npx tsc --noEmit` → 0 error; `npm run lint` → bersih.
- Uji server terpisah (`PORT=4568`, env brankas sementara di `%TEMP%`):
  `/api/clients` tanpa `adminPassword`; detail 4 bagian + 7 field rahasia;
  setup/unlock/lock berhasil; password salah 401; percobaan ke-5 429;
  setup ulang 409; password asli tidak ada di file env; Host palsu 403;
  tanpa `X-Portal-Request` 400; traversal folder 400.
- Uji browser: modal terbuka, 7 field termask, form buat brankas tampil,
  unlock menampilkan nilai asli, tombol sembunyikan mengembalikan mask,
  auto-hide 30 detik bekerja, tidak ada error console.
- `npm run build` (Next.js 16.3.6, Turbopack, `.env.local`) → **berhasil**;
  74 halaman statis dihasilkan, TypeScript build 0 error. Peringatan
  `middleware` deprecated sengaja dibiarkan (OpenNext butuh `middleware.ts`).
- Env uji sementara sudah dihapus; `.env.local` asli tidak disentuh.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)

- Database klien yang sudah terlanjur dibuat dengan skema bersama **tidak perlu migrasi**:
  penulis adaptif membuat tulis berhasil pada bentuk mana pun.
- **Belum ada klien nyata** (konfirmasi owner, 2026-10-24). Artinya:
  - Tidak ada database klien lama yang harus diperbaiki/di-deploy ulang.
  - `deployClient()` baru akan dipakai pertama kali saat klien pertama dibuat —
    jalur inilah yang paling perlu diuji (gladi resik) sebelum menjual.
  - Situs owner (`makeitbetter.my.id`) tidak lewat `deployClient()`; ia memakai
    `npm run deploy`, jadi perubahan binding D1/token tidak mengubahnya.
- Preflight memakai `PRAGMA table_info(app_kv)` dan upsert `ON CONFLICT(key)`; jangan
  mengubahnya menjadi INSERT tanpa `id` karena akan mengulang bug K1.
- Karena belum ada klien nyata, tidak ada deploy ulang yang perlu dikejar.
  **Gladi resik onboarding sudah dijalankan** pada 2026-10-24 dengan akun Cloudflare
  uji (slug `gladi-2026-10-24`):
  - Login admin, simpan + restore konten `about`, dan `/api/health` (`200` +
    `status:ok`, `database:connected`) semuanya berhasil.
  - **CRUD admin terverifikasi lewat API yang dipakai panel**:
    - Projects: create (201) → read (200) → update (200) → delete (200) → 404.
      Draft tidak muncul di daftar publik. Satu delete sempat **503 transien**,
      retry berikutnya 200 (perlu retry di UI, bukan kegagalan permanen).
    - Testimonial: create → update → get → delete, semua 200.
    - About: update → read → restore, semua 200.
    - Media: upload SVG → served `attachment` + CSP → delete, semua 200.
  - `CLOUDFLARE_D1_API_TOKEN` **tidak ada** di `vars`; binding `DB` (D1) ada;
    `OWNER_MODE`/`NEXT_PUBLIC_OWNER_MODE` = `false`.
  - `/api/admin/pricing` dan `/api/admin/orders` → **404** untuk admin klien
    (tanpa login middleware membalas 401 lebih dulu — catatan minor).
  - HSTS tunggal; SVG uji tersimpan scoped + disajikan `attachment` + CSP ketat.
  - **Status Klien** (portal `/api/status`, 2026-10-25): `online: true`,
    `httpStatus: 200`, `latencyMs: 918`, `deployedVersion: 1.3.72`,
    `database: connected`.
  - **Custom Domain** (2026-10-25): zone `makeitbatter.my.id` **aktif**;
    hostname `gladi.makeitbatter.my.id` berhasil di-attach ke Worker
    `gladi-2026-10-24`. Verifikasi HTTPS: `/api/health` **200** (`status:ok`,
    `database:connected`) dan `/admin/login` **200**; sertifikat TLS valid.
  - Resource uji (Worker/D1/R2/KV + `arsip-klien/01_gladi-2026-10-24`) **masih ada**
    dan menunggu konfirmasi owner sebelum dihapus. Custom domain juga masih terpasang
    sampai owner menyetujui cleanup.
- **Belum diperbaiki / risiko tersisa:**
  - `JWT_SECRET`, `PASSWORD_SALT`, `CRON_SECRET` masih ditulis sebagai `vars`
    `plain_text` (bukan `secret_text`). Untuk klien, pemilik akun memang bisa
    melihatnya; pertimbangkan migrasi ke secret Cloudflare bila model ancaman berubah.
  - `/api/admin/pricing` & `/api/admin/orders` membalas **401** (bukan 404) untuk
    request tanpa login karena middleware auth berjalan lebih dulu; admin klien yang
    login tetap mendapat 404. Tidak membocorkan data, hanya keberadaan path.
  - Satu `DELETE /api/projects/:id` sempat membalas **503 transien**; retry langsung
    berhasil 200. Penyebab pasti belum ditelusuri (kemungkinan kontensi D1/audit log).
    Pastikan UI menampilkan error + tombol coba lagi, bukan menganggap sukses.
  - `withSiteQuotaLock` masih per-isolat (bukan lock lintas-isolat); dua upload
    bersamaan di isolate berbeda bisa melewati kuota sedikit.
  - `assertWallpaperImageDimensions` masih no-op (sharp belum kembali setelah migrasi
    Cloudflare); wallpaper sub-1080p tidak ditolak.
  - `/api/health` masih publik menampilkan versi/uptime/memori (dipakai portal untuk
    cek versi); pertimbangkan membatasi detail bila tidak diperlukan.
  - Portal lokal `127.0.0.1:4567` tetap hanya untuk laptop owner. Sejak v1.3.73
    `/api/clients` dan `/api/custom-domain` **tidak lagi** mengembalikan
    `adminPassword`; kredensial hanya lewat `/api/client-secrets` setelah brankas
    dibuka. Jangan pernah membuka port 4567 ke jaringan publik.
  - Portal `4567` yang sedang berjalan masih memuat kode lama sampai ditutup lalu
    dibuka ulang lewat `PENGELOLA_KLIEN.bat`.
  - Brankas asli **belum dibuat** di `.env.local`. Owner harus membuat kata sandi
    brankas langsung di modal Detail; jangan pernah mengirimkan kata sandi itu ke AI
    atau menyimpannya di chat. Jika lupa, hapus `PORTAL_VAULT_HASH` +
    `PORTAL_VAULT_SALT` dari `.env.local`, restart portal, lalu buat ulang.
  - `PORTAL_ENV_LOCAL_PATH` hanya override pengujian lokal; produksi tetap memakai
    `.env.local` di root repo.
  - `arsip-klien/<slug>/config.env` menyimpan `CLOUDFLARE_ACCOUNT_ID`,
    `CLOUDFLARE_API_TOKEN`, `ADMIN_PASSWORD`, `JWT_SECRET`, `PASSWORD_SALT`, dan
    `CRON_SECRET` dalam **plain text**. Folder ini gitignored, tetapi
    menu **[2] Salin Cadangan** di `PENGELOLA_KLIEN.bat` menyalinnya ke flashdisk tanpa enkripsi. Risiko utama ada
    pada kebocoran fisik/backup, bukan repo.
  - `public/` ~118 MB (termasuk `ffmpeg-core.wasm` 30 MB dan video demo duplikat);
    pembersihan butuh persetujuan owner.
  - Build Next.js **owner** sudah diverifikasi (`npm run build` berhasil, 74 halaman).
    Build OpenNext/`cf:build` untuk deploy owner belum dijalankan ulang di sesi ini;
    build **klien** sudah terbukti berhasil di gladi resik.
- `node_modules` worktree sempat kosong; `npm ci` sudah dijalankan (971 paket).
- Sebelum rilis: putuskan apakah resource gladi resik dihapus atau disimpan sebentar
  untuk inspeksi owner; jalankan `cf:build`/`npm run deploy` hanya saat siap deploy.

## 🚀 Deploy 1.3.74 + Verifikasi Produksi (2026-10-27)

Atas persetujuan owner, seluruh perubahan dipindahkan ke `main` (8 commit,
`c58d5be..efc779f`), di-deploy ke site owner, lalu di-push ke GitHub.

**Jalur deploy:** `npm run deploy` (bukan portal — portal sengaja menolak site owner).
Gerbang `pre-deploy` yang baru ikut berjalan di dalam deploy:

- `npx tsc --noEmit` → 0 error; `npm run lint` → bersih.
- `npm test` → **150 file / 1266 test PASS**.
- `cf:compat-audit --strict` → 0 blocking (compatibility_date 2026-06-28).
- `Uploaded portfolio-os-template (31.60 sec)`, `Deployed … triggers (3.70 sec)`,
  Version ID `b1d96dd1-89a1-4824-b6fd-c923f0b081a3`.

**Verifikasi produksi (`https://makeitbetter.my.id`):**

| Cek | Hasil |
|---|---|
| `/api/health` | **200**, `version=1.3.74`, `database=connected`, `databaseLatencyMs=92` |
| `workerHealth` (owner mode) | ada, `ok=32/32`, `failed1102=0`, `passed=true` |
| `/` | 200 |
| `/admin/login` | 200 |
| `/api/admin/pricing` (owner-only) | 401 (tanpa login) |
| `/api/admin/orders` (owner-only) | 401 (tanpa login) |
| `/admin/harga` | 307 → login |
| `/admin/system/orders` | 307 → login |
| `portfolio-os-template.m4keitbetter.workers.dev/api/health` | 200 |
| `/api/projects`, `/api/about`, `/api/hard-skills` | 200 / 200 / 200 (`/api/skills` memang tidak ada → 404) |

**Header (perubahan rilis ini):** `Strict-Transport-Security` muncul **tepat satu**
(`max-age=31536000; includeSubDomains; preload`), `Referrer-Policy`
`strict-origin-when-cross-origin` satu nilai, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, CSP ada. Artinya header kembar sudah hilang di
produksi (sebelumnya dua sumber).

**Catatan jujur — 1102 sementara:** dua permintaan pertama tepat setelah deploy
(`/api/health` lalu `/`) sempat dibalas `error code: 1102` (Worker melewati batas CPU).
Uji ulang 4 detik kemudian: **5/5 permintaan 200**, `/` juga 200. Pola ini cocok dengan
cold start/rollout versi baru, bukan regresi; tetap perlu dipantau karena 1102 adalah
risiko yang sudah tercatat (probe harian `workerHealth` jadi alat deteksinya).

**CI:** workflow **Quality Gate** pada commit `efc779f` → **success** (±2,3 menit).

**Push:** `c58d5be..efc779f main -> main` (repo `raaOS/portfolio-template`), lokal dan
remote sama (`efc779f`). Tidak ada tag, tidak ada force push.

**Masih menunggu keputusan owner:** resource gladi resik (Worker/D1/R2/KV/zona uji +
`arsip-klien/01_gladi-2026-10-24`) belum dihapus, sesuai instruksi untuk tidak menghapus
tanpa izin.


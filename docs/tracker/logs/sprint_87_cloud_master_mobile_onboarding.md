# Sprint 87 - Cloud Master Mobile Onboarding & GitHub Actions Automation (v1.2.7)

> **Status:** 🟢 Completed  
> **Tanggal:** 10 September 2026  
> **Versi Template:** `1.2.7`  
> **Tipe:** Cloud Automation, Mobile Workflow, Owner Tooling & CI/CD  
> **Fokus Utama:** Mengaktifkan kapabilitas pengelolaan klien penuh dari smartphone (Android / iPhone) tanpa perlu menyalakan PC/laptop, memanfaatkan GitHub Actions cloud runner untuk provisioning D1, R2, migrasi skema tabel, seed akun, kompilasi OpenNext, deployment ke Cloudflare Pages, serta rendering Job Summary dan pesan WhatsApp siap salin.

---

## 1. Latar Belakang & Kebutuhan

Pengguna menanyakan:
> *"apa gak bisa ketika aku di luar pc, lewat web hp menjalankan PENGELOLA_KLIEN.bat"*  
> *"cara 3 bisa?"*

Sebelumnya, file `PENGELOLA_KLIEN.bat` hanya dapat dijalankan secara lokal di PC Windows karena membutuhkan kompilasi OpenNext (`npm run cf:build`), prosesor (CPU), memori, serta akses lokal. Saat owner bepergian atau berada di luar tanpa PC, owner tidak dapat mendaftarkan klien baru atau mengirim update template.

Dengan menerapkan **Cara 3 (Cloud Automation via GitHub Actions)**:
- Seluruh beban komputasi (Node.js, kompilasi Next.js/OpenNext, dan Wrangler CLI) dipindahkan ke server cloud GitHub (Ubuntu runner 16GB RAM) yang gratis dan berkecepatan gigabit.
- Owner cukup membuka formulir interaktif di aplikasi **GitHub Mobile** atau browser HP di mana saja.

---

## 2. Rincian Implementasi

### A. Cloud Manager Engine Mandiri (`scripts/onboarding/cloud-manager.ts`)
- Menerima parameter CLI maupun environment variables untuk 3 skenario operasional:
  1. `onboard_client`:
     - Verifikasi token & account ID via Cloudflare API v4.
     - Otomatisasi pembuatan D1 DB (`db-{slug}`) dan R2 Bucket (`media-{slug}`).
     - Migrasi 8 tabel DDL skema database (`SHARED_SCHEMA_QUERIES`).
     - Seed baris `sites` dan `site_users` dengan hash password `scrypt`.
     - Pembuatan berkas arsip lokal `arsip-klien/{folder}/config.env` dan `SURAT_SERAH_TERIMA.txt`.
     - Kompilasi OpenNext (`npm run cf:build`) dan deployment instan via `wrangler pages deploy`.
  2. `update_template`:
     - Kompilasi template versi terbaru dan deployment batch/single ke website klien.
  3. `custom_domain`:
     - Pendaftaran domain kustom ke Cloudflare Pages via API `/accounts/{id}/pages/projects/{slug}/domains`.
- Integrasi ke `$GITHUB_STEP_SUMMARY` untuk menampilkan tabel status dan pesan WhatsApp siap salin di layar HP owner.

### B. GitHub Actions Workflow (`.github/workflows/pengelola-klien.yml`)
- Trigger: `workflow_dispatch` dengan formulir input ramah HP:
  - `action_type` (dropdown pilihan aksi)
  - `client_name`, `client_slug`, `template_key`, `admin_email`, `admin_password`
  - `cloudflare_account_id`, `cloudflare_api_token` (dengan fallback ke GitHub Secrets)
  - `custom_domain`, `update_target`
- Pengarsipan otomatis: Berkas kredensial di `arsip-klien/` dibungkus aman sebagai GitHub Actions Artifacts terenkripsi selama 90 hari.

### C. Panduan Penggunaan Mobile (`panduan/PANDUAN_KELOLA_DARI_HP.md`)
- Panduan 3 langkah praktis berbahasa Indonesia untuk owner membuka workflow dari aplikasi GitHub Mobile atau browser HP.

---

## 3. Berkas yang Dimodifikasi & Ditambahkan

| Berkas | Status | Peran |
|---|---|---|
| `scripts/onboarding/cloud-manager.ts` | Baru | Engine CLI eksekusi otomasi cloud D1/R2/deploy/domain |
| `.github/workflows/pengelola-klien.yml` | Baru | Workflow manual trigger GitHub Actions dengan form HP |
| `panduan/PANDUAN_KELOLA_DARI_HP.md` | Baru | Panduan cara kelola klien dari aplikasi HP |
| `CHANGELOG.md` | Dimodifikasi | Penambahan rilis v1.2.7 |
| `docs/tracker/INDEX_TRACKER.md` | Dimodifikasi | Pencatatan Sprint 87 |

---

## 4. Hasil Verifikasi

1. **TypeScript Static Analysis:**
   - `npx tsc --noEmit`: **0 error**.
2. **Unit Test Suite:**
   - 109 test files passed (109/109).
   - 821 unit tests passed (821/821).
   - 0 failures, 0 errors.
3. **Workflow Syntax & Logic:**
   - Validasi struktur YAML `workflow_dispatch` sesuai standar GitHub Actions v4.

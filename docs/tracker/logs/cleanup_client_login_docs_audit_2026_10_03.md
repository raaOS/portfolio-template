# Log Pekerjaan: Sisa Jejak Sistem Login Klien di Dokumen & Uji Beban + 2 Kegagalan Audit Rilis

**Tanggal:** 2026-10-03
**Instruksi owner:** membalas **"1,2,3,4"** atas 4 poin yang ditawarkan:
1. Deploy dulu → baru `--apply` database.
2. Merge ke `main`.
3. Bersihkan sisa jejak sistem login klien (8 dokumen + `multi-buyer-load-test.js:686`).
4. Dua kegagalan `release:audit` pre-existing.

**Hasil singkat:** poin **3** dan **4** selesai & ter-commit. Poin **1** dan **2** **DITAHAN** — bukan karena ragu, tetapi karena repo utama sedang kotor (lihat §4).

---

## 1. Poin 3 — Sisa jejak sistem login klien

### 1a. Fakta yang dulu tidak ketahuan (menentukan cara perbaikinya)

Sebelum mengedit, jalur login/auth diverifikasi ke kode sumber:

| Fakta | Bukti |
|---|---|
| `src/app/api/client/` **tidak ada sama sekali** (0 file) | `glob src/app/api/client/**/route.ts` → no files |
| `/{slug}/login` sudah dihapus | `src/app/[siteSlug]/` hanya berisi `page.tsx`, `layout.tsx`, `projects/**` |
| `/client/dashboard` tidak ada | `src/app/` tidak punya folder `client` |
| Mutasi konten (`/api/projects`, upload) butuh **`site_user_token`**, bukan `admin_token` | `src/lib/admin/siteMutationAuth.ts:12-14` → `getSiteUserSession` + `session.siteId === SITE_ID` |
| Login pembeli = `POST /api/auth/login` `{email,password}` → `authenticateUser(SITE_ID, ...)` | `src/app/api/auth/login/route.ts:44-47` |
| Panel pengganti dashboard client = `/admin/client-dashboard` (folder ada) | `src/app/admin/client-dashboard/` |
| Token admin juga wajib klaim `siteId` (audit 2026-09-29) | `src/lib/auth.ts:106-112` `claims.siteId === SITE_ID` |

Kesimpulan non-IT: **pembeli sekarang cuma punya satu pintu, yaitu `/admin/login`.** Semua tulisan dokumen yang menjanjikan `/{slug}/login`, `/client/login`, `/client/dashboard`, "client access", dan "reset password lewat email" adalah iklan untuk pintu yang sudah roboh.

### 1b. Dokumen yang diperbaiki (15 file)

| File | Yang diperbaiki |
|---|---|
| `docs/release/CLIENT_OPERATIONS.md` | "Link Client" (2 link mati → `/admin/login`), langkah **Buat Client Access** diganti alur `/setup`, "Flow Project Client" jelas lewat panel, 2 baris support checklist |
| `docs/release/RELEASE_CHECKLIST.md` | 1 perintah vitest menunjuk `client-access/route.test.ts` (tidak ada), smoke `GET /client/login`, 3 baris pasca-deploy (login/reset/client), pola URL serah-terima |
| `docs/release/BUYER_ONBOARDING.md` | 3 URL smoke lokal, kalimat "cannot be considered self-service", checklist pasca-deploy (7-9, renumber), 2 baris Operating Model, 1 baris "Do Not Do" |
| `docs/release/SALES_PRICING.md` | "Dashboard client self-service", "Reset password via email", copy penjualan "Client bisa login", prasyarat pre-sale. **+1 frasa `manual invoice` (lihat §2)** |
| `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md` | URL smoke `:55`, harapan `cf:readiness` `:38` (cek reset-password → cek notifikasi email) |
| `docs/release/RC1_RELEASE_NOTES.md` | "Validate client login manually" |
| `docs/operations/support-playbook.md` | Gejala `/<siteSlug>/login`, diagnosa "cek client access" (→ akun panel + CLI reset), baris tabel eskalasi (email reset → reset manual) |
| `docs/operations/buyer-onboarding-checklist.md` | Prasyarat env email reset, **§2 Set Client Access** (→ akses panel `/setup`), §3 kredensial (URL + instruksi), §5 dashboard |
| `docs/operations/backup-restore-runbook.md` | 2 baris manual check staging, catatan "token hash reset password" di backup |
| `docs/operations/monitoring-runbook.md` | Event log `client.login` + `client_access.save` (0 emit di `src/`) |
| `docs/agent-context/00_PRD_PRODUCT.md` | Target user "Client bisa login", MVP "1 Dashboard Client" |
| `docs/agent-context/02_BACKEND_D1_CONTEXT.md` | Tabel `client_access` ditandai **tabel warisan** (0 kode membaca) |
| `docs/agent-context/04_ENDPOINT_CONTRACT.md` | Seluruh blok **Client API** (9 endpoint `/client/*` tak ada) + **Client Password Reset API** dihapus/ditulis ulang; contoh respons masih punya `"plan": "lite"` (sisa v1.3.15 yang lolos) |
| `docs/agent-context/05_UI_TEMPLATE_CONTEXT.md` | "login di `/[siteSlug]/login`" |
| `docs/product-boundary/env-inventory.md` | +2 env baru uji beban (lihat §1c) |

Sisa rujukan `/client/login`, `/api/client/`, `client_access.save` setelah pembersihan = **hanya di arsip `docs/tracker/logs/` + `docs/tracker/INDEX_TRACKER.md`** (sengaja dipertahankan, sesuai keputusan owner bahwa "tanpa jejak" = bersih di kode & commit, bukan rewrite riwayat).

### 1c. `scripts/load/multi-buyer-load-test.js` — diperbaiki, bukan sekadar dihapus

Temuan: skrip ini memanggil **4 endpoint yang sudah tidak ada** (`POST /api/client/login`, `POST /api/admin/sites/:id/client-access`, `POST /api/client/sites/:id/project-cover|project-media`, `POST /api/client/sites/:id/project-video/presign`) → artinya uji beban ini **mustahil jalan sejak v1.3.14**. Sekadar menghapus baris 686 akan memindahkan kegagalan ke baris berikutnya.

Yang dilakukan:

1. **Login client → login panel.** Sesi `client` diganti dua sesi: `visitor` (anonim, untuk GET public) dan `siteUser` (baru, `createSiteUserSession()`) yang login ke `POST /api/auth/login`. Env baru: `LOAD_TEST_SITE_USER_EMAIL` / `LOAD_TEST_SITE_USER_PASSWORD` (didokumentasikan di `env-inventory.md`).
2. **4 endpoint diganti ke jalur yang benar-benar ada:** upload → `/api/admin/sites/:id/project-cover|project-media|project-video/presign` (kontrak diverifikasi ke route: field `file`, respons `publicUrl`/`key`/`uploadUrl` — sama persis dengan yang diharapkan skrip).
3. **Bug token admin diperbaiki:** `buildAdminToken()` tidak mengirim klaim `siteId`, padahal `verifyAdminToken()` menolak token tanpa klaim itu sejak audit 2026-09-29 → login admin dengan `JWT_SECRET` pasti 401. Ditambahkan `siteId: process.env.CUSTOMER_SITE_ID || 'default-site'`.
4. **Check isolation lintas-tenant di-retire** (bukan diam-diam dihapus): dulu check ini membutuhkan **dua sesi login berbeda, satu per tenant** untuk membuktikan site A tidak bisa menulis site B. Karena sistem login per-tenant sudah dihapus dan hanya ada **satu** akun panel per deployment, check itu kini akan **selalu lolos secara palsu**. Fungsinya diganti `runIsolationChecks()` yang selalu `skipped: true` + alasan di komentar kode.

**Verifikasi:** `node --check` = 0 · dry-run `node scripts/load/multi-buyer-load-test.js --target http://localhost:3000 --tenants 2` = **exit 0** (2/2 tenant, report JSON+MD tertulis). **Belum dijalankan `--run-live`** (butuh kredensial panel + target, dan akan menulis ke server).

---

## 2. Poin 4 — 2 kegagalan `release:audit` pre-existing

| # | Kegagalan | Analisis | Perbaikan |
|---|---|---|---|
| 1 | `No forbidden personal/deprecated env keys in .env.example` → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_BOT_SECRET` | Pola `/^TELEGRAM_/` adalah sisa era "automasi pribadi dihapus" (Sprint 1). Tapi bot Telegram di `.env.example` kini **fitur produk opsional** ("Telegram Billing Admin Bot") dan dipakai `orderService.sendTelegramMessage` untuk notifikasi order + tiket bengkel v1.3.16 | Pola `/^TELEGRAM_/` dihapus dari `forbiddenEnvPatterns` + komentar alasan. Pola `FIREBASE_`, `VERCEL_`, `JOB_BOT_`, `GLINTS_`, `JOBSTREET_` **tetap**; `forbiddenScriptPatterns` (`telegram:` npm script) juga tetap |
| 2 | `Release docs mention: manual invoice` | Frasa wajib, artinya dokumen rilis **wajib** menjelaskan pembayaran sebagai manual invoice. `SALES_PRICING.md` bilang "Pembayaran manual (QRIS/transfer)" tapi tidak memakai kata itu | Kalimat di `SALES_PRICING.md:52` jadi: *"Pembayaran manual invoice (QRIS/transfer) lewat halaman order; tidak ada payment gateway otomatis."* — guard **dipertahankan**, dokumennya yang diluruskan (lebih baik daripada menghapus penjaga) |

**Hasil:** `npm run release:audit` **60/62 (EXIT 1) → 62/62 (EXIT 0)**.

---

## 3. Poin 1 & 2 — DITAHAN (blocked), bukan dilupakan

### Repo utama `C:\Users\USER\Documents\tamplate-portofolio` sedang KOTOR

Diverifikasi dengan `git status` saat sesi ini:

```
branch: main
 M CHANGELOG.md
 M docs/tracker/INDEX_TRACKER.md
 M src/app/admin/desktop/WindowContentRenderer.tsx
 M src/app/admin/desktop/registry.ts
 M src/app/api/admin/audit-logs/route.ts
 M src/app/api/billing/checkout/route.ts
 M src/app/api/billing/orders/[orderId]/route.ts
 M src/app/api/telegram/webhook/route.ts
 M src/lib/services/orderService.ts
 M src/middleware/csrf.ts
?? docs/tracker/logs/security_order_billing_hardening_2026_10_02.md
?? src/app/admin/desktop/panels/ActivityLogPanel.tsx
?? src/app/orders/layout.tsx
```

= **10 file ter-modifikasi + 3 file baru yang BELUM di-commit**, itu pekerjaan AI lain yang sedang berjalan (log `security_order_billing_hardening_2026_10_02.md` belum ter-tracker).

Konsekuensi:

- **Poin 2 (merge):** `CHANGELOG.md` dan `docs/tracker/INDEX_TRACKER.md` dimodifikasi **di kedua sisi** (pekerjaan AI lain belum di-commit + entri baru saya). Merge sekarang = bentrok di dua file paling sensitif, dan perubahan orang lain yang belum di-commit bisa tercampur/tertimpa. Cabang `fix/security-audit-2026-09-29` juga sudah tahu bentrok di `src/app/api/telegram/webhook/route.ts` dan `src/middleware/csrf.ts` — dua file yang **kebetulan juga sedang diedit** AI lain.
- **Poin 1 (deploy):** `npm run deploy` mem-build **working tree**, bukan commit. Deploy dari repo utama sekarang = ikut mengirim setengah jadi pekerjaan AI lain ke produksi.

**Urutan yang benar setelah AI lain selesai & commit:** merge `fix/security-audit-2026-09-29` → `npm run pre-deploy` → `npm run cf:deploy` → **baru** `npx tsx scripts/cloudflare/remove-plan-columns.ts` (dry-run) lalu `--apply`.

---

## 4. Gate (dijalankan sesi ini, semua hijau)

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** (exit 0) |
| `npx eslint src` | **0 issue** (exit 0) |
| `npx vitest run` | **114 file / 881 test PASS** (exit 0) |
| `npm run release:audit` | **62/62 PASS** (exit 0) — dari 60/62 |
| `npm run release:sale-readiness` | **13/13 PASS** (exit 0) — tidak terpengaruh perubahan `SALES_PRICING.md` |
| `node --check scripts/load/multi-buyer-load-test.js` | exit 0 |
| Dry-run load test (2 tenant) | exit 0, report tertulis |

`src/` aplikasi **tidak diubah sama sekali** pada poin 3 & 4 — semua di `docs/`, `scripts/`.

## 5. File yang dimodifikasi (17)

- **Dokumen (15):** `docs/release/{CLIENT_OPERATIONS,RELEASE_CHECKLIST,BUYER_ONBOARDING,SALES_PRICING,PRODUCTION_DEPLOY_RUNBOOK,RC1_RELEASE_NOTES}.md`, `docs/operations/{support-playbook,buyer-onboarding-checklist,backup-restore-runbook,monitoring-runbook}.md`, `docs/agent-context/{00_PRD_PRODUCT,02_BACKEND_D1_CONTEXT,04_ENDPOINT_CONTRACT,05_UI_TEMPLATE_CONTEXT}.md`, `docs/product-boundary/env-inventory.md`
- **Skrip (2):** `scripts/load/multi-buyer-load-test.js`, `scripts/release/audit-release-package.js`

Plus: `CHANGELOG.md` `[1.3.17]`, `docs/tracker/INDEX_TRACKER.md` entri 127, log ini.

## 6. Handoff / keputusan yang masih ditunggu owner

1. **Tabel `client_access` di database produksi.** Tabel ini (4 baris: email + password hash pembeli, **0 kode membacanya**) adalah sisa sistem login klien yang sama, tapi **belum** dimasukkan ke `remove-plan-columns.ts` karena menghapusnya = membuang daftar email pembeli secara permanen. Mau ikut di-`DROP` saat `--apply`, atau disimpan?
2. **Merge + deploy + `--apply`** menunggu AI lain selesai (lihat §3).
3. Uji beban `--run-live` butuh `LOAD_TEST_SITE_USER_EMAIL`/`_PASSWORD` + target; jalur isolation lintas-tenant butuh produk memutuskan dulu (apakah per-tenant auth mau dihidupkan lagi).
4. Backlog lama yang belum diputuskan: cron harian Wrangler, pemindahan rahasia ke Worker secrets.

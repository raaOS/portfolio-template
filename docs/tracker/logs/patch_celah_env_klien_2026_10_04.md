# Log: Celah Env D1/R2 Klien, Hapus Kode Mati, & Pembersihan Dokumen (v1.3.20)

**Tanggal:** 2026-10-04
**Pemicu:** Owner menyetujui 3 tugas setelah peta alur pembeli/owner/sistem: (1) selidiki celah env D1/R2 klien → perbaiki sekarang, (2) hapus kode mati "Master Dashboard", (3) perbaiki/hapus dokumen yang menyesatkan.

---

## BAGIAN 1 — Celah Env D1/R2 Per Klien (AUDIT)

### Temuan (semua dengan bukti file:line)

| # | Fakta | Bukti |
|---|---|---|
| 1 | Provisioning **benar**: D1 `db-<slug>` + R2 `media-<slug>` dibuat via REST API di accountId klien | `scripts/onboarding/server.ts:141-168`; config.env ditulis `:213-232` |
| 2 | Runtime D1 = **REST murni dari `process.env`**, tanpa binding | `src/crud/shared/db/connection.ts:29-93`; `src/lib/cloudflareD1.ts:62-93`; `wrangler.jsonc` tanpa `d1_databases` |
| 3 | Runtime R2 = binding `MEDIA_BUCKET` dulu → fallback env S3; URL publik selalu env | `src/lib/r2Storage.ts:101-212`, `r2StorageS3.ts:37-84` |
| 4 | **Build selalu memakai `.env.local` owner** dan nilai `process.env` non-`NEXT_PUBLIC` **ter-inline saat `next build`** | `server.ts:30,811-818` (sebelum perbaikan); bukti inline: `docs/tracker/logs/security_audit_flow_2026_09_29.md:117` |
| 5 | **Tidak ada satu pun mekanisme per-klien** yang menyetel `CLOUDFLARE_D1_DATABASE_ID`/`CLOUDFLARE_R2_BUCKET`/`CUSTOMER_SITE_ID` saat build/deploy (pencarian menyeluruh: server.ts, cloud-manager.ts, deploy/*.sh, API Pages env, wrangler config) | 0 penemuan; `CUSTOMER_SITE_ID` tidak pernah di-set → semua `default-site` (`src/crud/shared/config.ts:9`) |
| 6 | `wrangler pages deploy .open-next` **mengabaikan `wrangler.jsonc`** (config punya `main`, bukan `pages_build_output_dir`) | perilaku wrangler; `.open-next` berisi `worker.js`+`assets/` tanpa `_worker.js` |
| 7 | **Belum pernah ada klien nyata** (`arsip-klien/` tidak ada di disk) → **kerusakan belum terjadi** | glob 0 hasil |

**Kesimpulan audit:** kalau dipakai sekarang, data semua klien masuk ke D1 owner + media ke bucket owner (isolasi 100% yang dijanjikan tidak terpenuhi), `JWT_SECRET`/`PASSWORD_SALT` identik antar situs.

---

## BAGIAN 2 — PERBAIKAN (disetujui owner: "Perbaiki sekarang")

**Desain: Opsi B — build & deploy Worker per klien dengan injeksi env tiga lapis.**

| Lapis | Mekanisme |
|---|---|
| 1. Proses build | `buildClientEnvPlan()` — child process `next build` menerima override **13 kunci** dari `config.env`, **21 kunci owner di-reset `''`**, 8 kunci diwariskan (`INHERITED_OWNER_KEYS`, fail-closed) |
| 2. Artefak runtime | `.open-next/cloudflare/next-env.mjs` ditulis ulang (kunci owner dibuang) |
| 3. Config wrangler | `.open-next/wrangler.client.<slug>.jsonc` di-generate: `vars.CUSTOMER_SITE_ID`, KV namespace klien, **tanpa** binding milik owner & tanpa cron |

`JWT_SECRET` + `PASSWORD_SALT` **digenerate per klien** dan disimpan di `config.env` (token tidak bisa dipakai silang-situs). Mekanisme **tidak pernah menulis `.env.local`** (hanya override environment anak) — `.env.local` mtime tidak berubah saat build klien.

**File:**
- `scripts/onboarding/client-deploy.ts` — **BARU** (env plan, rewrite next-env.mjs, generate wrangler config, `deployClient()`)
- `scripts/onboarding/server.ts` — portal STEP 5 memanggil `deployClient()`
- `scripts/onboarding/cloud-manager.ts` — CLI onboard/update memakai `deployClient()`
- `scripts/onboarding/public/index.html` — preview URL `.pages.dev` → `.workers.dev`

**Deploy baru:** `npx wrangler deploy --config .open-next/wrangler.client.<slug>.jsonc` (Worker per klien, bukan Pages).

### Bukti verifikasi (angka)

| Check | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npx eslint src` | **0 error** |
| `npm test` | **115 file / 887 test PASS** |
| Build dummy klien (probe env, exit 0) | log `>>> [ENV] Klien: zz-env-probe — override 13 kunci, reset 21 kunci owner` |
| Scan artefak (verifier) | **`VERIFY LULUS (0 kegagalan)`**: 20 kunci nilai owner = **0 kemunculan** di `next-env.mjs` + config wrangler + **1.645 file `.next/server`** + seluruh `.open-next`; marker klien (`CUSTOMER_SITE_ID`, bucket, dummy account/D1 id, `JWT_SECRET` 64 char, `PASSWORD_SALT` 32 char) **ada** |
| Selama build | **5 panggilan D1 di-stub ke URL ber-ID dummy**, 0 panggilan API Cloudflare keluar (tidak ada akun nyata dipakai) |
| `wrangler deploy --dry-run` | exit 0 (`--dry-run: exiting now.`) |
| `npm run release:audit` | **59/59** (baseline 62/62 — 3 check hilang karena file wajib `BUYER_ONBOARDING.md` + 2 flag env dihapus dari skrip audit, disengaja) |
| `npm run release:sale-readiness` | **12/12** (baseline 13/13 — 1 check file terhapus, disengaja) |

---

## BAGIAN 3 — HAPUS KODE MATI "MASTER DASHBOARD"

**File dihapus (7):** `src/app/admin/client-dashboard/` (page.tsx + `ClientDashboardPanel.tsx` + 3 komponen Master*), `src/app/admin/desktop/panels/OrdersPanel.tsx`, `PaymentConfigPanel.tsx`.

**File diubah (8):** `WindowContentRenderer.tsx` (hapus 3 dynamic import + 3 key PANEL_MAP), `adminQueries.ts` (hapus `ADMIN_PREFETCH_HREFS`/`prefetchAdminRoute`/`fetchAdminSites`/tipe terkait), `api/public/sites/[siteSlug]/config/route.ts` (hapus 2 flag), `ActivityLogPanel.tsx` (komentar), `.env.example`, `.dev.vars.example`, `scripts/release/audit-release-package.js`, `.env.local` (2 baris, lokal).

**Bukti:** grep `clientDashboard|MasterSiteTable|OrdersPanel|PaymentConfigPanel|FEATURE_MASTER_DASHBOARD|FEATURE_CLIENT_DASHBOARD` = **0 match** di `src/`, `scripts/`, `.env.example`, `.dev.vars.example`.

**Dipertahankan (keputusan owner — endpoint tetap hidup):** `api/admin/sites/**`, `api/admin/orders/**`, `api/admin/payment-config/**`, `paymentConfigService` (dipakai billing).

---

## BAGIAN 4 — DOKUMEN DIHAPUS (isinya ≥90% salah)

- `docs/operations/buyer-onboarding-checklist.md` (93 baris — onboarding berbasis Master Dashboard + `/setup`)
- `docs/release/BUYER_ONBOARDING.md` (250 baris — "Do not create one deployment per buyer", setup satu akun Cloudflare produk)

Rujukan ke keduanya dibersihkan dari `scripts/release/audit-release-package.js`, `audit-sale-readiness.js`, dan `README.md` (0 sisa).

---

## BAGIAN 5 — DOKUMEN DIPERBAIKI (≈25 file)

- `README.md`, `AGENTS.md` (diagram, konsep kunci, §10 flags, D1 Schema 10/12 tabel diverifikasi dari `schema.ts`/`d1-schema.ts`, Setup Flow, Deploy Pipeline, Admin UI Zones)
- `docs/agent-context/` (00_PRD ditulis ulang; 01,02,03,04,06,07), `docs/product-boundary/env-inventory.md`, `docs/architecture/multi_template_contract.md`
- `docs/operations/` (support-playbook 17 titik "Master Dashboard"→0, BENGKEL_HANDOFF, monitoring-runbook `client.login`→`admin.login`, backup-restore-runbook daftar 18 tabel hidup + catatan `client_access` sudah DROP, support-response-templates)
- `docs/release/` (RELEASE_CHECKLIST, PRODUCTION_DEPLOY_RUNBOOK, CLIENT_OPERATIONS, RC1_RELEASE_NOTES diberi notice arsip)
- `panduan/` (README, PANDUAN_UNTUK_KLIEN hapus alur `/setup`, PANDUAN_UNTUK_KAMU_OWNER template WA disamakan dengan template resmi portal `server.ts:256-269`)
- URL `.pages.dev` → `.workers.dev` di 6 titik dokumen aktif (juga `AGENTS.md`, `BENGKEL_HANDOFF.md`)

**Zona aman tidak disentuh:** `docs/tracker/**`, `CHANGELOG.md` (riwayat), worktree `neon-planet`, `gemini-2.5-flash-lite`, `StorageMovePlan`, React `subscription`, 8 protected core AGENTS.md §3.

---

## BAGIAN 6 — GAP YANG DIKENAL (BELUM DIPERBAIKI)

1. **⚠️ Custom domain klien belum migrasi ke jalur Worker.** Fitur masih memakai **API Pages** (`POST /accounts/{id}/pages/projects/{slug}/domains` — `server.ts:509-516`) dan CNAME target `${slug}.pages.dev` (`server.ts:555`, `cloud-manager.ts:614`, `index.html:1433`) — tidak berlaku setelah deploy berubah jadi Worker. Butuh perpindahan ke Workers Domains API + pengujian akun CF nyata. **Belum dikerjakan.**
2. **Literal owner di `src/`**: 5 file memuat URL `makeitbetter.my.id` hardcode (`lib/constants.ts`, `orderService.ts`, webhook telegram, dll) + `next.config.mjs:5` — ikut ter-compile ke build klien apa pun env-nya.
3. **E2E ke Cloudflare sungguhan belum jalan** — build probe memakai stub D1 lokal, deploy baru `--dry-run`. Butuh: akun CF klien (Account ID + token izin D1/R2/Workers/KV) + D1 ber-seed.
4. **`wrangler.jsonc` klien menyimpan rahasia plaintext di `vars`** — pertimbangkan `wrangler secret` menyusul.
5. **`scripts/cloudflare/backup-common.ts` `DEFAULT_D1_BACKUP_TABLES` masih memuat `client_access` (sudah DROP) dan belum memuat `site_users`/`orders`** — wajib divalidasi sebelum fitur Backup dikerjakan (diperingatkan juga di `backup-restore-runbook.md`).
6. **Cron harian fire belum terbukti** — lihat log `cron_worker_secrets_2026_10_03.md` (handler `Handlers: fetch, scheduled` ✅, trigger 40 menit nol invocation ❌).

---

## Perubahan File (ringkas)

**Kode:** `scripts/onboarding/client-deploy.ts` (baru), `server.ts`, `cloud-manager.ts`, `public/index.html`, 7 file `src/app/admin/**` dihapus, 4 file `src/app/admin/**` diubah, `src/app/api/public/sites/[siteSlug]/config/route.ts`, `.env.example`, `.dev.vars.example`, `.env.local`, `scripts/release/audit-release-package.js`, `audit-sale-readiness.js`.
**Dokumen:** 2 dihapus, ±25 diperbaiki (daftar di Bagian 5).
**Gerbang akhir:** tsc 0 · eslint 0 · 115/887 test PASS · release:audit 59/59 · sale-readiness 12/12.

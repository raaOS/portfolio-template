# Log Pekerjaan: Hapus Konsep Paket Lite/Pro + Langganan Tanpa Jejak (v1.3.15)

- **Tanggal:** 2026-10-03
- **Tipe:** Penghapusan konsep produk (cleanup) — permintaan owner
- **Versi:** v1.3.15
- **Status:** 🟢 Selesai (tsc 0, eslint 0, `114 file / 879 test PASS`)
- **Cabang:** `fix/security-audit-2026-09-29`
- **Instruksi owner:** *"jadi gini hanya paket lite dan pro itu tidak ada, pembeli masih bisa pesan lewat website"* + *"hilangkan bersih tanpa jejak di github, file, dan code"*

---

## 1. Batas lingkup (keputusan yang dipegang)

| Dihapus | **Tetap dipertahankan** |
|---|---|
| Istilah paket `lite` / `pro` | Alur jual-beli: `/checkout` → order → bayar → upload bukti → verifikasi → aktivasi |
| Konsep langganan / billing bulanan (`site_subscriptions`, `billingStatus`, `currentPeriodEnd`) | Harga `Rp199.000` (`BASE_PRICE`) |
| Dropdown Plan + badge Plan di admin | Quota per site + add-on quota (`site_quota_overrides`) |
| Kolom `sites.plan` & `orders.plan` | Feature flag `FEATURE_*` |
| Env `PLAN_LITE_*` / `PLAN_PRO_*` | Semua API billing & halaman pesanan |

**Catatan penting:** riwayat git **tidak di-rewrite / tidak di-force-push** (owner sudah memilih "bersih di kode & commit saja"), dan **catatan historis di `docs/tracker/logs/` + entri lama `INDEX_TRACKER` sengaja dibiarkan** — itu arsip, bukan kode.

---

## 2. Temuan awal (audit jejak, 5 lapisan)

Jejak ditemukan di: **(1)** modul inti, **(2)** database/schema, **(3)** API, **(4)** tampilan, **(5)** skrip + test + dokumen + env.

Fakta yang dipakai untuk memastikan penghapusan **tidak mengubah perilaku**:

- `getBasePlanAmount('lite') === getBasePlanAmount('pro') === 199000` → **kedua paket harganya sama**, jadi menghapus pilihan paket tidak mengubah nominal tagihan.
- `FEATURE_AI / NOTIFICATIONS / CUSTOM_DOMAIN / ANALYTICS` di produksi = `"false"` → melepas syarat `site.plan === 'pro'` **tidak mengaktifkan fitur apa pun**.
- `FEATURE_CLIENT_DASHBOARD` & `FEATURE_MASTER_DASHBOARD` = `"true"` → dropdown Plan **sempat terjangkau di produksi**, jadi penghapusannya berdampak nyata (memang dimaksud).
- `sites.plan NOT NULL DEFAULT 'lite'` dan `orders.plan NOT NULL DEFAULT 'pro'` → menghapus kolom dari statement `INSERT` **aman** (default kolom yang berlaku).

---

## 3. Perubahan per lapisan

### 3.1 Modul inti (6 file)

| File | Perubahan |
|---|---|
| `src/lib/product/sitePlan.ts` | **DIHAPUS** |
| `src/lib/product/siteQuota.ts` | Menerima seluruh isi `sitePlan.ts`: `PlanQuota` → `SiteQuota`, `getEffectiveSiteQuota(override)` tanpa parameter plan, `upsertSiteQuotaOverride({siteId, override})`, plus `countProjectMediaRefs`, `getDefaultQuota`, `normalizeSiteQuotaOverride`, `hasSiteQuotaOverride` |
| `src/constants/plans.ts` | **Diganti nama** → `src/constants/pricing.ts`; `PLAN_BASE_PRICES` + `PlanKey` dihapus, tersisa `BASE_PRICE` + `formatIdr` (3 import di-update) |
| `src/lib/product/siteStorageUsage.ts` | `PlanQuota` → `SiteQuota` |
| `src/lib/admin/projectSiteContext.ts` | Import digabung ke `siteQuota`; `plan` dibuang dari `SiteRow`, `AdminSiteContext`, SQL, dan 3 blok pesan error |
| `src/lib/adapters/siteDataAdapter.ts` | `plan?: string` dihapus dari `SiteInfo` |

### 3.2 API (7 file)

| File | Perubahan |
|---|---|
| `api/admin/sites/route.ts` | SELECT/GROUP BY tanpa `s.plan` · query `site_subscriptions` + `mapSubscriptionRows` dihapus · fungsi `upsertSiteSubscription` **dihapus** · `quotaChangeViolationResponse` tanpa parameter plan · INSERT `sites` tanpa kolom `plan` · blok UPDATE `plan`/`billingStatus`/`currentPeriodEnd` dihapus · helper `placeholders()` dihapus (tak terpakai) · `DELETE` tidak lagi menyentuh `site_subscriptions` · `errorCode` `PLAN_QUOTA_VIOLATION` → **`QUOTA_VIOLATION`** |
| `api/billing/checkout/route.ts` | `plan` dibuang dari destructuring body & payload `createOrder` |
| `api/billing/orders/[orderId]/route.ts` | `plan` dibuang dari SELECT |
| `api/public/sites/[siteSlug]/config/route.ts` | key `plan` dihapus + 4 syarat `&& site.plan === 'pro'` dilepas (sudah diverifikasi: tidak ada konsumen key `plan` di `src`) |
| `api/admin/sites/[siteId]/{project-cover,project-media,project-video/presign}` | fixture `plan: 'lite'/'pro'` dihapus |

### 3.3 Layanan pesanan (`src/lib/services/orderService.ts` — 41 jejak → 0)

- `OrderRecord.plan` & `CreateOrderInput.plan` dihapus; `getBasePlanAmount()` dihapus → `BASE_PRICE`.
- SELECT/RETURNING `plan` dihapus (sweep kadaluarsa + `expireOrderIfStale`).
- `INSERT INTO orders` tanpa kolom `plan` (nilai param ikut berkurang, placeholder disesuaikan).
- **4 email** (struk, kadaluarsa, serah-terima, …) tanpa baris `Paket:`/`Plan`; subjek jadi `Struk Pesanan <id> — Portfolio OS`, `🎉 Website Anda Sudah Aktif — Portfolio OS`.
- **2 pesan Telegram** (order baru + verifikasi bukti bayar) tanpa baris `Paket:`.
- `activateOrder`: INSERT `sites` tanpa `plan`, **INSERT `site_subscriptions` dihapus**, union `CreatedRow` tinggal `{kind:'site'}`, blok rollback `DELETE FROM site_subscriptions` dihapus.
- Pesan error duplikat slug: "…bila ingin mengganti **paket**" → "…bila ingin mengganti **slug**".

### 3.4 Tampilan (7 file)

| File | Perubahan |
|---|---|
| `app/orders/[orderId]/page.tsx` | interface tanpa `plan` · baris **"Paket Terpilih"** dihapus (baris terakhir otomatis tanpa garis bawah) · teks WA & ringkasan tagihan tanpa nama paket |
| `admin/desktop/panels/OrdersPanel.tsx` | header **"Paket & Slug" → "Slug"**, badge paket dihapus |
| `admin/lib/adminQueries.ts` | import → `siteQuota`; `plan`, `quotaDefault`, `billing` dihapus dari `AdminSiteSummary` |
| `admin/client-dashboard/ClientDashboardPanel.tsx` | `SiteMasterDraft` tanpa `plan`/`billingStatus`/`currentPeriodEnd` · 6 pesan error/pesan header disesuaikan ("upgrade plan" → "naikkan quota add-on") |
| `.../components/MasterSiteEditorSidebar.tsx` | **Dropdown Plan dihapus**; grid jadi 1 kolom (tinggal Status); placeholder "…bawaan plan" → "…bawaan sistem" |
| `.../components/MasterSiteTable.tsx` | Badge `{site.plan}` → **`{site.status}`** |
| `src/app/[siteSlug]/page.tsx` | import + `canUseWhatsappTestimonials` + 2 ternary mati dihapus |

### 3.5 Skema database (3 file)

- `src/lib/d1-schema.ts`: kolom `plan` di `sites` & `orders` dihapus; **tabel `site_subscriptions` + index-nya dihapus** (renumber komentar).
- `src/crud/shared/db/schema.ts`: kolom `plan` di `sites` dihapus.
- `src/crud/shared/db/connection.ts`: `getSiteById` tanpa `plan` (tipe + SELECT).

### 3.6 Skrip (12 file)

`product-bootstrap.ts` · `seed-restore-drill-project.ts` (INSERT sites tanpa `plan`, INSERT `site_subscriptions` dihapus, baris log dry-run disesuaikan) · `backup-common.ts` (2 daftar tabel) · `audit-restore-integrity.ts` · `audit-site-project-media.ts` (tipe + 2 SELECT) · `onboarding/cloud-manager.ts` · `onboarding/server.ts` · `production-readiness.ts` (`checkPlanQuotas`, `readPositiveInteger`, `PLAN_INTEGER_KEYS`, dan pemanggilannya dihapus) · `monitoring/synthetic-production-check.js` (`planStorageMb` → `defaultStorageMb` baca env `STORAGE_MB`) · `release/audit-release-package.js` (6 kunci env + dokumen wajib) · `release/audit-sale-readiness.js` (dokumen wajib + frasa yang dicek) · `load/multi-buyer-load-test.js` + `load-test-config.example.json` (flag `--plan`, validasi, help, body).

### 3.7 Env (2 file)

`.env.example` & `.dev.vars.example`: `PLAN_LITE_*` / `PLAN_PRO_*` → **`PROJECT_LIMIT=50`, `STORAGE_MB=5000`, `MEDIA_PER_PROJECT=50`** (persis nilai bawaan di `siteQuota.ts`); `AI_MONTHLY_TOKEN_LIMIT_LITE|PRO` dihapus (tidak pernah dibaca kode).

### 3.8 Test (6 file, 879 test tetap PASS)

- `orderService.test.ts`: 16 baris `plan:` dihapus dari input & fixture; 4 mock `insert site_subscriptions` + 1 assert `DELETE FROM site_subscriptions` dihapus (urutan mock disesuaikan karena query-nya memang berkurang 1).
- `admin/sites/route.test.ts`: `quotaDefault` dihapus dari ekspektasi, nama test diubah, param INSERT tanpa `'lite'`, assert `QUOTA_VIOLATION`, dan **`vi.mock('@/lib/product/siteQuota')` diubah jadi `importOriginal` + spread** (sebelumnya pabrik mock hanya punya 2 ekspor — sejak `sitePlan.ts` digabung ke `siteQuota.ts`, modul hasil mock menutupi `getEffectiveSiteQuota`/`normalizeSiteQuotaOverride` dan bikin 6 test gagal).
- 3 test `[siteId]/*` + `projects/route.test.ts`: fixture & nama test disesuaikan.

### 3.9 Dokumen (20 file, 1 dihapus)

- **Dihapus:** `docs/release/LITE_PRO_SCOPE.md` (dihapus dari daftar wajib `audit-release-package.js` & link `README.md`).
- **Ditulis ulang:** `docs/release/SALES_PRICING.md` — dari "managed subscription + Paket Lite/Pro" jadi **satu produk, satu kali beli, tanpa langganan**, dengan add-on quota sebagai satu-satunya jalur upgrade.
- **Disesuaikan:** `README.md`, `docs/product-boundary/env-inventory.md`, `docs/agent-context/{00,01,02,03,04,05,07,09}`, `docs/architecture/multi_template_contract.md`, `docs/release/{BUYER_ONBOARDING,CLIENT_OPERATIONS,RC1_RELEASE_NOTES,RELEASE_CHECKLIST,PRODUCTION_DEPLOY_RUNBOOK}.md`, `docs/operations/{backup-restore-runbook,buyer-onboarding-checklist,support-playbook,support-response-templates}.md`.
- **Tidak disentuh (sadar):** `docs/tracker/logs/*`, entri lama `INDEX_TRACKER`, dan entri CHANGELOG lama → arsip historis.

---

## 4. Pembersihan database: SUDAH DISIAPKAN, BELUM DIJALANKAN

Sesuai keputusan owner **"kode dulu, database belakangan"**, dibuat:

```
scripts/cloudflare/remove-plan-columns.ts
  npx tsx scripts/cloudflare/remove-plan-columns.ts          # dry-run (aman, hanya melapor)
  npx tsx scripts/cloudflare/remove-plan-columns.ts --apply  # eksekusi
```

Isi rencana: `ALTER TABLE sites DROP COLUMN plan` · `ALTER TABLE orders DROP COLUMN plan` · `DROP TABLE site_subscriptions` · `DROP INDEX idx_site_subscriptions_site`. Skrip mengecek dulu apakah kolom/tabel masih ada, jadi aman dijalankan dua kali.

**Urutan wajib:** deploy kode v1.3.15 **dulu**, baru jalankan `--apply`. Kalau kebalik, kode lama akan `SELECT plan` ke kolom yang sudah hilang.

---

## 5. Verifikasi

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npx eslint src` | **0 error** |
| `npx vitest run` | **114 file / 879 test PASS** |
| grep jejak (`'lite'`, `'pro'`, `PLAN_`, `site_subscriptions`, `ProductPlan`, `PlanQuota`, `quotaDefault`, `billingStatus`, `currentPeriodEnd`, `constants/plans`, `paket`, `langganan`) di `src/ scripts/ tests/` | **0** |
| grep jejak yang sama di `docs/` + `README` + `.env*` (tanpa arsip tracker) | **0** |
| `node scripts/release/audit-sale-readiness.js` | 4 gagal **pre-existing** (lihat §6), sisanya pass |

---

## 6. Handoff / Catatan

1. **Owner wajib tahu:** database produksi **belum disentuh**. Jalankan skrip pembersih hanya setelah versi ini ter-deploy.
2. **`release:sale-readiness` sudah rusak sebelum pekerjaan ini** (4 gagal): path `src/app/api/client/password-reset/*`, `src/app/client/reset-password`, `src/lib/clientPasswordReset.ts` tidak ada lagi sejak fitur reset-password lama dihapus, tapi daftar cek auditnya tidak pernah dibersihkan. **Di luar lingkup** pekerjaan hapus-paket — butuh keputusan owner: hapus cek mati itu, atau hidupkan lagi fiturnya.
3. **Item yang masih menunggu:** cron harian Wrangler, pemindahan rahasia ke Worker secrets, merge `fix/security-audit-2026-09-29` ke `main` (2 file bentrok — masih "jangan di-merge dulu"), lalu `npm run pre-deploy` + `npm run cf:deploy`.
4. **Rencana berikutnya yang sudah di-izin owner:** "sambungkan kasir ke bengkel" (pembeli bayar → owner buat Gmail + akun CF via `PENGELOLA_KLIEN.bat` → deploy) sebagai commit **v1.3.16** — belum dieksekusi.

---

_Terakhir Diperbarui: 2026-10-03_

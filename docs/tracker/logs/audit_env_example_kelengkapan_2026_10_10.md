# Log: Audit Kelengkapan `.env.example` — 7 Kunci Tak Terdokumentasi + 1 Revert Ceroboh

**Tanggal:** 2026-10-10
**Status:** ✅ Selesai (dokumentasi murni; tidak ada perubahan kode/logika)
**Pemicu:** Owner bertanya _"beri info kenapa gak bisa `npm run deploy`"_ → dijawab bahwa `.env.local` tidak ada di worktree → owner minta _"Memastikan `.env.example` lengkap"_.

---

## Konteks & Metode

Worktree `misty-wolf` (salinan temporer; folder induk `Documents\portfolio-template` tidak ada di sesi ini, `node_modules` belum terpasang). `npm run deploy` berhenti di `scripts/deploy/pre-deploy-check.js` (exit 1) karena `.env.local` absen — **ini memang benar** (kredensial produksi sengaja tidak ikut worktree).

Audit kelengkapan: memindai **281 kecocokan** pola `process.env.NAMA_KUNCI` di seluruh `*.{ts,tsx,js,mjs}`, dibandingkan dengan isi `.env.example` (56 kunci). Kunci disertakan hanya bila dipakai **kode produksi** dan memang diisi manual oleh owner. Sengaja **diluar** kunci test/smoke/load-test (`ADMIN_PASSWORD` E2E, `PRODUCTION_SMOKE_URL`, `LOAD_TEST_ORDER_*`) dan yang disuntik platform (`CF_PAGES`, `GITHUB_STEP_SUMMARY`) — `.env.example` = kontrak env produk, bukan env test.

## Temuan: 7 Kunci Dipakai Kode, Tak Terdokumentasi

| Kunci | Fungsi | Bukti di kode |
|---|---|---|
| `AI_BASE_URL` | Override base URL provider AI | `src/lib/services/aiGatewayService.ts:101`, `src/app/api/admin/ai/settings/route.ts:56` |
| `AI_MODEL` | Override model provider AI | `aiGatewayService.ts:102`, `admin/ai/settings/route.ts:57` |
| `CLOUDFLARE_ZONE_ID` | Wajib `FEATURE_CUSTOM_DOMAIN` + purge CDN | `src/lib/services/customDomainService.ts:46-50` (menandainya wajib), `src/lib/cache/clearApplicationCache.ts:40` |
| `CLOUDFLARE_CACHE_ZONE_ID` | Alias lama zona | `clearApplicationCache.ts:40` |
| `CLOUDFLARE_CACHE_PURGE_TOKEN` | Token purge CDN | `clearApplicationCache.ts:41` |
| `CLOUDFLARE_D1_ACCOUNT_ID` | Fallback akun D1 (akun terpisah) | `src/lib/cloudflareD1.ts:65`, `src/crud/shared/db/connection.ts:58` |
| `CLOUDFLARE_API_TOKEN` | Fallback token purge cache | `clearApplicationCache.ts:41` |
| `NEXT_PUBLIC_ADMIN_WA` | Nomor WA tombol struk order storefront | `src/app/orders/[orderId]/page.tsx:328` (fallback hardcoded `628123456789`) |

Semua ditambahkan ke `.env.example` sebagai dokumentasi + komentar penunjuk file pemakai.

## 🐛 Cerobohan Proses (bukan bug kode) — Revert `CUSTOMER_SITE_ID`

**Apa yang terjadi:** Pada pass pertama saya juga menambahkan `CUSTOMER_SITE_ID=""` dan menyebutnya **"gap paling kritis"** dengan klaim _"semua site otomatis jatuh ke `default-site`, persis bug yang dikhawatirkan §12"_. **Klaim itu KELIRU.** Owner menagih: _"ini udah fix? memangnya kamu udah tau flow bisnis project ini"_.

**Bukti yang mengoreksi (dicek ulang setelah ditegur):**

1. `scripts/onboarding/client-deploy.ts:177` → `CUSTOMER_SITE_ID: config.CUSTOMER_SITE_ID || slug` — **pipeline onboarding mengisi otomatis per-slug klien**. Client deployment tidak pernah membaca `.env.example` (env klien dibangun dari `arsip-klien/<slug>/config.env`). Jadi skenario "semua klien satu site id" **tidak akan terjadi**.
2. Untuk **site owner**, `CUSTOMER_SITE_ID` kosong → `'default-site'` (`src/crud/shared/config.ts:9`) — dan itu **BENAR**: seluruh data owner memang tersimpan di `default-site` (`product-bootstrap.ts:125`, `sync-exact-macos-projects.ts:136`, key content `content_default-site`). Bukan bug.
3. Komentar yang saya tulis — _"Kosongkan hanya bila memang mau memakai 'default-site' (development/seed)"_ — **membalik kenyataan** dan **berisiko merusak**: mengisyaratkan "mengisi = normal untuk produksi", padahal untuk site owner justru **wajib kosong**. Jika diisi nilai lain, semua data lama (projects, wallpapers, content) yang di-scope ke `default-site` tidak terbaca = "data hilang".

**Akar kesalahan:** menarik kesimpulan severity dari pemetaan teoretis (kunci tak ada di template) **tanpa menelusuri dulu siapa yang mengisi kunci itu dan kapan**. "Terdokumentasi ≠ kritis".

**Keputusan (disetujui owner):** `CUSTOMER_SITE_ID` **direvert total** dari `.env.example`, karena (a) dokumentasi yang benar sudah ada di `AGENTS.md` §12, (b) kunci ini memang **tidak boleh diisi owner** di `.env.local` — untuk site klien pipeline yang mengisi. Menempatkannya di template mengundang owner mengisi → memicu bug "data hilang" di atas.

## File yang Dimodifikasi

- `.env.example` — +7 kunci terdokumentasi (`AI_BASE_URL`, `AI_MODEL`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CACHE_ZONE_ID`, `CLOUDFLARE_CACHE_PURGE_TOKEN`, `CLOUDFLARE_D1_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `NEXT_PUBLIC_ADMIN_WA`); `CUSTOMER_SITE_ID` sempat ditambah lalu **direvert**.
- `docs/tracker/logs/audit_env_example_kelengkapan_2026_10_10.md` — log ini (baru).
- `docs/tracker/INDEX_TRACKER.md` — entri 149.

## Verifikasi

- `node scripts/deploy/pre-deploy-check.js` dijalankan sebelum & sesudah perubahan → perilaku **identik** (tetap exit 1 hanya karena `.env.local` absen; tidak ada error baru). Konsisten dengan sifat perubahan = dokumentasi murni.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)

- **`CUSTOMER_SITE_ID` tidak boleh muncul kembali di `.env.example`.** Jika ada audit kelengkapan env lain yang menandainya "hilang", jangan tambahkan — kuncinya sudah benar di `AGENTS.md` §12, dan mengisi untuk site owner = bug "data hilang". Ini sudah diverifikasi dari `client-deploy.ts:177` + `config.ts:9`.
- Gap dokumentasi lain yang disebut tapi **belum** ditindaklanjuti (owner belum minta): var `LOAD_TEST_ORDER_*`/`LOAD_TEST_SITE_USER_*` (`multi-buyer-load-test.js:78-89`), `PRODUCTION_SMOKE_URL`/`PRODUCTION_SMOKE_SITE_SLUG` (`smoke-production.js:7-8`) — opsional, khusus tooling test, bukan kontrak produk.
- `docs/product-boundary/env-inventory.md` (Sprint 1 baseline) juga belum memuat 7 kunci baru di atas; bisa diselaraskan bila owner mau dokumentasi env satu sumber.

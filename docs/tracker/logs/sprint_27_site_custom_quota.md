# Tracker Log: Sprint 27 - Site Custom Quota Add-ons

**Status:** Completed
**Mulai:** 2026-07-02
**Selesai:** 2026-07-02

## Tujuan (Objective)
- Menambahkan quota custom per client/site sebagai add-on monetisasi di atas default Lite/Pro.
- Memastikan backend, client dashboard, public config, dan Master Dashboard memakai effective quota yang sama.
- Mencegah quota diturunkan atau di-reset di bawah usage existing client.

## Task List
- [x] Tambah schema D1 `site_quota_overrides`.
- [x] Tambah helper quota default, override, sanitasi, dan effective quota.
- [x] Wire custom quota ke Admin Sites API create/update/read.
- [x] Wire effective quota ke project/upload guard, client check-auth, dan public site config.
- [x] Tambah UI Master Dashboard untuk custom quota add-on.
- [x] Tambah test Admin Sites untuk custom quota dan guard penurunan quota.
- [x] Update docs product scope, backend context, endpoint contract, dan tracker index.

## File yang Dimodifikasi (Modified Files)
- `src/lib/product/sitePlan.ts` -> Menambahkan tipe dan helper `SiteQuotaOverride`, sanitasi override, dan `getEffectiveSiteQuota()`.
- `src/lib/product/siteQuota.ts` -> Service D1 untuk load/upsert custom quota per site dengan fallback aman jika table belum dibuat.
- `src/lib/d1-schema.ts` -> Menambahkan table dan index `site_quota_overrides`.
- `src/lib/admin/projectSiteContext.ts` -> Project/create update quota guard memakai effective quota per site.
- `src/app/api/admin/sites/route.ts` -> Admin Sites API membaca, membuat, mengupdate, memvalidasi, dan menghapus custom quota per site.
- `src/app/api/client/check-auth/route.ts` -> Client dashboard menerima effective quota per site.
- `src/app/api/public/sites/[siteSlug]/config/route.ts` -> Public site config memakai effective quota.
- `src/app/admin/lib/adminQueries.ts` -> Menambahkan response type `quotaDefault` dan `quotaOverride`.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Menambahkan form custom quota add-on dan snapshot custom/default.
- `src/app/api/admin/sites/route.test.ts` -> Menambahkan test custom quota read/create dan guard lowering.
- `docs/release/LITE_PRO_SCOPE.md` -> Menjelaskan custom quota sebagai add-on per site.
- `docs/agent-context/02_BACKEND_D1_CONTEXT.md` -> Menambahkan table dan aturan effective quota.
- `docs/agent-context/04_ENDPOINT_CONTRACT.md` -> Menjelaskan payload `quotaOverride`.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 27.
- `docs/tracker/logs/sprint_27_site_custom_quota.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Quota sebelumnya hanya global per plan dari env, sehingga tidak bisa upsell quota per client.
  - **Penyebab:** Backend memakai `getPlanQuota(plan)` langsung di API, upload guard, dan client check-auth.
  - **Perbaikan:** Menambahkan `site_quota_overrides` dan effective quota per site.
- **Bug 2:** Downgrade/custom quota reduction berpotensi membiarkan project lama melanggar media-per-project limit.
  - **Penyebab:** Guard lama hanya mengecek project count dan storage.
  - **Perbaikan:** Admin Sites API sekarang menghitung max media usage per existing project sebelum menerima perubahan quota yang menurunkan limit efektif.

## Verifikasi
- `npx vitest run src/app/api/admin/sites/route.test.ts` -> pass, 13 tests.
- `npx eslint src/lib/product/sitePlan.ts src/lib/product/siteQuota.ts src/lib/admin/projectSiteContext.ts src/app/api/admin/sites/route.ts src/app/api/client/check-auth/route.ts src/app/api/public/sites/[siteSlug]/config/route.ts src/app/admin/lib/adminQueries.ts src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run release:audit` -> pass, 59/59 checks.
- `npm run cf:readiness` -> pass, 22/22 checks.
- `npm run cf:bootstrap` -> pass, D1 product schema ready.
- `npm run cf:build` -> pass setelah dev server port 3000 dihentikan sementara.
- `http://localhost:3000/api/health` -> 200 setelah dev server dinyalakan ulang.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Custom quota adalah add-on di atas default plan, bukan cara menurunkan Lite/Pro di bawah default env.
- `cf:bootstrap` sudah dijalankan pada 2026-07-02 untuk env saat ini. Jika memakai D1 lain/staging baru, jalankan lagi sebagai migrasi terkontrol.
- Runtime read fallback ke default jika table belum ada, dan write path punya self-healing create table.

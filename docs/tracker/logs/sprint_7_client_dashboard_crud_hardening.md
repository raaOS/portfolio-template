# Tracker Log: Sprint 7 - Client Dashboard CRUD Hardening

**Status:** Completed
**Mulai:** 2026-06-28
**Selesai:** 2026-06-28

## Tujuan (Objective)
- Membuat CRUD project admin/client benar-benar memakai D1 SQL multi-site, bukan service legacy portofolio tunggal.
- Menambahkan guard quota Lite/Pro untuk jumlah project dan jumlah media per project.
- Membersihkan hook notifikasi personal Telegram dari jalur CRUD project template.
- Memastikan perubahan aman untuk build Cloudflare Workers.

## Task List
- [x] Alihkan create, read by id, update, delete, dan bulk action project ke `projectSqlService`.
- [x] Tambahkan resolver site context admin dengan fallback `default-site`, header `x-site-id`, query `siteId`, atau body `siteId`.
- [x] Tambahkan helper quota plan Lite/Pro dan validasi media count per project.
- [x] Tambahkan create/update/delete/bulk SQL behavior di `projectSqlService`.
- [x] Update unit test API project agar menguji SQL path dan quota error.
- [x] Jalankan targeted tests, typecheck, lint terarah, dan Cloudflare build.

## File yang Dimodifikasi (Modified Files)
- `src/lib/product/sitePlan.ts` -> Helper normalisasi plan Lite/Pro, quota default/env, dan hitung referensi media project.
- `src/lib/admin/projectSiteContext.ts` -> Resolver site admin, query context site D1, dan error quota project/media.
- `src/lib/services/project/projectSqlService.ts` -> Menambah SQL create/update/delete/bulk, unique slug per site, metadata sync, narrative/media sync, dan delete media R2 best-effort.
- `src/app/api/projects/route.ts` -> GET/POST project memakai SQL site-aware, quota guard, dan tidak lagi mengirim alert Telegram personal.
- `src/app/api/projects/[id]/route.ts` -> GET/PUT/DELETE by id memakai SQL site-aware, quota guard update, dan tidak lagi memakai legacy project service/Telegram.
- `src/app/api/projects/bulk/route.ts` -> Bulk delete/publish/draft/reorder memakai SQL site-aware.
- `src/app/api/public/sites/[siteSlug]/config/route.ts` -> Quota public config memakai helper plan yang sama.
- `src/app/api/projects/route.test.ts` -> Test SQL create/list dan quota create.
- `src/app/api/projects/[id]/route.test.ts` -> Test SQL get/update/delete dan menghapus ekspektasi Telegram.
- `src/app/api/projects/bulk/route.test.ts` -> Test bulk SQL site-aware.
- `src/app/api/health/route.test.ts` -> Perbaikan typing env cleanup agar typecheck strict hijau.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 7.
- `docs/tracker/logs/sprint_7_client_dashboard_crud_hardening.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Project SQL demo bisa tampil, tetapi update/delete masih berisiko gagal karena route admin memakai `projectService` legacy.
  - **Penyebab:** Sprint sebelumnya baru mengalihkan sebagian read path ke SQL; mutation path masih portofolio tunggal.
  - **Perbaikan:** Semua route `/api/projects`, `/api/projects/[id]`, dan `/api/projects/bulk` memakai `projectSqlService` dengan `siteId`.

- **Bug 2:** Lite/Pro belum punya enforcement quota saat client/admin membuat atau mengubah project.
  - **Penyebab:** Config public sudah mengekspos plan, tetapi backend mutation belum mengecek batas plan.
  - **Perbaikan:** `projectSiteContext` mengecek site aktif, project limit, dan media-per-project limit sebelum create/update.

- **Bug 3:** Jalur CRUD project template masih membawa notifikasi personal Telegram.
  - **Penyebab:** Legacy portofolio pribadi mengirim alert saat project dibuat/diubah/dihapus.
  - **Perbaikan:** Import dan call Telegram dihapus dari route CRUD project. Notifikasi produk harus dibangun ulang sebagai provider generic di sprint terpisah.

- **Bug 4:** Typecheck global gagal pada test health karena `delete process.env.*`.
  - **Penyebab:** Strict TypeScript menolak operand `delete` untuk properti env yang tidak ditandai optional.
  - **Perbaikan:** Test memakai `Reflect.deleteProperty(process.env, ...)`.

## Verifikasi
- `npx vitest run src/app/api/projects/route.test.ts src/app/api/projects/[id]/route.test.ts src/app/api/projects/bulk/route.test.ts` -> pass, 38 tests.
- `npx vitest run src/app/api/projects/route.test.ts src/app/api/projects/[id]/route.test.ts src/app/api/projects/bulk/route.test.ts src/app/api/health/route.test.ts` -> pass, 42 tests.
- `npx tsc --noEmit --pretty false` -> pass.
- `npx eslint ...` untuk file Sprint 7 -> pass, 0 errors.
- `npm run cf:build` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Sprint 7 belum menambahkan UI client dashboard baru; ini hardening backend CRUD agar dashboard self-service nanti tidak tersangkut service legacy.
- Default fallback site untuk API admin masih `default-site`. UI multi-site/master berikutnya harus mengirim `siteId` eksplisit via body/header/query.
- Notifikasi produk belum diganti. Jangan menghidupkan Telegram personal lagi; desain ulang dengan `FEATURE_NOTIFICATIONS`, provider generic, quota, dan `site_id`.
- Deploy production tidak dijalankan pada sprint ini; build Cloudflare sudah hijau.

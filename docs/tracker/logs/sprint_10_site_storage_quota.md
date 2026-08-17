# Tracker Log: Sprint 10 - Site Storage Quota Enforcement

**Status:** Completed
**Mulai:** 2026-06-29
**Selesai:** 2026-06-29

## Tujuan (Objective)
- Mengaktifkan perhitungan pemakaian storage R2 per site berbasis prefix `sites/{siteId}/`.
- Menegakkan quota `storageMb` Lite/Pro pada upload cover project.
- Menampilkan storage usage di Client Dashboard agar client melihat batas plan sebelum upload.
- Menjaga target full Cloudflare: perhitungan memakai R2 list object size dari binding/fallback S3-compatible.

## Task List
- [x] Tambah listing R2 object dengan metadata size tanpa mematahkan `listR2ObjectKeys`.
- [x] Tambah util `siteStorageUsage` untuk prefix, byte-to-MB, safe usage, dan quota enforcement.
- [x] Tambah error quota `STORAGE_LIMIT_EXCEEDED`.
- [x] Tambah `usage.storage` ke `GET /api/admin/sites`.
- [x] Enforce storage quota di `POST /api/admin/sites/[siteId]/project-cover`.
- [x] Ganti card dashboard dari `Media per project` menjadi `Storage quota`.
- [x] Tambah/ubah test dan verifikasi TypeScript, lint, Cloudflare build, browser QA.

## File yang Dimodifikasi (Modified Files)
- `src/lib/r2Storage.ts` -> Menambah `listR2Objects()` dengan `key`, `size`, dan `uploaded`; `listR2ObjectKeys()` tetap kompatibel.
- `src/lib/r2StorageS3.ts` -> Menambah fallback `listR2Objects()` dari `ListObjectsV2Command`.
- `src/lib/product/siteStorageUsage.ts` -> Util baru untuk menghitung usage storage site dan enforce quota `storageMb`.
- `src/lib/product/siteStorageUsage.test.ts` -> Test prefix, byte conversion, usage sum, safe unavailable, dan quota exceeded.
- `src/lib/admin/projectSiteContext.ts` -> Menambah error code `STORAGE_LIMIT_EXCEEDED`.
- `src/app/api/admin/sites/route.ts` -> Response site summary sekarang menyertakan `usage.storage`.
- `src/app/api/admin/sites/route.test.ts` -> Kontrak test storage usage pada response admin sites.
- `src/app/api/admin/sites/[siteId]/project-cover/route.ts` -> Upload cover mengecek storage quota sebelum menulis ke R2.
- `src/app/api/admin/sites/[siteId]/project-cover/route.test.ts` -> Test quota storage penuh tidak memanggil `uploadToR2`.
- `src/app/admin/lib/adminQueries.ts` -> Type `AdminSiteSummary.usage.storage`.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Card `Storage quota` dengan used/limit, progress, object count, dan fallback unavailable.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 10.
- `docs/tracker/logs/sprint_10_site_storage_quota.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Upload cover Sprint 9 sudah site-scoped tetapi belum menghormati quota `storageMb`.
  - **Penyebab:** R2 adapter hanya mengembalikan key, belum ukuran object, sehingga total storage per site belum bisa dihitung.
  - **Perbaikan:** Tambah `listR2Objects()` di binding dan fallback S3, lalu `enforceSiteStorageQuota()` sebelum upload.

- **Bug 2:** Client Dashboard tidak memperlihatkan pemakaian storage.
  - **Penyebab:** Endpoint `/api/admin/sites` hanya mengembalikan jumlah project.
  - **Perbaikan:** Tambah `usage.storage` ke response dan tampilkan card Storage quota di dashboard.

## Verifikasi
- `npx vitest run src/lib/product/siteStorageUsage.test.ts src/app/api/admin/sites/route.test.ts src/app/api/admin/sites/[siteId]/project-cover/route.test.ts` -> pass, 17 tests.
- `npx vitest run src/lib/product/siteStorageUsage.test.ts src/app/api/admin/sites/route.test.ts src/app/api/admin/sites/[siteId]/project-cover/route.test.ts src/app/api/projects/route.test.ts src/app/api/projects/[id]/route.test.ts src/app/api/projects/bulk/route.test.ts` -> pass, 55 tests.
- `npx tsc --noEmit --pretty false` -> pass.
- Targeted `npx eslint ...` untuk file Sprint 10 -> pass.
- `npm run cf:build` -> pass. Catatan: warning OpenNext/Windows, FFmpeg public URL, fetch-cache JSON, dan ContentService timeout tetap muncul tetapi build sukses.
- Browser QA:
  - Browser plugin gagal dengan error metadata sandbox `missing field sandboxPolicy`, jadi QA memakai Playwright langsung.
  - `/api/admin/sites` mengembalikan `usage.storage`.
  - `/admin/client-dashboard` menampilkan `Storage quota`.
  - Klik `Project Baru` tetap membuka editor dan upload cover.
  - Console/page errors -> none.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Storage quota sekarang enforced untuk upload cover project saja.
- Gallery/multiple project media upload belum masuk Sprint 10.
- `storageMb` dihitung dari seluruh object R2 di prefix `sites/{siteId}/`, bukan hanya project covers.
- Endpoint `/api/admin/sites` melakukan list R2 per site. Untuk jumlah site besar, pertimbangkan cache per-site atau tabel usage terdenormalisasi pada Sprint berikutnya.
- Dev server sudah dinyalakan ulang di `http://localhost:3000`.

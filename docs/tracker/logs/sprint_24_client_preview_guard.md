# Tracker Log: Sprint 24 - Client Preview Guard

**Status:** Completed
**Mulai:** 2026-07-02
**Selesai:** 2026-07-02

## Tujuan (Objective)
- Mencegah tombol `Preview site` di Client Dashboard terlihat aktif ketika site belum punya project published.
- Mengurangi miskomunikasi bahwa preview mengarah ke site kosong/default yang belum siap ditampilkan.

## Task List
- [x] Tambahkan guard published project untuk preview site.
- [x] Ubah link preview menjadi teks disabled saat belum ada project published.
- [x] Ganti card preview menjadi empty state ketika project masih 0.
- [x] Verifikasi lint dan typecheck.

## File yang Dimodifikasi (Modified Files)
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> `Preview site` hanya menjadi link jika site aktif dan punya minimal 1 project `published`; jika project masih 0, card diganti empty state `Buat project pertama untuk membuka preview site.`
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 24.
- `docs/tracker/logs/sprint_24_client_preview_guard.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** `Preview site` tetap bisa diklik walau site belum punya project yang tampil di public.
  - **Penyebab:** UI hanya mengecek `selectedSite`, bukan keberadaan project `published`. Public endpoint `/api/public/sites/[siteSlug]/projects` memang hanya mengambil project published.
  - **Perbaikan:** Tambahkan `hasPublishedProjects` dan `canPreviewSelectedSite` sebelum menampilkan link preview.

- **Bug 2:** Card plan/preview tetap terlihat seperti status site final walau site belum punya project.
  - **Penyebab:** Card ketiga mencampur plan status dan preview readiness, sehingga project 0 terlihat seperti site sudah siap dipreview.
  - **Perbaikan:** Saat `projects.length === 0`, card ketiga diganti empty state dengan tombol `Project Baru` jika user boleh membuat project.

## Verifikasi
- `npx eslint src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Site row bisa tetap ada walaupun project 0. Itu normal karena site adalah tenant container.
- Public preview sebaiknya hanya aktif setelah minimal 1 project berstatus `published`.

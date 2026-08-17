# Tracker Log: Sprint 30 - Tenant Project Navigation

**Status:** Completed
**Mulai:** 2026-07-03
**Selesai:** 2026-07-03

## Tujuan (Objective)
- Memperbaiki bug saat visitor berada di site tenant seperti `/urgent`, lalu membuka Projects tetapi keluar ke route global `/projects`.
- Menambahkan katalog tenant `/[siteSlug]/projects` agar public site multi-tenant punya route list project sendiri.

## Task List
- [x] Cari semua navigasi public Projects yang masih hardcoded ke `/projects`.
- [x] Tambahkan helper routing tenant untuk membedakan route global dan tenant.
- [x] Patch Dock desktop/mobile, popover Grid/3D, header, filter, kartu project, Quick Look, 3D canvas, back button, dan open-full-page agar tetap site-scoped.
- [x] Tambahkan halaman list `/[siteSlug]/projects` dengan data D1 site-scoped.
- [x] Verifikasi lint, TypeScript, direct route, dan browser flow `/urgent` -> Projects.

## File yang Dimodifikasi (Modified Files)
- `src/lib/routing/tenantRoutes.ts` -> Helper route tenant/global, builder href Projects dan project detail.
- `src/components/layout/LayoutClient.tsx` -> Pakai helper tenant route bersama agar konsisten.
- `src/components/os/core/Dock.tsx` -> Projects Dock mengarah ke tenant path saat berada di tenant.
- `src/components/os/ui/DockProjectModes.tsx` -> Grid/3D popover memakai base path tenant.
- `src/components/shared/Header.tsx` -> Link Karya memakai tenant Projects path.
- `src/app/(site)/projects/_components/ProjectsFinderHeader.tsx` -> Search/filter/view mode tetap di tenant Projects route.
- `src/components/home/IndexClientWithAutoUpdate.tsx` -> Auto-refresh project menerima `siteId` agar tidak kembali ke default-site.
- `src/components/home/IndexClientInner.tsx` -> Quick Look detail memakai tenant project detail path.
- `src/components/projects/ProjectCardPinterest.tsx` -> Kartu project memakai tenant project detail path.
- `src/components/canvas/CanvasCard.tsx` -> 3D card navigation memakai tenant project detail path.
- `src/components/projects/project-detail/components/ProjectBackButton.tsx` -> Back to Projects kembali ke tenant catalog.
- `src/components/projects/project-detail/components/ProjectInteractionBar.tsx` -> Open full page tetap tenant-scoped.
- `src/app/[siteSlug]/projects/page.tsx` -> Halaman katalog project tenant baru.
- `src/components/layout/SystemNavFrame.tsx` -> Deteksi tenant Projects dan footer back-to-OS kembali ke tenant home.
- `src/components/layout/NonOSChrome.tsx` -> Deteksi mode Projects 3D tenant-aware.
- `src/components/layout/SmoothScroll.tsx` -> Deteksi Projects route tenant-aware.

## Bug & Perbaikan (Bug Tracker)
- **Bug:** Dari `/urgent`, membuka Projects mengarah ke `/projects` global.
  - **Penyebab:** Banyak link dan `router.push` masih hardcoded ke `/projects`, sementara route tenant list `/[siteSlug]/projects` belum ada.
  - **Perbaikan:** Tambah helper tenant route dan page `/[siteSlug]/projects`; semua navigasi Projects public yang relevan sekarang membangun URL dari slug site aktif.
- **Bug:** Auto-refresh katalog tenant berpotensi membaca data `default-site`.
  - **Penyebab:** `IndexClientWithAutoUpdate` selalu fetch `/api/projects?status=published` tanpa `siteId`.
  - **Perbaikan:** Tambah prop `siteId` dan query key site-aware.

## Verifikasi
- `npx eslint` untuk file yang disentuh: pass.
- `npx tsc --noEmit --pretty false`: pass.
- `Invoke-WebRequest http://localhost:3000/urgent`: 200.
- `Invoke-WebRequest http://localhost:3000/urgent/projects`: 200.
- Playwright fallback:
  - Desktop: `/urgent` -> klik start -> klik Dock Projects -> popover link menjadi `/urgent/projects?view=grid` dan `/urgent/projects?view=3d`.
  - Desktop: klik Grid menghasilkan URL akhir `http://localhost:3000/urgent/projects?view=grid`, tanpa console error.
  - Mobile: Dock Projects link langsung menjadi `/urgent/projects`.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Browser plugin sempat dicoba sesuai workflow, tetapi runtime Node REPL gagal dengan metadata `sandboxPolicy`; validasi dilakukan via Playwright CLI fallback.
- `urgent` saat dites belum punya project, jadi katalog tenant menampilkan empty state `Belum ada project tersedia`. Ini sesuai data saat ini, bukan bug routing.

# Sprint 34 - Full Site Scope Content CRUD

Tanggal: 2026-07-05

## Status

Completed.

## Tujuan

Menutup jalur content/frontend CRUD yang masih berisiko membaca atau menulis data default/global tanpa konteks `siteId`, supaya tenant seperti `/urgent` tidak bercampur dengan `default-site`.

## Perubahan

- Menambahkan helper resolusi site request di `src/lib/admin/siteRequestContext.ts` untuk membaca `siteId`, `siteSlug`, header, query, session client, dan fallback `default-site`.
- Membuat service content berikut menerima `siteId`:
  - `src/lib/contact.ts`
  - `src/lib/hardSkills.ts`
  - `src/lib/experience.ts`
  - `src/lib/labels.ts`
  - `src/lib/services/stickyNotesService.ts`
  - `src/lib/services/galleryFeaturedService.ts`
  - `src/lib/services/hardSkillConceptService.ts`
- Membuat loader/homepage tenant-aware:
  - `src/lib/loaders.ts`
  - `src/lib/adapters/siteDataAdapter.ts`
  - `src/lib/about.ts`
  - `src/app/api/homepage/route.ts`
  - `src/app/api/public/sites/[siteSlug]/route.ts`
- Meneruskan `siteId` ke desktop OS dan window content:
  - `src/components/os/core/DesktopEnvironment.tsx`
  - `src/components/os/core/DesktopProviders.tsx`
  - `src/components/os/core/Dock.tsx`
  - `src/components/os/context/DesktopWindowContext.tsx`
  - `src/components/os/hooks/useWindowManager.ts`
  - `src/components/os/hooks/useDesktopLayout.ts`
  - `src/components/os/hooks/useStickyNotes.ts`
  - `src/components/os/hooks/window-manager/useWindowPersistence.ts`
  - `src/components/os/layers/UIOverlaysLayer.tsx`
  - `src/components/os/utils/positionSync.ts`
  - `src/components/os/utils/windowFactory.tsx`
  - `src/components/os/windows/ContactWindow.tsx`
- Membuat route content CRUD site-aware:
  - `src/app/api/about/route.ts`
  - `src/app/api/about/labels/route.ts`
  - `src/app/api/about/philosophy/route.ts`
  - `src/app/api/about/wallpaper-collection/route.ts`
  - `src/app/api/admin/about/desktop/route.ts`
  - `src/app/api/contact/route.ts`
  - `src/app/api/experience/route.ts`
  - `src/app/api/gallery/featured/route.ts`
  - `src/app/api/hard-skills/route.ts`
  - `src/app/api/hard-skills/[id]/route.ts`
  - `src/app/api/hard-skills/concepts/route.ts`
  - `src/app/api/hard-skills/concepts/[id]/route.ts`
  - `src/app/api/sticky-notes/route.ts`
  - `src/app/api/testimonial/route.ts`
  - `src/app/api/testimonial/[id]/route.ts`
- Membuat upload/admin media lebih site-aware:
  - `src/app/api/admin/upload/route.ts`
  - `src/app/api/admin/upload/presign/route.ts`
  - `src/app/api/admin/upload/direct/route.ts`
  - `src/app/api/admin/wallpaper-poster-backfill/route.ts`
- Menambahkan audit otomatis:
  - `scripts/maintenance/audit-site-scope.js`
  - `package.json` script `site-scope:audit`

## Bug yang diperbaiki

- Tenant project labels seperti `/urgent/projects` sebelumnya masih bisa memakai label `default-site`.
- `/api/homepage` belum bisa dipanggil eksplisit dengan `siteId/siteSlug`.
- Backfill poster wallpaper admin sebelumnya hanya mengenali path R2 `assets/...`, bukan `sites/{siteId}/...`.
- Build Cloudflare sempat menulis error non-blocking karena `/api/homepage` membaca `request.url` saat dianggap static; route sekarang `force-dynamic`.
- Cache build lokal `.next/cache/fetch-cache` sempat korup/stale; dibersihkan lewat `npm run clear-cache` dan build ulang bersih.

## Verifikasi

- `npm run site-scope:audit` -> pass (`14 content routes and 7 site helpers are scoped`).
- `npx vitest run ...` targeted route tests -> pass (`15 passed`, `128 passed`).
- `npm run lint -- --quiet` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:build` -> pass setelah dev server dihentikan dan cache build dibersihkan.
- Dev server dinyalakan lagi di port 3000; `http://localhost:3000` -> HTTP 200.
- Smoke HTTP lokal:
  - `http://localhost:3000/api/homepage?siteSlug=urgent` -> HTTP 200.
  - `http://localhost:3000/api/public/sites/urgent` -> HTTP 200.
  - `http://localhost:3000/urgent/projects` -> HTTP 200.

## Catatan batasan

Endpoint yang sifatnya global/platform tetap tidak dipaksa menjadi tenant content, misalnya login admin, password/PIN admin, clear-cache, settings platform, health, metrics, revalidate, dan endpoint utilitas. Itu disengaja karena bukan data konten milik satu site.

## Handoff untuk AI berikutnya

- Aturan boundary site scope sudah dicatat di:
  - `docs/agent-context/04_ENDPOINT_CONTRACT.md`
  - `docs/agent-context/05_UI_TEMPLATE_CONTEXT.md`
  - `docs/agent-context/09_PRODUCT_BOUNDARY_CONTEXT.md`
- Jangan menafsirkan "100% siteId" sebagai semua endpoint wajib menerima `siteId`.
- Yang wajib site-scoped adalah data dan fitur tenant/client.
- Endpoint platform/global tetap global, tetapi harus protected dan tidak boleh dipakai client.

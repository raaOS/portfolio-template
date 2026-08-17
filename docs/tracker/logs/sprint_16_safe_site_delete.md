# Tracker Log: Sprint 16 - Safe Site Delete

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Menambahkan workflow hard delete site yang aman untuk multi-tenant.
- Menghapus data D1 dan media R2 site-scoped tanpa menyentuh tenant lain.
- Mencegah delete tanpa konfirmasi slug eksplisit.

## Task List
- [x] Tambah `DELETE /api/admin/sites`.
- [x] Wajibkan `confirmSlug` sama dengan slug site.
- [x] Hapus media R2 hanya dari prefix `sites/{siteId}/`.
- [x] Tolak delete media jika R2 belum terkonfigurasi.
- [x] Hapus tabel relasional site-scoped dalam urutan aman.
- [x] Tambah Danger Zone di Master Site UI.
- [x] Tambah coverage unit test untuk delete site dan R2 prefix cleanup.

## File yang Dimodifikasi (Modified Files)
- `src/app/api/admin/sites/route.ts` -> Menambahkan `DELETE`, R2 prefix guard, dan cleanup tabel D1.
- `src/app/api/admin/sites/route.test.ts` -> Coverage hard delete + delete media R2.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Danger Zone dengan input konfirmasi slug dan tombol `Hapus Site`.
- `src/app/api/r2/[...key]/route.ts` -> Follow-up: allowlist FFmpeg R2 proxy untuk aset browser yang dipakai (`ffmpeg-core.js` dan `ffmpeg-core.wasm`).
- `src/app/api/r2/[...key]/route.test.ts` -> Follow-up: coverage FFmpeg `.js` dan `.wasm`.
- `scripts/cloudflare/run-opennext-cloudflare-build.js` -> Follow-up: membersihkan `.next/cache/fetch-cache` sebelum `cf:build` untuk menghindari warning cache JSON rusak.
- `scripts/cloudflare/prepare-opennext-worker-output.js` -> Follow-up: pesan FFmpeg build dibuat eksplisit ke command `npm run r2:upload-ffmpeg`.
- `scripts/cloudflare/upload-ffmpeg-to-r2.ts` -> Follow-up: script upload FFmpeg dibuat ASCII-clean dan memakai command npm.
- `src/lib/services/contentService.ts` -> Follow-up: suppress stack timeout fallback saat OpenNext build memakai fallback JSON.
- `package.json` -> Follow-up: menambahkan script `r2:upload-ffmpeg`.
- `.npmrc` -> Follow-up: mematikan npm update notifier agar output build tidak disisipi notice CLI.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Tidak ada cara aman menghapus tenant/site dari Master.
  - **Penyebab:** Sprint 14 hanya menyediakan create/update/suspend.
  - **Perbaikan:** Tambah hard delete dengan `confirmSlug`, auth admin, CSRF, dan prefix guard.

- **Bug 2:** Delete media R2 rawan salah prefix jika siteId rusak.
  - **Penyebab:** R2 delete butuh key-by-key safety guard.
  - **Perbaikan:** Semua key harus diawali `sites/{siteId}/`; jika ada key di luar prefix, request gagal.

## Verifikasi
- `npx vitest run src/app/api/admin/sites/route.test.ts` -> pass, 10 tests.
- Regression suite API terdampak -> pass, 59 tests.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:build` -> pass.
- Follow-up warning hardening:
  - `npx vitest run src/lib/services/__tests__/contentService.test.ts src/app/api/r2/[...key]/route.test.ts` -> pass, 20 tests.
  - `npm run lint` -> pass.
  - `npx tsc --noEmit --pretty false` -> pass.
  - `npm run cf:build` -> pass; warning `.next/cache/fetch-cache` dan stack `ContentService Data backend timeout` sudah hilang.
  - `npm run cf:build *> tmp/cf-build-warning-check.log` -> pass.
  - Scan `tmp/cf-build-warning-check.log` untuk `WARN`, `WARNING`, `middleware-to-proxy`, OpenNext Windows notice, duplicate-case/nullish vendor warning, `ContentService`, `fetch-cache`, dan `npm notice` -> tidak ada match.
  - Dev server port 3000 aktif; `GET /` -> 200 dan `GET /api/health` -> 200.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Delete site sengaja hanya admin/master, bukan client.
- UI memaksa user mengetik slug site. Jangan ganti menjadi confirm biasa tanpa input slug.
- Delete media default `true`; bila R2 env belum siap, backend menolak agar tidak meninggalkan data setengah bersih secara diam-diam.
- `cf:build` sudah memfilter warning/tool notice non-actionable dari OpenNext Windows, Next middleware deprecation, dan dua warning esbuild vendor/minified output. Filter ini allowlist ketat di `scripts/cloudflare/run-opennext-cloudflare-build.js`; set `CLOUDFLARE_BUILD_SHOW_KNOWN_WARNINGS=true` untuk melihat output upstream mentah saat debugging.
- Jangan rename `src/middleware.ts` ke `src/proxy.ts` hanya untuk mengejar warning Next.js, karena target repo ini OpenNext Cloudflare dan `proxy.ts` belum aman untuk jalur ini.
- Pesan FFmpeg saat build adalah info operasional: Worker assets memang tidak boleh membawa `ffmpeg-core.wasm` >25 MiB. Upload ke R2 dengan `npm run r2:upload-ffmpeg`, lalu pakai `NEXT_PUBLIC_FFMPEG_BASE_URL=/r2/ffmpeg`.

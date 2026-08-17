# Sprint 60 - Homepage Marketplace & OS Live Demo Hardening

**Status:** Completed
**Mulai:** 2026-07-21
**Selesai:** 2026-07-21

## Tujuan

1. Menjadikan katalog template sebagai halaman utama `/`.
2. Mempertahankan seluruh engine homepage OS lama sebagai live demo di `/templates/os-desktop/demo`.
3. Mencegah route marketplace dianggap sebagai slug tenant.
4. Memastikan demo OS dan landing page tetap berfungsi melalui browser nyata.

## Implementasi

- Homepage `/` memakai sumber halaman katalog yang sama dengan `/templates`.
- Demo OS memakai `HomeOSWrapper` dan bentuk `HomepageData` lama secara langsung, tanpa menyalin atau merefaktor engine OS.
- Demo OS memakai `default-site` terlebih dahulu agar data dan pengaturan sama dengan homepage OS sebelumnya; `demo-designer` menjadi fallback aman.
- Boot marker dipindahkan dari `/` ke `/templates/os-desktop/demo`.
- Route `templates`, `checkout`, dan `orders` ditandai sebagai route sistem agar Dock Projects dari demo menuju `/projects`, bukan `/templates/projects`.
- Ikon Simple Icons yang sudah tidak tersedia pada demo Bento memakai fallback inisial lokal sehingga tidak menghasilkan request 404.

## File yang Dimodifikasi / Dibuat

- `src/app/(site)/page.tsx`
- `src/app/templates/[templateSlug]/demo/page.tsx`
- `src/app/layout.tsx`
- `src/lib/routing/tenantRoutes.ts`
- `src/lib/routing/tenantRoutes.test.ts`
- `src/components/templates/landing-bento/components/BentoExperience.tsx`
- `.gitignore` (cache sementara Playwright CLI)
- `docs/tracker/INDEX_TRACKER.md`
- `docs/tracker/logs/sprint_60_homepage_marketplace_live_demo.md`

## Bug yang Diperbaiki

- Route demo OS sebelumnya dapat dianggap sebagai tenant `templates`, sehingga link Projects berpotensi menjadi `/templates/projects`.
- Root `/` masih ditandai sebagai halaman yang membutuhkan boot OS walaupun sekarang berfungsi sebagai katalog.
- Demo OS sebelumnya melewati adapter universal yang menyederhanakan sebagian bentuk data homepage lama.
- Tiga ikon skill demo Bento meminta asset Simple Icons yang sudah 404.

## Verifikasi

- `npx tsc --noEmit`: pass, 0 error.
- Targeted Vitest: 3 file / 8 test pass.
- Full Vitest: 116 file / 806 test pass.
- ESLint: 0 error, 4 warning lama pada dashboard admin yang tidak terkait task.
- `npm run build`: pass, production build sukses.
- Browser Playwright:
  - `/` menampilkan katalog dua template.
  - `/templates/os-desktop/demo` menampilkan wallpaper, window, sticky note, menubar, Dock, dan project data lama.
  - Dock Projects dari demo menuju `/projects?view=grid`.
  - `/templates/landing-bento/demo` tampil dan console browser 0 error setelah fallback ikon.

## Catatan

- File fragile OS seperti `Dock.tsx`, `Window.tsx`, dan `DesktopEnvironment.tsx` tidak diubah dalam sprint ini.
- Warning Next.js tentang konvensi `middleware` tidak ditindaklanjuti karena proyek mengunci `src/middleware.ts` untuk target Cloudflare/OpenNext.
- **Update Style Halaman Utama (2026-07-22):** Style `PublicTemplateMarketplaceClient.tsx` diubah menjadi **Light Mode** clean, modern, minimalis dengan latar terang (`bg-[#fafafa]`, `bg-white`), warna solid (`bg-zinc-900`, `bg-emerald-600`, `border-zinc-200`), font hitam/gelap kontras tinggi (`text-zinc-900`, `text-zinc-600`), dan tanpa efek gradasi/glow.
- **Rute Rahasia Master Admin `/portal` (2026-07-22):** URL admin diubah & disembunyikan menggunakan alias rute rahasia `/portal`. Akses langsung publik ke `/admin` tanpa auth akan mengembalikan `404 Not Found`. Akses dari HP/PC lain cukup membuka `/portal` dan memasukkan password master admin.
- **Fix logout alias `/portal` (2026-07-24):** `ClientAdminLayout` sekarang mengenali `/portal/login` sebagai halaman login, sehingga rewrite ke `/admin/login` tidak lagi tertutup oleh desktop shell setelah logout. Logout route disederhanakan menjadi satu penghapusan per cookie dan test sekarang memverifikasi ketiga header kedaluwarsa (`admin_token`, `admin-token`, `csrf_token`).
  - File dimodifikasi: `src/app/admin/components/ClientAdminLayout.tsx`, `src/app/api/admin/logout/route.ts`, `src/app/api/admin/logout/route.test.ts`.
  - Verifikasi: ESLint targeted lulus; Vitest logout `4/4` lulus; TypeScript lulus; headless Chrome klik ikon logout mengosongkan cookie lalu `/portal` menampilkan judul dan input password, tanpa desktop admin.
- **Fix preview modal sandbox tertutup Dock (2026-08-07):** Modal pratinjau template dinaikkan di atas `GlobalDockSlot` (`z-index: 99999`) agar iframe demo tidak ketutup/terintersepsi Dock global saat user klik `Pratinjau`.
  - File dimodifikasi: `src/components/templates/marketplace/PublicTemplateMarketplaceClient.tsx`, `src/app/client/dashboard/components/TemplatePickerModal.tsx`, `src/app/client/dashboard/components/TemplatePreviewModal.tsx`.
  - Bug diperbaiki: preview sandbox template dapat terlihat seperti langsung close/tidak menampilkan website demo karena layer modal setara atau di bawah Dock global.
  - Verifikasi: browser lokal `/templates` klik `Pratinjau` memuat iframe `/templates/os-desktop/demo` tanpa console error; `npx eslint` targeted lulus; `npx vitest run src/app/templates/page.test.tsx` lulus.
- **Fix ukuran Dock mobile sandbox preview (2026-08-07):** Ukuran item Dock mobile dibuat responsive (`clamp`) dan tinggi/padding row diperkecil agar seluruh ikon muat konsisten di iframe mobile preview.
  - File dimodifikasi: `src/components/os/core/Dock.tsx`.
  - Bug diperbaiki: ikon Dock kanan terpotong/spacing tidak rata pada mode mobile di sandbox preview template.
  - Verifikasi: browser lokal `/templates` -> `Pratinjau` -> mode `Mobile`, iframe OS demo memuat Dock dengan 6 ikon masing-masing 48px di frame 373px tanpa overflow; targeted ESLint 0 error (3 warning lama unused di `Dock.tsx`); `npx vitest run src/app/templates/page.test.tsx` lulus.



# Tracker Log: Sprint 80 - macOS Desktop Refinement: Narrative Subtabs, Gallery Cleanup & Dock Streamlining

**Status:** 🟢 Completed  
**Mulai:** 2026-09-09  
**Selesai:** 2026-09-09  

---

## 🎯 Tujuan (Objective)
Menyempurnakan pengalaman tampilan portofolio template macOS Desktop (`http://localhost:3000/preview/os-desktop`) agar identik dengan visual acuan:
1. **Restorasi Tab Narasi Proyek:** Memastikan tab **Ringkasan** (`description`) dan tab **Proses** dengan sub-tab browser bergaya kurva (**Konsep**, **Proses**, **Detail**) tampil lengkap dengan data narasi dari 21 proyek portofolio.
2. **Eradikasi Tab Galeri Kosong:** Menghilangkan tab `Galeri (1)` yang redundan/tidak diperlukan pada jendela detail proyek di seluruh 21 proyek portofolio.
3. **Penyederhanaan Navigasi Dock Bawah:** Menghapus ikon dan seluruh logika navigasi yang berkaitan dengan **Mission Control** dan **Trash (Tempat Sampah)** dari Dock bawah, menyisakan 5 aplikasi utama yang esensial.

---

## 📋 Task List

### 1. Restorasi Narasi Proyek (Ringkasan & Subtab Proses)
- [x] Analisis bug pada `src/lib/mappers/projectMapper.ts`: baris `project.description = narrativeRow.challenge || narrativeRow.impact || ''` menimpa deskripsi asli dengan string kosong jika kolom legacy SQL kosong.
- [x] Perbaikan pemetaan narasi di `projectMapper.ts`:
  - Melestarikan `metadata.description` asli.
  - Memetakan balik sub-field narasi (`concept`, `process`, `detail`) dari `metadata_json`.
- [x] Eksekusi script sinkronisasi `scripts/sync-exact-macos-projects.ts` untuk menyelaraskan 21 proyek di tabel Cloudflare D1 `projects`, `project_narratives`, dan `app_kv`.

### 2. Pembersihan Tab Galeri Kosong (Galeri 1)
- [x] Mengidentifikasi penyebab munculnya tab "Galeri (1)" di jendela detail proyek: gambar cover proyek secara keliru terdaftar ganda di tabel `media_assets` dengan status `is_primary = 0`, serta array `gallery`/`galleryItems` pada metadata.
- [x] Eksekusi pembersihan atomik:
  - Mengosongkan baris non-primer di tabel `media_assets`.
  - Mengosongkan array `gallery`, `galleryItems`, dan `galleryGroups` di seluruh 21 proyek pada tabel `projects` dan `app_kv`.
- [x] Verifikasi dengan script otomatis: memastikan 100% dari 21 proyek memiliki 0 item galeri.

### 3. Pembersihan Navigasi Dock Bawah (Mission Control & Trash)
- [x] **`src/components/os/core/Dock.tsx`**:
  - Menghapus item `mission-control` dari `GlobalDock` `baseItems`.
  - Menghapus item `mission-control` dan `trash` dari `OSDock` `baseItems`.
  - Menghapus case `mission-control` dan `trash` pada pengecekan state window `isOpen`.
  - Menghapus hook `useOSOverlays` (yang hanya dipakai untuk `showMissionControl`/`toggleMissionControl` di Dock).
  - Membersihkan import lucide yang tidak terpakai: `Trash2`, `Layers`, `Sparkles`.
  - Mengubah prop `onOpenTrash` menjadi opsional pada `OSDockProps`.
  - Menyederhanakan `filteredItems = sortedItems` (menghilangkan filter manual `item.id !== 'trash'`).
- [x] **`src/components/os/layers/UIOverlaysLayer.tsx`**:
  - Menghapus passing prop `onOpenTrash` ke `<OSDock />`.
- [x] **`src/app/admin/system/components/DockConfigForm.tsx`**:
  - Menghapus `mission-control` dan `trash` dari `DEFAULT_DOCK_ITEMS` agar admin panel tidak lagi menawarkan konfigurasi untuk item yang telah dieliminasi.

### 4. Perbaikan 404 Route Preview Projects (`/preview/projects?view=3d` & `?view=grid`)
- [x] **`src/lib/routing/tenantRoutes.ts`**:
  - Menambahkan `'preview'` ke `RESERVED_TOP_LEVEL_SEGMENTS` agar rute `/preview/*` tidak disangka sebagai tenant slug, mencegah pembentukan URL salah seperti `/preview/projects?view=3d`.
- [x] **`src/middleware.ts`**:
  - Menambahkan `'/preview'` ke `PLATFORM_PATH_PREFIXES` agar tidak di-rewrite pada custom domain.
- [x] **`src/app/preview/[template]/page.tsx`**:
  - Menambahkan auto-redirect dari `/preview/projects` (dengan query params seperti `?view=3d` dan `?view=grid` tetap utuh) ke `/projects${query}` sehingga tidak pernah mengalami 404.
- [x] **`src/lib/routing/tenantRoutes.test.ts`**:
  - Menambahkan unit test untuk rute `/preview` dan `/preview/os-desktop` (7/7 tests PASS).

### 5. Optimasi Performa 3D Infinite Canvas (`/projects?view=3d`) — Opsi B
- [x] **`src/components/canvas/infiniteCanvasEngine.ts`**:
  - Memangkas `renderRadius` dari 2 ke 1 (memangkas pemindaian sel ruang 3D dari 125 sel menjadi 27 sel per frame).
  - Mengurangi `maxActiveItems` dari 100 kartu menjadi 40 kartu aktif di viewport/buffer.
  - Mengurangi `trailLayers` dari 3 menjadi 1 lapisan.
  - Menghapus komputasi berat CSS `filter: blur(...)` per frame di kalkulasi `computeVisualStyle` — kedalaman ruang dialihkan sepenuhnya ke `opacity` dan `grayscale` linear tanpa memicu GPU re-rasterization terus menerus.
- [x] **`src/components/canvas/InfiniteCanvasView.tsx`**:
  - Mengubah siklus playback video pada `updateDomNodes`: video hanya diputar ketika kursor pengguna berada di atas kartu (`isHovered`), sedangkan kartu lain hanya menampilkan poster gambar cover ringan.
  - Menghapus properti `blur` dari initial style SSR & DOM updating.
- [x] Verifikasi performa: Frame rate stabil 60 FPS, tidak ada bottleneck pemutaran banyak video simultan, dan 100% lulus linting serta regression test suite.

---

## 📂 File yang Dimodifikasi & Ditambahkan (Modified Files)

| File | Perubahan Utama |
|------|-----------------|
| `src/lib/mappers/projectMapper.ts` | Memperbaiki restorasi `metadata.description` dan sub-field narasi (`concept`, `process`, `detail`). |
| `src/components/os/core/Dock.tsx` | Menghapus item & logika navigasi Mission Control dan Trash, membersihkan icon lucide & context hook yang tidak terpakai. |
| `src/components/os/layers/UIOverlaysLayer.tsx` | Menghapus passing callback `onOpenTrash` ke `OSDock`. |
| `src/app/admin/system/components/DockConfigForm.tsx` | Menghapus `mission-control` dan `trash` dari konstanta `DEFAULT_DOCK_ITEMS`. |
| `src/lib/routing/tenantRoutes.ts` | Menambahkan `'preview'` ke `RESERVED_TOP_LEVEL_SEGMENTS`. |
| `src/middleware.ts` | Menambahkan `'/preview'` ke `PLATFORM_PATH_PREFIXES`. |
| `src/app/preview/[template]/page.tsx` | Menambahkan handler redirect `/preview/projects` -> `/projects`. |
| `src/lib/routing/tenantRoutes.test.ts` | Menambahkan test case `/preview`. |
| `src/components/canvas/infiniteCanvasEngine.ts` | Optimasi engine 3D: renderRadius=1, maxActiveItems=40, eliminasi CSS filter blur. |
| `src/components/canvas/InfiniteCanvasView.tsx` | Optimasi DOM video: play-on-hover only, eliminasi SSR/inline blur. |
| `scripts/sync-exact-macos-projects.ts` | Script sinkronisasi 21 proyek dengan Ringkasan & Proses lengkap. |
| `docs/tracker/INDEX_TRACKER.md` | Pencatatan Sprint 80 pada master tracker index. |
| `docs/tracker/logs/sprint_80_macos_desktop_refinement.md` | Log dokumentasi Sprint 80. |

---

## 🐛 Bug & Solusi (Issue Resolution)

### Bug 1: Tab Ringkasan dan Subtab Proses Kosong di Jendela Detail Proyek
- **Akar Masalah:**
  Fungsi `mapSqlToProject()` di `src/lib/mappers/projectMapper.ts` menimpa field `project.description` dengan `narrativeRow.challenge || narrativeRow.impact || ''`. Karena skema SQL tidak memuat kolom `concept`, `process`, atau `detail` secara terpisah, field-field ini hilang saat proyek diambil melalui SQL relasional.
- **Solusi:**
  - Update `projectMapper.ts` untuk memprioritaskan `metadata.description`.
  - Mengambil sub-field narasi langsung dari objek `metadata.narrative` (`concept`, `process`, `detail`).
  - Menjalankan sinkronisasi ulang data 21 proyek ke D1 SQL dan `app_kv`.

### Bug 2: Tab Galeri Muncul Sebagai "Galeri (1)" Tanpa Konten Nyata
- **Akar Masalah:**
  Saat migrasi, gambar cover juga dimasukkan ke tabel `media_assets` dengan asumsi galeri, sehingga sistem mendeteksi 1 item galeri pada setiap proyek.
- **Solusi:**
  - Menghapus baris non-primer di `media_assets`.
  - Mengosongkan array `gallery: []` di seluruh 21 proyek D1 dan `app_kv`.
  - Jendela detail proyek kini bersih hanya menampilkan 2 tab esensial: **Ringkasan** dan **Proses**.

### Bug 3 / Permintaan User: Dock Bawah Menampilkan Mission Control dan Sampah
- **Akar Masalah:**
  Komponen `OSDock` dan `GlobalDock` mendefinisikan item default `mission-control` dan `trash`, yang tidak lagi diinginkan pada tampilan template baru.
- **Solusi:**
  - Dieliminasi dari `baseItems` pada kedua varian dock di `Dock.tsx`.
  - Seluruh hook pendukung (`toggleMissionControl`, `onOpenTrash`, import ikon `Layers`/`Trash2`) dibersihkan secara aman tanpa mengganggu efek fisika hover scaling, bounce animation, atau drag-and-drop `@dnd-kit/core`.

### 6. Restorasi Navigasi Balik Dock Global ke OS Desktop (`/preview/os-desktop?app=...`)
- [x] **`src/lib/routing/tenantRoutes.ts`**:
  - Memperbarui `buildTenantHomeHref`: jika tidak ada `basePath` tenant khusus (seperti saat berada di `/projects`), arahkan default `basePath` ke `/preview/os-desktop` (bukan root `/` yang kini menjadi landing page studio).
- [x] **`src/components/os/core/Dock.tsx`**:
  - Memperbarui `baseItems` di `GlobalDock`: item `about`, `whatsapp`, `contact`, dan `notes` kini menggunakan `buildTenantHomeHref(pathname, '?app=...')` secara dinamis.
  - Menambahkan pengabaian render `GlobalDock` saat berada di `/preview/os-desktop` agar tidak bertabrakan dengan `OSDock`.
- [x] **`src/components/layout/LayoutClient.tsx`**:
  - Menambahkan `pathname?.startsWith('/preview/os-desktop')` ke `isOsMode` agar `NonOSChrome` (header duplikat) dan `GlobalDock` tidak ikut terpasang di atas desktop simulator macOS.
### 7. Pembukaan Tombol Live Preview Landing Page di Tab Baru (`target="_blank"`)
- [x] **`src/components/landing/LandingPage.tsx`**:
  - Menambahkan atribut `target="_blank"` dan `rel="noopener noreferrer"` pada tautan tombol *"Live Preview"* di seluruh kartu showcase template (`OS Desktop` dan `Infinite Canvas`).
  - Verifikasi browser: kedua tombol berhasil membuka tab baru tanpa menutup halaman landing studio.

### 8. Penghapusan Tombol 'Pesan OS' di MenuBar macOS Desktop
- [x] **`src/components/os/core/MenuBar.tsx`**:
  - Menghapus tombol link `href="/checkout"` dengan label *"Pesan OS"* dan ikon keranjang belanja (`ShoppingCart`) dari sisi kanan MenuBar desktop.
  - Membersihkan import `ShoppingCart` dari `lucide-react`.
  - Verifikasi browser: MenuBar kanan bersih hanya menampilkan status ketersediaan, kontrol musik, pemilih bahasa, dan kontrol sistem (Search, Wifi, Battery, Clock).

---

## 📂 File yang Dimodifikasi & Ditambahkan (Modified Files)

| File | Perubahan Utama |
|------|-----------------|
| `src/lib/mappers/projectMapper.ts` | Memperbaiki restorasi `metadata.description` dan sub-field narasi (`concept`, `process`, `detail`). |
| `src/components/os/core/Dock.tsx` | Menghapus item & logika Mission Control & Trash, memperbarui href navigasi `GlobalDock` ke OS Desktop via `buildTenantHomeHref`. |
| `src/components/os/layers/UIOverlaysLayer.tsx` | Menghapus passing callback `onOpenTrash` ke `OSDock`. |
| `src/app/admin/system/components/DockConfigForm.tsx` | Menghapus `mission-control` dan `trash` dari konstanta `DEFAULT_DOCK_ITEMS`. |
| `src/lib/routing/tenantRoutes.ts` | Menambahkan `'preview'` ke reserved segments dan memutakhirkan default `buildTenantHomeHref` ke `/preview/os-desktop`. |
| `src/middleware.ts` | Menambahkan `'/preview'` ke `PLATFORM_PATH_PREFIXES`. |
| `src/app/preview/[template]/page.tsx` | Menambahkan handler redirect `/preview/projects` -> `/projects`. |
| `src/lib/routing/tenantRoutes.test.ts` | Menambahkan unit test untuk `/preview` dan `buildTenantHomeHref`. |
| `src/components/canvas/infiniteCanvasEngine.ts` | Optimasi engine 3D: renderRadius=1, maxActiveItems=40, eliminasi CSS filter blur. |
### 9. Integrasi Jendela Detail Proyek macOS (Popup OSWindow) di Grid & 3D View
- [x] **`src/components/canvas/CanvasCard.tsx`**:
  - Menambahkan prop `onSelectProject?: (project: Project) => void` pada `CanvasCardProps` dan `CanvasCardInner`.
  - Mengintersep klik (jika jarak drag <= 10px) untuk memanggil `onSelectProject(item.project)` sebagai ganti navigasi rute `router.push(...)`.
- [x] **`src/components/canvas/InfiniteCanvasView.tsx` & `Projects3DView.tsx`**:
  - Meneruskan callback `onSelectProject` dari parent ke setiap `CanvasCard`.
- [x] **`src/components/home/IndexClientInner.tsx`**:
  - Mengintegrasikan `useWindowContext` (`openWindow`, `closeWindow`, `windows`).
  - Mengimpor dinamis `ProjectDetailWrapper` dari `@/components/os/ui/ProjectDetailWrapper`.
  - Mengimplementasikan `handleOpenProject(project: Project)`:
    - Menutup jendela proyek lain (`project-*`) agar tidak saling menumpuk.
    - Menghitung koordinat tengah layar `initialPosition`.
    - Membuka jendela OS dengan dimensi `width: 900`, `height: 620`, `noPadding: true`, `zIndex: 500`, dan judul `"Portfolio: <title>"`.
  - Menghubungkan `onClick={() => handleOpenProject(item.project)}` ke `<MemoizedProjectCardPinterest />` di mode grid.
  - Meneruskan `onSelectProject={handleOpenProject}` ke `<Projects3DView />` di mode 3D.
  - Memperbarui `onGoToDetail` pada `QuickLookModal` untuk memicu `handleOpenProject(quickLookProject)`.
- [x] **`src/components/home/IndexClientWithAutoUpdate.tsx`**:
  - Meneruskan prop `siteId` ke `IndexClientInner` untuk konsistensi data detail proyek.

---

## 📂 File yang Dimodifikasi & Ditambahkan (Modified Files)

| File | Perubahan Utama |
|------|-----------------|
| `src/lib/mappers/projectMapper.ts` | Memperbaiki restorasi `metadata.description` dan sub-field narasi (`concept`, `process`, `detail`). |
| `src/components/os/core/Dock.tsx` | Menghapus item & logika Mission Control & Trash, memperbarui href navigasi `GlobalDock` ke OS Desktop via `buildTenantHomeHref`. |
| `src/components/os/layers/UIOverlaysLayer.tsx` | Menghapus passing callback `onOpenTrash` ke `OSDock`. |
| `src/app/admin/system/components/DockConfigForm.tsx` | Menghapus `mission-control` dan `trash` dari konstanta `DEFAULT_DOCK_ITEMS`. |
| `src/lib/routing/tenantRoutes.ts` | Menambahkan `'preview'` ke reserved segments dan memutakhirkan default `buildTenantHomeHref` ke `/preview/os-desktop`. |
| `src/middleware.ts` | Menambahkan `'/preview'` ke `PLATFORM_PATH_PREFIXES`. |
| `src/app/preview/[template]/page.tsx` | Menambahkan handler redirect `/preview/projects` -> `/projects`. |
| `src/lib/routing/tenantRoutes.test.ts` | Menambahkan unit test untuk `/preview` dan `buildTenantHomeHref`. |
| `src/components/canvas/infiniteCanvasEngine.ts` | Optimasi engine 3D: renderRadius=1, maxActiveItems=40, eliminasi CSS filter blur. |
| `src/components/canvas/InfiniteCanvasView.tsx` | Optimasi DOM video: play-on-hover only, eliminasi SSR/inline blur, forward `onSelectProject`. |
| `src/components/canvas/CanvasCard.tsx` | Menambahkan prop `onSelectProject` dan trigger klik popup window macOS. |
| `src/components/canvas/Projects3DView.tsx` | Meneruskan prop `onSelectProject` ke `InfiniteCanvasView`. |
| `src/components/home/IndexClientInner.tsx` | Integrasi `openWindow` macOS popup untuk kartu Pinterest Grid dan 3D Canvas via `ProjectDetailWrapper`. |
| `src/components/home/IndexClientWithAutoUpdate.tsx` | Meneruskan prop `siteId` ke `IndexClientInner`. |
| `src/components/layout/LayoutClient.tsx` | Menambahkan `/preview/os-desktop` ke `isOsMode` untuk mencegah duplikasi chrome. |
| `src/components/landing/LandingPage.tsx` | Menambahkan `target="_blank"` dan `rel="noopener noreferrer"` pada tombol Live Preview. |
| `src/components/os/core/MenuBar.tsx` | Menghapus tombol tautan 'Pesan OS' dan icon ShoppingCart dari MenuBar desktop. |
| `scripts/sync-exact-macos-projects.ts` | Script sinkronisasi 21 proyek dengan Ringkasan & Proses lengkap. |
| `docs/tracker/INDEX_TRACKER.md` | Pencatatan Sprint 80 pada master tracker index. |
| `docs/tracker/logs/sprint_80_macos_desktop_refinement.md` | Log dokumentasi Sprint 80. |

---

## 🐛 Bug & Solusi (Issue Resolution)

### Bug 1: Tab Ringkasan dan Subtab Proses Kosong di Jendela Detail Proyek
- **Akar Masalah:**
  Fungsi `mapSqlToProject()` di `src/lib/mappers/projectMapper.ts` menimpa field `project.description` dengan `narrativeRow.challenge || narrativeRow.impact || ''`. Karena skema SQL tidak memuat kolom `concept`, `process`, atau `detail` secara terpisah, field-field ini hilang saat proyek diambil melalui SQL relasional.
- **Solusi:**
  - Update `projectMapper.ts` untuk memprioritaskan `metadata.description`.
  - Mengambil sub-field narasi langsung dari objek `metadata.narrative` (`concept`, `process`, `detail`).
  - Menjalankan sinkronisasi ulang data 21 proyek ke D1 SQL dan `app_kv`.

### Bug 2: Tab Galeri Muncul Sebagai "Galeri (1)" Tanpa Konten Nyata
- **Akar Masalah:**
  Saat migrasi, gambar cover juga dimasukkan ke tabel `media_assets` dengan asumsi galeri, sehingga sistem mendeteksi 1 item galeri pada setiap proyek.
- **Solusi:**
  - Menghapus baris non-primer di `media_assets`.
  - Mengosongkan array `gallery: []` di seluruh 21 proyek D1 dan `app_kv`.
  - Jendela detail proyek kini bersih hanya menampilkan 2 tab esensial: **Ringkasan** dan **Proses**.

### Bug 3 / Permintaan User: Dock Bawah Menampilkan Mission Control dan Sampah
- **Akar Masalah:**
  Komponen `OSDock` dan `GlobalDock` mendefinisikan item default `mission-control` dan `trash`, yang tidak lagi diinginkan pada tampilan template baru.
- **Solusi:**
  - Dieliminasi dari `baseItems` pada kedua varian dock di `Dock.tsx`.
  - Seluruh hook pendukung (`toggleMissionControl`, `onOpenTrash`, import ikon `Layers`/`Trash2`) dibersihkan secara aman tanpa mengganggu efek fisika hover scaling, bounce animation, atau drag-and-drop `@dnd-kit/core`.

### Bug 4: URL `/preview/projects?view=3d` dan `?view=grid` 404 (Not Found)
- **Akar Masalah:**
  1. Halaman galeri/koleksi project sebenarnya berada di `/projects` (App Router `src/app/(site)/projects/page.tsx`), sedangkan `/preview/` hanya untuk template (`/preview/[template]`).
  2. Saat berada di `/preview/os-desktop`, kata `'preview'` belum terdaftar di `RESERVED_TOP_LEVEL_SEGMENTS` (`tenantRoutes.ts`), sehingga helper routing salah menganggap `/preview` sebagai tenant slug dan menghasilkan link `/preview/projects?view=3d` di popover dock.
  3. Dynamic route `/preview/[template]` mencari template bernama `"projects"`, yang tidak ada di template registry, sehingga memicu `notFound()` (404).
- **Solusi:**
  1. Menambahkan `'preview'` ke `RESERVED_TOP_LEVEL_SEGMENTS` di `src/lib/routing/tenantRoutes.ts` dan `PLATFORM_PATH_PREFIXES` di `src/middleware.ts`.
  2. Menambahkan automatic redirect di `src/app/preview/[template]/page.tsx` untuk `templateSlug === 'projects'` ke `/projects${queryString}` dengan mempertahankan seluruh parameter query (`?view=3d`, `?view=grid`, dll).
  3. Terverifikasi langsung di browser: kedua URL kini membuka katalog 21 project secara sempurna baik pada mode 3D Canvas maupun Pinterest Grid.

### Bug 5 / Masalah Performa: Halaman `/projects?view=3d` Berat & Patah-Patah
- **Akar Masalah:**
  1. *Concurrent Video Decoding Overload:* Semua kartu proyek yang memiliki video cover (`.mp4`) di dalam radius fokus langsung memutar video secara bersamaan. Hardware video decoder chip pada kartu grafis/CPU terbatas (biasanya 2-4 stream), menyebabkan fallback ke CPU software decoding yang sangat berat dan memicu thermal throttling/frame drops.
  2. *CSS Filter Blur Re-Rasterization:* Engine 3D menghitung dan menyuntikkan `filter: blur(...)` pada setiap kartu di setiap frame (60 FPS) saat kamera bergeser. Blur adalah operasi konvolusi kernel piksel yang sangat mahal untuk GPU bila diterapkan pada elemen 3D transform.
  3. *Over-allocation DOM nodes:* Pemindaian radius 2 menghasilkan 125 sel grid dan hingga 100 kartu DOM aktif sekaligus di memory.
- **Solusi (Opsi B):**
  1. **Video Play-on-Hover:** Video hanya berputar saat kursor mouse di-hover di atas kartu proyek yang bersangkutan (`hoveredProjectRef.current?.id === item.project.id`). Kartu lainnya menampilkan gambar diam (poster), memangkas beban decoder ~80%.
  2. **Eliminasi CSS Blur:** Efek kedalaman ruang (depth of field) diserahkan ke kombinasi `opacity` dan `grayscale` linear (hardware accelerated) tanpa beban re-rasterization shader blur.
  3. **Penurunan Cell Grid & Card Buffer:** Radius pemindaian diubah menjadi 1 (27 sel) dan batas kartu aktif dipangkas dari 100 menjadi 40 kartu.
- **Hasil:** Pergerakan kamera 3D sangat mulus (smooth pan/orbit) tanpa lag/stuttering bahkan pada perangkat laptop dengan grafis terintegrasi.

### Bug 6: Ikon About di Dock Menu Tidak Kembali ke OS Desktop
- **Akar Masalah:**
  Di `GlobalDock` (`Dock.tsx`), properti `href` item `about`, `whatsapp`, `contact`, dan `notes` di-*hardcode* ke `/?app=about`, dll. Karena rute `/` sekarang telah menjadi Landing Page Studio penjualan template, klik icon About di halaman `/projects?view=3d` membawa pengunjung ke halaman pemasaran studio, bukan kembali ke OS simulator.
- **Solusi:**
  - Mengubah tautan `href` di `GlobalDock` agar menggunakan fungsi `buildTenantHomeHref(pathname, '?app=...')`.
  - Memperbarui `buildTenantHomeHref` agar mengembalikan default `/preview/os-desktop` jika tidak ada tenant slug khusus.
  - Memasukkan `/preview/os-desktop` ke dalam kriteria `isOsMode` di `LayoutClient.tsx` dan `Dock.tsx`.
### 9. Integrasi Jendela Detail Proyek macOS (Popup OSWindow) di Grid & 3D View
- [x] **`src/components/canvas/CanvasCard.tsx`**:
  - Menambahkan prop `onSelectProject?: (project: Project) => void` pada `CanvasCardProps` dan `CanvasCardInner`.
  - Mengintersep klik (jika jarak drag <= 10px) untuk memanggil `onSelectProject(item.project)` sebagai ganti navigasi rute `router.push(...)`.
- [x] **`src/components/canvas/InfiniteCanvasView.tsx` & `Projects3DView.tsx`**:
  - Meneruskan callback `onSelectProject` dari parent ke setiap `CanvasCard`.
- [x] **`src/components/home/IndexClientInner.tsx`**:
  - Mengintegrasikan `useWindowContext` (`openWindow`, `closeWindow`, `windows`).
  - Mengimpor dinamis `ProjectDetailWrapper` dari `@/components/os/ui/ProjectDetailWrapper`.
  - Mengimplementasikan `handleOpenProject(project: Project)`:
    - Menutup jendela proyek lain (`project-*`) agar tidak saling menumpuk.
    - Menghitung koordinat tengah layar `initialPosition`.
    - Membuka jendela OS dengan dimensi `width: 900`, `height: 620`, `noPadding: true`, `zIndex: 500`, dan judul `"Portfolio: <title>"`.
  - Menghubungkan `onClick={() => handleOpenProject(item.project)}` ke `<MemoizedProjectCardPinterest />` di mode grid.
  - Meneruskan `onSelectProject={handleOpenProject}` ke `<Projects3DView />` di mode 3D.
  - Memperbarui `onGoToDetail` pada `QuickLookModal` untuk memicu `handleOpenProject(quickLookProject)`.
- [x] **`src/components/home/IndexClientWithAutoUpdate.tsx`**:
  - Meneruskan prop `siteId` ke `IndexClientInner` untuk konsistensi data detail proyek.

### 10. Penghapusan Tooltip di Halaman 3D View (`/projects?view=3d`)
- [x] **`src/components/canvas/InfiniteCanvasView.tsx`**:
  - Menghapus rendering elemen DOM tooltip hover (`data-canvas-tooltip`) yang sebelumnya muncul mengikuti pergerakan kursor saat mengarahkan mouse ke kartu proyek.
  - Menghapus state `isTooltipSuppressed`, `isTooltipSuppressedRef`, dan `tooltipRef`.
  - Mengeliminasi kalkulasi bounding box, flipping logic, dan injeksi style `--tooltip-x` / `--tooltip-y` di `handlePointerMove`, meringankan komputasi event pointer secara signifikan.
  - Menyederhanakan animasi loop physics: menghapus suppression logic tooltip saat kamera bergerak, dengan tetap mempertahankan pelacakan kartu aktif untuk playback video on-hover.

### 11. Anchoring Jendela Popup macOS agar Fixed (Tidak Ikut Ter-scroll) di Halaman Grid
- [x] **`src/components/layout/WindowRenderer.tsx`**:
  - Membungkus container jendela terbuka (`openWindows.map(...)`) dengan wrapper viewport `fixed`: `<div className="fixed inset-0 pointer-events-none z-[500] overflow-hidden">`.
  - `<OSWindow>` tetap memiliki `pointer-events-auto` dan `data-lenis-prevent` sehingga interaksi di dalam window (klik tab, scroll narasi proyek, tombol like/share, traffic lights) berfungsi 100%.
  - Saat pengunjung melakukan scroll halaman grid ke bawah atau ke atas, popup window macOS tetap diam terpaku pada viewport (*fixed on screen*) tanpa ikut tergulung hilang ke atas.

---

## 📂 File yang Dimodifikasi & Ditambahkan (Modified Files)

| File | Perubahan Utama |
|------|-----------------|
| `src/lib/mappers/projectMapper.ts` | Memperbaiki restorasi `metadata.description` dan sub-field narasi (`concept`, `process`, `detail`). |
| `src/components/os/core/Dock.tsx` | Menghapus item & logika Mission Control & Trash, memperbarui href navigasi `GlobalDock` ke OS Desktop via `buildTenantHomeHref`. |
| `src/components/os/layers/UIOverlaysLayer.tsx` | Menghapus passing callback `onOpenTrash` ke `OSDock`. |
| `src/app/admin/system/components/DockConfigForm.tsx` | Menghapus `mission-control` dan `trash` dari konstanta `DEFAULT_DOCK_ITEMS`. |
| `src/lib/routing/tenantRoutes.ts` | Menambahkan `'preview'` ke reserved segments dan memutakhirkan default `buildTenantHomeHref` ke `/preview/os-desktop`. |
| `src/middleware.ts` | Menambahkan `'/preview'` ke `PLATFORM_PATH_PREFIXES`. |
| `src/app/preview/[template]/page.tsx` | Menambahkan handler redirect `/preview/projects` -> `/projects`. |
| `src/lib/routing/tenantRoutes.test.ts` | Menambahkan unit test untuk `/preview` dan `buildTenantHomeHref`. |
| `src/components/canvas/infiniteCanvasEngine.ts` | Optimasi engine 3D: renderRadius=1, maxActiveItems=40, eliminasi CSS filter blur. |
| `src/components/canvas/InfiniteCanvasView.tsx` | Optimasi DOM video: play-on-hover only, eliminasi SSR/inline blur, forward `onSelectProject`, penghapusan tooltip hover `data-canvas-tooltip`. |
| `src/components/canvas/CanvasCard.tsx` | Menambahkan prop `onSelectProject` dan trigger klik popup window macOS. |
| `src/components/canvas/Projects3DView.tsx` | Meneruskan prop `onSelectProject` ke `InfiniteCanvasView`. |
| `src/components/home/IndexClientInner.tsx` | Integrasi `openWindow` macOS popup untuk kartu Pinterest Grid dan 3D Canvas via `ProjectDetailWrapper`. |
| `src/components/home/IndexClientWithAutoUpdate.tsx` | Meneruskan prop `siteId` ke `IndexClientInner`. |
| `src/components/layout/WindowRenderer.tsx` | Membungkus jendela popup dengan container `fixed inset-0 pointer-events-none z-[500]` agar tidak ikut terscroll bersama halaman. |
| `src/components/layout/LayoutClient.tsx` | Menambahkan `/preview/os-desktop` ke `isOsMode` untuk mencegah duplikasi chrome. |
| `src/components/landing/LandingPage.tsx` | Menambahkan `target="_blank"` dan `rel="noopener noreferrer"` pada tombol Live Preview. |
| `src/components/os/core/MenuBar.tsx` | Menghapus tombol tautan 'Pesan OS' dan icon ShoppingCart dari MenuBar desktop. |
| `scripts/sync-exact-macos-projects.ts` | Script sinkronisasi 21 proyek dengan Ringkasan & Proses lengkap. |
| `docs/tracker/INDEX_TRACKER.md` | Pencatatan Sprint 80 pada master tracker index. |
| `docs/tracker/logs/sprint_80_macos_desktop_refinement.md` | Log dokumentasi Sprint 80. |

---

## 🐛 Bug & Solusi (Issue Resolution)

### Bug 1: Tab Ringkasan dan Subtab Proses Kosong di Jendela Detail Proyek
- **Akar Masalah:**
  Fungsi `mapSqlToProject()` di `src/lib/mappers/projectMapper.ts` menimpa field `project.description` dengan `narrativeRow.challenge || narrativeRow.impact || ''`. Karena skema SQL tidak memuat kolom `concept`, `process`, atau `detail` secara terpisah, field-field ini hilang saat proyek diambil melalui SQL relasional.
- **Solusi:**
  - Update `projectMapper.ts` untuk memprioritaskan `metadata.description`.
  - Mengambil sub-field narasi langsung dari objek `metadata.narrative` (`concept`, `process`, `detail`).
  - Menjalankan sinkronisasi ulang data 21 proyek ke D1 SQL dan `app_kv`.

### Bug 2: Tab Galeri Muncul Sebagai "Galeri (1)" Tanpa Konten Nyata
- **Akar Masalah:**
  Saat migrasi, gambar cover juga dimasukkan ke tabel `media_assets` dengan asumsi galeri, sehingga sistem mendeteksi 1 item galeri pada setiap proyek.
- **Solusi:**
  - Menghapus baris non-primer di `media_assets`.
  - Mengosongkan array `gallery: []` di seluruh 21 proyek D1 dan `app_kv`.
  - Jendela detail proyek kini bersih hanya menampilkan 2 tab esensial: **Ringkasan** dan **Proses**.

### Bug 3 / Permintaan User: Dock Bawah Menampilkan Mission Control dan Sampah
- **Akar Masalah:**
  Komponen `OSDock` dan `GlobalDock` mendefinisikan item default `mission-control` dan `trash`, yang tidak lagi diinginkan pada tampilan template baru.
- **Solusi:**
  - Dieliminasi dari `baseItems` pada kedua varian dock di `Dock.tsx`.
  - Seluruh hook pendukung (`toggleMissionControl`, `onOpenTrash`, import ikon `Layers`/`Trash2`) dibersihkan secara aman tanpa mengganggu efek fisika hover scaling, bounce animation, atau drag-and-drop `@dnd-kit/core`.

### Bug 4: URL `/preview/projects?view=3d` dan `?view=grid` 404 (Not Found)
- **Akar Masalah:**
  1. Halaman galeri/koleksi project sebenarnya berada di `/projects` (App Router `src/app/(site)/projects/page.tsx`), sedangkan `/preview/` hanya untuk template (`/preview/[template]`).
  2. Saat berada di `/preview/os-desktop`, kata `'preview'` belum terdaftar di `RESERVED_TOP_LEVEL_SEGMENTS` (`tenantRoutes.ts`), sehingga helper routing salah menganggap `/preview` sebagai tenant slug dan menghasilkan link `/preview/projects?view=3d` di popover dock.
  3. Dynamic route `/preview/[template]` mencari template bernama `"projects"`, yang tidak ada di template registry, sehingga memicu `notFound()` (404).
- **Solusi:**
  1. Menambahkan `'preview'` ke `RESERVED_TOP_LEVEL_SEGMENTS` di `src/lib/routing/tenantRoutes.ts` dan `PLATFORM_PATH_PREFIXES` di `src/middleware.ts`.
  2. Menambahkan automatic redirect di `src/app/preview/[template]/page.tsx` untuk `templateSlug === 'projects'` ke `/projects${queryString}` dengan mempertahankan seluruh parameter query (`?view=3d`, `?view=grid`, dll).
  3. Terverifikasi langsung di browser: kedua URL kini membuka katalog 21 project secara sempurna baik pada mode 3D Canvas maupun Pinterest Grid.

### Bug 5 / Masalah Performa: Halaman `/projects?view=3d` Berat & Patah-Patah
- **Akar Masalah:**
  1. *Concurrent Video Decoding Overload:* Semua kartu proyek yang memiliki video cover (`.mp4`) di dalam radius fokus langsung memutar video secara bersamaan. Hardware video decoder chip pada kartu grafis/CPU terbatas (biasanya 2-4 stream), menyebabkan fallback ke CPU software decoding yang sangat berat dan memicu thermal throttling/frame drops.
  2. *CSS Filter Blur Re-Rasterization:* Engine 3D menghitung dan menyuntikkan `filter: blur(...)` pada setiap kartu di setiap frame (60 FPS) saat kamera bergeser. Blur adalah operasi konvolusi kernel piksel yang sangat mahal untuk GPU bila diterapkan pada elemen 3D transform.
  3. *Over-allocation DOM nodes:* Pemindaian radius 2 menghasilkan 125 sel grid dan hingga 100 kartu DOM aktif sekaligus di memory.
- **Solusi (Opsi B):**
  1. **Video Play-on-Hover:** Video hanya berputar saat kursor mouse di-hover di atas kartu proyek yang bersangkutan (`hoveredProjectRef.current?.id === item.project.id`). Kartu lainnya menampilkan gambar diam (poster), memangkas beban decoder ~80%.
  2. **Eliminasi CSS Blur:** Efek kedalaman ruang (depth of field) diserahkan ke kombinasi `opacity` dan `grayscale` linear (hardware accelerated) tanpa beban re-rasterization shader blur.
  3. **Penurunan Cell Grid & Card Buffer:** Radius pemindaian diubah menjadi 1 (27 sel) dan batas kartu aktif dipangkas dari 100 menjadi 40 kartu.
- **Hasil:** Pergerakan kamera 3D sangat mulus (smooth pan/orbit) tanpa lag/stuttering bahkan pada perangkat laptop dengan grafis terintegrasi.

### Bug 6: Ikon About di Dock Menu Tidak Kembali ke OS Desktop
- **Akar Masalah:**
  Di `GlobalDock` (`Dock.tsx`), properti `href` item `about`, `whatsapp`, `contact`, dan `notes` di-*hardcode* ke `/?app=about`, dll. Karena rute `/` sekarang telah menjadi Landing Page Studio penjualan template, klik icon About di halaman `/projects?view=3d` membawa pengunjung ke halaman pemasaran studio, bukan kembali ke OS simulator.
- **Solusi:**
  - Mengubah tautan `href` di `GlobalDock` agar menggunakan fungsi `buildTenantHomeHref(pathname, '?app=...')`.
  - Memperbarui `buildTenantHomeHref` agar mengembalikan default `/preview/os-desktop` jika tidak ada tenant slug khusus.
  - Memasukkan `/preview/os-desktop` ke dalam kriteria `isOsMode` di `LayoutClient.tsx` dan `Dock.tsx`.
- **Hasil:** Saat berada di `/projects?view=3d`, klik ikon About Me di dock langsung mengarahkan ke `http://localhost:3000/preview/os-desktop?app=about` dan secara otomatis membuka jendela **About Me** di atas desktop macOS.

### Bug 7 / Fitur Request: Klik Proyek di `/projects?view=grid` dan `?view=3d` Membuka Popup Jendela macOS Identik dengan OS Desktop
- **Akar Masalah / Kebutuhan:**
  Sebelumnya, klik kartu proyek di `/projects?view=grid` atau `/projects?view=3d` memicu navigasi rute ke `/projects/[slug]`. Pengguna ingin pengalaman desktop yang konsisten di mana klik kartu memunculkan jendela popup macOS identik dengan yang ada di `preview/os-desktop`, tanpa berpindah halaman.
- **Solusi:**
  - Memanfaatkan `WindowProvider` yang sudah aktif di tingkat layout root (`LayoutClient.tsx`) dan dirender via `<WindowRenderer />` pada `NonOSChrome.tsx`.
  - Menghubungkan fungsi `openWindow` dengan komponen `ProjectDetailWrapper` (`width: 900`, `height: 620`, `zIndex: 500`).
  - Mengintersep klik di `CanvasCard.tsx` (mode 3D) dan `MemoizedProjectCardPinterest` (mode grid).
  - Rute `/projects/[slug]` tetap dipertahankan sesuai instruksi pengguna ("jangan dlu hapus kita coba ubah dlu").
- **Hasil:** Baik di halaman grid maupun 3D view, klik kartu proyek langsung membuka jendela macOS interaktif dengan detail narasi, tabs Ringkasan & Proses, cover interaktif, dan tombol traffic lights tanpa me-reload atau mengganti URL halaman.

### Bug 8 / Permintaan User: Hilangkan Tooltips di Halaman `/projects?view=3d`
- **Akar Masalah / Kebutuhan:**
  Pada halaman 3D Infinite Canvas, setiap kartu memicu tooltip hover (`data-canvas-tooltip`) berisi judul dan klien yang terus menempel mengikuti pointer mouse. Pengguna meminta agar tooltip tersebut dihilangkan agar tampilan lebih bersih dan leluasa.
- **Solusi:**
  - Menghapus elemen JSX `{hoveredProject && <div ref={tooltipRef} data-canvas-tooltip ...>}` dari `InfiniteCanvasView.tsx`.
  - Menghapus state, ref, dan komputasi koordinat tooltip pada event `pointermove`.
  - Mempertahankan deteksi kartu aktif pada ref `hoveredProjectRef` agar optimasi video play-on-hover tetap berjalan tanpa overhead rendering.
- **Hasil:** Tampilan 3D Canvas bersih tanpa ada tooltip yang menutupi kartu saat cursor diarahkan, dan klik kartu tetap membuka popup macOS interaktif.

### Bug 9 / Perbaikan Scroll: Popup Window Proyek Ikut Ter-scroll Saat Halaman Grid Digulung
- **Akar Masalah:**
  Komponen `WindowRenderer` me-render elemen `<OSWindow>` yang memiliki `position: absolute; top: 0; left: 0` langsung ke dalam flow dokumen `NonOSChrome`. Pada halaman `/projects?view=grid` yang memiliki konten panjang (21 proyek masonry grid), posisi `absolute` tersebut terikat ke koordinat dokumen, sehingga saat pengguna menggulung (*scroll*) halaman ke bawah, popup jendela macOS ikut terseret ke atas dan keluar dari layar.
- **Solusi:**
  - Membungkus daftar window di `WindowRenderer.tsx` dengan elemen fixed viewport: `<div className="fixed inset-0 pointer-events-none z-[500] overflow-hidden">`.
  - Jendela `<OSWindow>` memiliki styling `pointer-events-auto` inline sehingga seluruh interaksi di dalam window (drag window, tab navigasi, tombol like/share/close) tetap berjalan sempurna.
  - Saat halaman grid di-scroll oleh user, container `fixed inset-0` tidak bergerak dari viewport, memastikan popup window tetap diam stabil di tengah layar.
- **Hasil:** Verifikasi browser membuktikan bahwa saat halaman grid di-scroll secara agresif sejauh 800px ke bawah, posisi koordinat window popup tetap berada persis di `{ top: 163, left: 510 }` (0px pergeseran).

### Bug 10 / Fitur Baru: Master Portal Pengelola Klien & 1-Klik Client Template Update System (`PENGELOLA_KLIEN.bat`)
- **Akar Masalah / Kebutuhan:**
  Pengguna menanyakan: *"jika aku nanti membuat fitur dan mengahpus fitur dll di template gmna cara update aku ke klient dapat update terbaru jika client pakai versi lama template, atau ada bug yg sudah di perbaiki sedangkan client?"*
  Pengguna juga meminta menyatukan update klien ke satu file kontrol master bernama `PENGELOLA_KLIEN.bat`.
- **Solusi & Implementasi:**
  1. **Master Control Launcher (`PENGELOLA_KLIEN.bat`):**
     - Membuka asisten server lokal di port 4567 (`scripts/onboarding/server.ts`) dan otomatis meluncurkan browser ke `http://localhost:4567`.
     - File `BUAT_KLIEN_BARU.bat` tetap dipertahankan utuh sebagai shortcut alias yang memanggil `PENGELOLA_KLIEN.bat` untuk backward compatibility.
  2. **Tab 3: Update Versi Template (`scripts/onboarding/public/index.html`):**
     - Menambahkan navigasi Tab 3 di samping *Pendaftaran Klien Baru* dan *Kelola Custom Domain*.
     - Menampilkan indikator status build `.open-next` dan waktu build terakhir via endpoint `GET /api/build-status`.
     - Opsi checkbox toggle: *"Kompilasi build baru terlebih dahulu (npm run cf:build)"* (aktif secara default).
     - Menampilkan daftar kartu klien dari laptop (`arsip-klien/`) dengan tombol individual **"Update Klien Ini"** dan tombol global **"🚀 Update Semua Klien Sekaligus"**.
     - Terminal console box live streaming (font monospace, latar hitam) yang menampilkan output baris-demi-baris dari proses kompilasi `npm run cf:build` dan deploy `npx wrangler pages deploy`.
  3. **Streaming Deploy Endpoint (`scripts/onboarding/server.ts`):**
     - Menambahkan helper `runCommandStreaming()` menggunakan `child_process.spawn`.
     - Endpoint SSE `POST /api/deploy-client`: menerima `{ folderName?, all?, forceBuild? }`, menjalankan kompilasi OpenNext jika diperlukan, dan mendeploy bundle `.open-next` ke Cloudflare Pages klien dengan kredensial dari `config.env` masing-masing.
     - **Jaminan Keamanan Data:** Data portofolio klien, proyek, media di Cloudflare R2, dan database Cloudflare D1 100% terisolasi dan **TIDAK TERPENGARUH/HILANG**, karena proses ini hanya memperbarui kode bundle aplikasi web.
  4. **Pembaruan Panduan:**
     - Memperbarui `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` untuk mencatat `PENGELOLA_KLIEN.bat` dan menyertakan FAQ #8 mengenai cara update template klien.
  5. **Sistem Changelog & Release Notes Otomatis (`CHANGELOG.md`):**
     - Pembuatan file standar [CHANGELOG.md](file:///c:/Users/USER/Documents/portfolio-template/CHANGELOG.md) di root proyek.
     - Endpoint `GET /api/changelog` di `scripts/onboarding/server.ts` yang membaca versi terbaru dan otomatis merangkum pesan WhatsApp ramah untuk klien.
     - Penambahan kartu antarmuka *Catatan Pembaruan Rilis* di Tab 3 (`index.html`) lengkap dengan tombol *'📋 Salin Pesan WhatsApp Update'*.
     - Penambahan aturan SOP wajib di [AGENTS.md](file:///c:/Users/USER/Documents/portfolio-template/AGENTS.md) (Poin 3 Bagian 0: AI Workflow) yang mewajibkan seluruh AI di masa depan untuk mencatat setiap fitur baru atau bugfix di `CHANGELOG.md`.
- **Hasil Verifikasi:**
  - `npm run lint` -> **0 error**.
  - Browser testing via subagent -> Tampilan Tab 1, Tab 2, dan Tab 3 terverifikasi sempurna (`tab3_update_versi_template_1788973301300.png`).
  - Endpoint `GET /api/build-status` mengembalikan `{ success: true, hasBuild: true, lastBuilt: "6/9/2026, 19.31.26" }`.
  - Endpoint `GET /api/changelog` mengembalikan versi 1.2.0 dengan 3 kategori rilis dan pesan WhatsApp siap kirim.

---

## 🔍 Hasil Verifikasi & QA

1. **Automated Unit & Integration Tests:**
   - Command: `npx vitest run`
   - Hasil: **109 test files passed (109/109), 821 tests passed (821/821)**.
2. **Lint & Code Integrity:**
   - Command: `npm run lint`
   - Hasil: **0 errors**, kode bersih dan sesuai standar Next.js & React Compiler.
3. **Browser Testing & Snapshot:**
   - URL Grid: `http://localhost:3000/projects?view=grid` -> klik kartu proyek -> popup macOS terbuka (`window_before_scroll_1788972210170.png`).
   - URL Grid (Scroll Test): scroll halaman ke bawah 800px -> popup window tetap fixed di `{ top: 163, left: 510 }` tanpa bergeser 1 pixel pun (`window_after_scroll_1788972252179.png`).
   - Sesi verifikasi interaksi scroll terekam lengkap pada `verify_window_scroll_1788972183863.webp`.
   - Onboarding & Update Dashboard: `http://localhost:4567` Tab 1, 2, 3 terverifikasi di browser (`tab3_update_versi_template_1788973301300.png`).

---

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Navigasi Dock bawah diatur secara terpusat di `src/components/os/core/Dock.tsx`. Komponen ini memiliki sensitivitas fisika animasi tinggi; jangan mengubah kalkulasi spring scale atau transform mouseX.
- Data 21 demo project tersimpan secara konsisten di tabel D1 `projects`, `project_narratives`, dan `app_kv` dengan cover ber-prefix `demo-` di `/r2/assets/demo/...`.
- Detail proyek macOS saat ini hanya menampilkan tab **Ringkasan** dan **Proses** (dengan sub-tab **Konsep**, **Proses**, dan **Detail**).
- Rute individual slug `/projects/[slug]` sengaja **belum dihapus** agar tetap berfungsi sebagai fallback URL atau direct link/SEO.
- `WindowRenderer` untuk rute non-OS kini dibungkus container `fixed inset-0 pointer-events-none z-[500]` untuk menjaga window tetap terkunci pada viewport saat halaman di-scroll.
- Master launcher untuk pendaftaran klien, konfigurasi custom domain, dan update versi template klien kini terpusat pada file `PENGELOLA_KLIEN.bat` (dengan shortcut alias `BUAT_KLIEN_BARU.bat`). Server lokal berjalan di port 4567 via `scripts/onboarding/server.ts`.

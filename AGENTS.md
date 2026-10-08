# AGENTS.md - AI Coding Agent Guide

> **Panduan Teknis & Arsitektur Utama untuk AI Coding Agent**  
> Dokumen ini mencerminkan kondisi riil repositori `portfolio-shared` saat ini. Seluruh AI yang bekerja di repositori ini **wajib** mematuhi panduan dan batasan di bawah ini tanpa pengecualian.

---

## 0. AI Workflow & Tracker System (MANDATORY)

> **Aturan Kerja Ponytail (AKTIF — mode "lazy senior dev", wajib di semua tugas mulai 2026-09-26):**
> Sebelum menulis kode, berhenti di tangga pertama yang berlaku: (1) perlu dibuat sama sekali? (2) sudah ada di codebase ini? pakai ulang. (3) ada di stdlib? (4) fitur native platform? (5) dependency yang sudah terpasang? (6) bisa satu baris? (7) baru tulis kode sesedikit mungkin yang bekerja.
> DILARANG: abstraksi yang tidak diminta, dependency baru tanpa perlu, boilerplate, overthinking. Bug fix = akar masalah (cek semua caller). TIDAK boleh dimalas: memahami masalah (baca & trace dulu), validasi input, keamanan, aksesibilitas, anti-halusinasi — setiap klaim hasil wajib angka/file terverifikasi. Perubahan logika yang sudah ada → laporkan dulu ke owner, minta izin, baru eksekusi.
> (Sumber ruleset: DietrichGebert/ponytail — sama dengan `~/.cursor/rules/ponytail.mdc`.)


Sistem dokumentasi pelacakan pekerjaan (Tracker) telah diaktifkan untuk menghemat penggunaan token (*context window*) AI di repositori ini.

1. **MANDATORY READ (Saat Sesi Baru):**
   Setiap AI **wajib** mengawali sesi dengan membaca file [INDEX_TRACKER.md](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/INDEX_TRACKER.md). Jangan membaca dokumen panjang sebelum membaca index. AI harus langsung membaca file log spesifik yang dirujuk oleh index.
   Untuk pekerjaan yang menyentuh env, integrasi eksternal, AI provider, contact, atau data pribadi, baca juga `docs/agent-context/09_PRODUCT_BOUNDARY_CONTEXT.md` dan `docs/product-boundary/env-inventory.md`.
   
2. **MANDATORY WRITE (Saat Pekerjaan Selesai / Handoff):**
   Setiap AI yang menyelesaikan task, memperbaiki bug, atau meninggalkan pekerjaan yang belum selesai (handoff) **wajib** memperbarui file log yang relevan di `docs/tracker/logs/`. Tambahkan daftar file yang dimodifikasi dan bug yang diperbaiki.

3. **MANDATORY CHANGELOG (Saat Ada Fitur Baru / Bugfix Template):**
   Setiap AI yang menambah fitur baru, mengoptimasi performa, atau memperbaiki bug pada template **wajib** menambahkan catatan versi baru di baris paling atas [CHANGELOG.md](file:///c:/Users/USER/Documents/portfolio-template/CHANGELOG.md). Catatan ini otomatis dibaca oleh portal `PENGELOLA_KLIEN.bat` di browser untuk ditampilkan kepada owner dan dirangkum menjadi pesan WhatsApp serah terima update ke klien.

---

## 1. Ringkasan Proyek & Arsitektur

**portfolio-shared** adalah **Portfolio OS Template** dengan model **Managed Service**: owner deploy template + CRUD ke akun Cloudflare customer. Pengalaman utama berupa desktop simulator bergaya macOS: pengunjung langsung masuk ke desktop interaktif dengan window system, dock aplikasi, wallpaper dinamis, efek audio, notifikasi Dynamic Island, dan antarmuka obrolan/testimoni bergaya aplikasi pesan.

### Arsitektur Managed Service (Current — Sprint 75+)

```
┌─────────────────────────────────────────────────┐
│  OWNER (kita)                                   │
│  - Deploy template ke akun Cloudflare customer  │
│  - Setup awal: portal PENGELOLA_KLIEN.bat       │
│  - Maintenance: Wrangler CLI                    │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  CUSTOMER (1 Cloudflare account)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ D1 DB    │  │ R2 Bucket│  │ Workers  │      │
│  │(10 tabel)│  │ (media)  │  │ (deploy) │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  Admin Panel: /admin (macOS desktop style)       │
│  Onboarding: portal PENGELOLA_KLIEN.bat          │
└─────────────────────────────────────────────────┘
```

**Konsep Kunci:**
- 1 customer = 1 Cloudflare account → 1 D1 + 1 R2 + 1 deployment
- **SITE_ID** hardcoded per deployment (`CUSTOMER_SITE_ID` env var)
- Tidak ada multi-site resolution — setiap D1 hanya berisi data 1 customer
- Auth pakai `jose` (Edge-compatible), cookie `site_user_token`
- Konten legacy (about, skills, dll) disimpan di tabel `app_kv` (key-value JSON)
- Customer login: `/admin/login` → email + password (kredensial ada di `arsip-klien/<slug>/config.env`)
- Onboarding: portal `PENGELOLA_KLIEN.bat` (`localhost:4567`) men-seed row `site` + admin user di D1 klien, lalu klien isi konten sendiri lewat `/admin`
- `/setup` hanya jalur manual lama — bukan bagian alur normal; `POST /api/setup` membalas **400** kalau admin sudah ada

### Keputusan Produk Terkunci (Wajib Diikuti)

- Target arsitektur adalah **full Cloudflare**, bukan Vercel: Cloudflare Pages/Workers untuk aplikasi/API, Cloudflare D1 untuk data relasional, dan Cloudflare R2 untuk media.
- Jangan merancang fitur baru dengan asumsi Vercel project, Vercel Functions, atau quota Vercel. Referensi Vercel yang masih ada di repo adalah legacy/migration debt sampai dibersihkan.
- Model produk adalah **managed service**: 1 customer = 1 Cloudflare account, bukan multi-tenant single platform.
- Customer self-service admin panel untuk kelola konten (projects, profile, experience, skills, contact, testimonials).
- Owner deploy + maintain via Wrangler CLI, bukan via dashboard web.

### Karakteristik Utama

- **Bahasa Utama:** Bahasa Indonesia dengan kamus bahasa Inggris di `src/dictionaries/`.
- **Framework:** Next.js 16.2.x + React 19 dengan React Compiler diaktifkan.
- **Rendering:** Server Components secara default; Client Components digunakan untuk area dengan interaksi berat.
- **Styling:** Tailwind CSS + CSS variables + utility helper `clsx` / `tailwind-merge`.
- **Deployment Target:** Cloudflare Pages/Workers (target migrasi full Cloudflare).
- **Middleware Entry:** Diatur melalui `src/middleware.ts` Edge-style untuk kompatibilitas OpenNext Cloudflare. Jangan mengembalikan ke `src/proxy.ts` karena OpenNext Cloudflare menolak Node.js middleware/proxy.
- **Database & Media:** Cloudflare D1 sebagai database relasional utama dan Cloudflare R2 sebagai media bucket storage.

---

## 2. Struktur Proyek Aktif

```text
src/
|-- app/                    # App Router routes & API routes
|   |-- @modal/
|   |-- about/
|   |-- (site)/             # Route group untuk homepage & public routes
|   |-- admin/              # Panel administrasi
|   |-- api/                # Endpoint API (32 direktori)
|   |-- lab/                # Eksperimen (saat ini kosong)
|   |-- sw.js/              # Service worker
|   |-- error.tsx
|   |-- fonts.ts            # Definisi font
|   |-- globals.css         # Entry CSS global
|   |-- layout.tsx
|   |-- loading.tsx
|   `-- middleware.ts       # Edge request interception pipeline (Cloudflare/OpenNext entry point)
|-- components/
|   |-- admin/              # Komponen khusus halaman admin
|   |-- canvas/             # Tampilan 3D / infinite canvas / project view
|   |-- chat/               # Komponen obrolan / messaging
|   |-- error/
|   |-- features/
|   |-- home/
|   |-- layout/             # MasonryGrid, SmoothScroll, dll.
|   |-- os/                 # Implementasi utama desktop environment
|   |-- projects/
|   |-- shared/             # PerformanceMonitor, dll.
|   `-- ui/                 # Reusable UI components
|-- constants/              # Data konstan statis (misal: skillIcons.tsx)
|-- contexts/               # Root-level React Context Providers (6 file)
|-- data/                   # Fallback data JSON dan statis seed
|-- dictionaries/           # Kamus lokalisasi multi-bahasa
|-- hooks/                  # Custom React hooks umum (window size, event listeners, dll.)
|-- lib/                    # Core library, services, & utilities
|-- middleware/             # Sub-middleware untuk auth, csrf, dll.
|-- types/                  # Definisi tipe TypeScript granular (tanpa barrel file)
|-- utils/                  # Helper utilitas general (cropImage, dll.)
```

### Detail Desktop Simulator (`src/components/os/`)

- **`context/`**: State global desktop (`OSSystemContext`, `DesktopWindowContext`, `UnifiedZIndexContext`).
- **`core/`**: Komponen utama shell desktop (`DesktopEnvironment`, `Dock`, `MenuBar`, `Spotlight`).
- **`hooks/`**: Custom hooks visual simulator (`useWindowManager`, `useSystemSound`, `useQuickLook`, dan folder `window-manager/`).
- **`layers/`**: Lapisan UI (`DesktopIconsLayer`, `UIOverlaysLayer`, `UnifiedLayer`).
- **`sections/`**: Konten tab About (`AboutTab`, `CVTab`, `InterestsTab`, `PhilosophyTab`).
- **`windows/`**: Komponen window simulator (`Window`, `ChatWindow`, `ContactWindow`, `ExplorerWindow`, dll.).

---

## 3. Batasan Refaktorisasi (Refactoring Restrictions)

> [!IMPORTANT]
> Daftar ini diperbarui 2026-09-12 setelah audit penuh 24 file terlarang (Sprint refactor v1.2.9–v1.3.0, konsensus dua AI, setiap baris dibaca dan diverifikasi). Klaim lama yang usang (stale) sudah dikoreksi: `AdminExplorerClient` sudah tidak memakai dnd-kit (tabel click-driven), `DesignPhilosophyForm` sudah tidak memakai React Hook Form/Zod (plain `useState`), `upload/route.ts` sudah tidak menjalankan Sharp (`optimizeImageBuffer` = passthrough stub sejak migrasi Cloudflare), dan `ExitIntentFeedback` mendeteksi kursor via hook `useExitIntent` eksternal.

### 3a. Protected Cores — HARAM dipecah/direfaktor (8 inti)

| # | File Path | Inti yang Terproteksi |
|---|---|---|
| P1 | `src/components/os/hooks/useJellyDrag.ts` | Mesin fisika spring rAF 60 FPS dengan in-place mutation (anti-GC). Loop + idle detection + cleanup = satu unit. Ekstraksi constants/helpers murni (`jellyPhysics.ts`) diizinkan. |
| P2 | `src/contexts/BackgroundUploadContext.tsx` | `enqueueWallpaperUpload` + `compressChainRef`/`finalizeChainRef`/`encodingTaskIdRef` — mesin race-condition atomik (serialisasi WASM FFmpeg + read-modify-write koleksi wallpaper). Ekstraksi types/constants/session-effects diizinkan. |
| P3 | `src/components/canvas/InfiniteCanvasView.tsx` | rAF render loop + `updateDomNodes`/`syncVisibleItems`/`flushRemovals` membaca-tulis ~15 refs bersama per frame. Optimasi Sprint 85 sudah file-structure-independent. Dedup fade-math JSX vs `computeVisualStyle` diizinkan. |
| P4 | `src/components/os/context/UnifiedZIndexContext.tsx` | Store `useSyncExternalStore` (`_subscribe*`/`_get*` = kontrak publik) + interplay `normalizeZIndexes`→`notifyId`/`notifyGlobal`/`updateTopId`. Ekstraksi types/constants + `hooks.ts` tipis diizinkan. |
| P5 | `src/components/os/utils/SoundManager.ts` | Singleton: gating unlock/autoplay, suppression timers, `inFlight`, startup-once, pending queue. Ekstraksi constants/types + `AudioElementPool` diizinkan. |
| P6 | `src/contexts/MusicPlayerContext.tsx` | Dual-engine (HTMLAudio + YT iframe) — `ytPlayerRef` + 4 ref lain dianyam di 25+ lokasi (transport, polling 500ms, volume sync, onReady). Ekstraksi types + pure helpers (`mergeTrackQueue`, `isYt`) diizinkan; ekstraksi `useYouTubePlayer` DILARANG. |
| P7 | `src/lib/services/explorerService.ts` | `explorerMutationChain` + CAS retry 8x + copy/verify/rollback R2. Ekstraksi pure path/name/tree helpers (`explorerKeys.ts`) diizinkan; rantai mutasi harus satu modul. |
| P8 | `src/components/os/windows/Window.tsx` | Sisa 773 baris = frame binding rapat (`preSnapFrameRef`, onDrag→onDragEnd ordering, snap priority, originRect morph). Ekstraksi constants block + builder state animasi diizinkan; `useWindowSnap` hanya dengan persetujuan eksplisit. |

### 3b. Core Dock & Upload Queue — sudah dimodularisasi (v1.3.0), jaga intinya

| File | Status & Batasan |
|---|---|
| `src/components/os/core/Dock.tsx` | Core tetap satu unit: `mouseX` sharing, popover timing chain (suppress 1000ms, `data-dock-popover-closing`), dnd persist admin/visitor, `isClientHydrated`. Jangan pecah lagi. `DockItem`/`GlobalDock`/`OSDock` sudah file terpisah (props-driven). |
| `src/app/admin/projects/explorer/hooks/useExplorerUploadQueue.ts` | Satu-satunya rumah `compressChainRef` (serialisasi WASM FFmpeg) + register/rollback — jangan pisahkan compress chain dari closure ini. |

### 3c. File stabil lainnya — defer, jangan jadi target refactor

| File | Catatan Terverifikasi |
|---|---|
| `src/components/os/context/OSSystemContext.tsx` (226 baris) | Sudah 3 slice internal independen; aman dipecah tapi YAGNI. |
| `src/components/canvas/infiniteCanvasEngine.ts` (417 baris) | Murni matematika, zero runtime imports, unit-tested. BUKAN bagian render loop (loop ada di `InfiniteCanvasView`). Tidak perlu dipecah. |
| `src/components/os/hooks/window-manager/useWindowActions.ts` | Sudah sub-hook dari folder `window-manager/` (pola dekomposisi established). |
| `src/components/os/utils/positionSync.ts` | **Wajib tetap jadi barrel di path ini** — 3 dynamic import menarget path module (`useWindowPersistence.ts:148`, `useStickyNotes.ts:~400`, `useDesktopLayout.ts:137`). Jangan rename/move. |
| `src/lib/database.ts` | Keep `D1Reference` + `D1Database` + Proxy `db` satu modul. Helpers/snapshot/interfaces boleh diekstrak. |
| `src/components/os/core/DesktopEnvironment.tsx` | Defer: entrance-timing chain + visitor-session refs. Ekstraksi `useVisitorSession`/`useDesktopEntranceSequence` hanya dengan persetujuan eksplisit. |
| `src/app/api/admin/login/route.ts` | Helper (`parseUserAgent`, `getGeoInfo`, `auditLogin`) boleh diekstrak; masalah Node-compat ada di import graph (`jsonwebtoken`/`crypto`), bukan struktur file — jangan digabur jadi migrasi jose. |
| File sisa (Window/WallpaperManager/ExplorerWindow/useStickyNotes/useProjectForm/MusicPlayerContext/ExitIntentFeedback) | Lihat tabel 3a/3b dan tracker log refactor untuk batasan per-bagian. |

---

## 4. Technology Stack & Dependencies

### Core Stack

- **Next.js:** `^16.2.6` (App Router, Edge `middleware.ts`, React Compiler enabled).
- **React:** `^19.2.1` (React 19).
- **TypeScript:** `^5.4.5` (`strict: true`, target `ES2017`).
- **Tailwind CSS:** `^3.4.7` (Utility-first styling).

### Pustaka Penting (Dependencies Key)

- **Animasi:** `motion` (`^12.38.0`), `lottie-react`.
- **Navigasi & Scroll:** `lenis`, `@dnd-kit/core` (drag and drop), `next-view-transitions` (`^0.3.5`).
- **State / Fetching:** `@tanstack/react-query`, `swr`.
- **Ikon:** `lucide-react`, `@tabler/icons-react`.
- **Visual 3D:** `three`, `@react-three/fiber`, `@react-three/drei`.
- **Media Processing:** `sharp`, `@ffmpeg/ffmpeg` (WASM), `react-easy-crop`.
- **Format Dokumen:** `html-to-image`, `jspdf`, `jspdf-autotable`, `qrcode.react`.
- **Validasi & Utilitas:** `zod`, `date-fns`, `uuid`, `fuse.js`, `jsonwebtoken`, `jose`.

---

## 5. Keputusan Desain & Konvensi Kode (Design Decisions)

### Efek Visual Desktop

- **Background blur dan scale** hanya diaktifkan untuk window dengan ID yang diawali dengan `project-*` (diatur di `DesktopEnvironment.tsx`).
- Window utilitas biasa (Chat, Contact, About, Mac Folder, Spotlight) **sengaja tidak** memicu efek blur agar interaksi terasa ringan dan tidak membebangi rendering browser.

### Arsitektur D1 Database Path Semantics

- `db.ref(path)` memparse pemisah `/` sebagai objek bersarang (_nested object_) dalam baris tabel `content`.
- `db.ref('content/about').set(x)` menulis ke **tabel `content` dengan kolom field `about = x`**.
- `getD1Value('content/about')` mencari baris dengan key literal `"content/about"`.
- **Aturan:** Jangan mencampur penggunaan layanan content domain (berbasis `db.ref`) dengan helper mentah `getD1Value` / `setD1Value` pada path yang sama untuk menghindari ketidaksesuaian data. Untuk migrasi baris usang, gunakan:
  ```bash
  npx tsx scripts/cloudflare/migrate-legacy-content-rows.ts --apply
  ```

### Konvensi File Media R2 (Side-Car Files)

Setiap pengunggahan video akan menghasilkan tiga file terpisah di bucket R2:

1. `<base>.mp4` — Berkas video utama (dirujuk di D1).
2. `<base>-preview.mp4` — Preview clip (tidak dirujuk langsung di D1, diskip pada wallpaper).
3. `<base>.jpg` — Gambar poster preview (dirujuk langsung di database melalui kolom `posterUrl` pada wallpaper).

> [!WARNING]
> Script pembersihan orphan media (`audit-orphan-*`) dan dashboard status storage telah disesuaikan agar mengenali file side-car ini sebagai referensi valid. Jangan pernah menghapus file pendamping ini secara manual karena akan merusak poster video dan klip preview di client.

---

## 6. Wallpaper & Media Processing Pipeline

### Alur Pengunggahan Wallpaper

1. **Direct-to-R2 (Default):** Melalui `BackgroundUploadContext`. Berkas video berukuran besar dikompresi langsung di sisi client menggunakan WASM FFmpeg sebelum diunggah langsung ke Cloudflare R2 menggunakan _presigned URL_ / Worker upload endpoint agar tidak melewati batas payload runtime aplikasi.
2. **FormData Fallback (`/api/upload`):** Digunakan untuk file kecil (gambar < 30 MB, audio < 25 MB, dan video kecil < 60 MB) seperti gambar poster JPG pendamping.

### Profil Kompresi WASM FFmpeg (Client & Server)

- **Preset Client WASM:** Ditetapkan ke `fast` untuk mengoptimalkan durasi pemrosesan pada thread tunggal di browser.
- **GOP (Group of Pictures):** Ditetapkan ke `60` secara eksplisit guna menghindari efek macroblocking saat video wallpaper diputar berulang (_looping_).
- **CRF (Constant Rate Factor):** Di-tune khusus untuk motion graphics (`CRF=18` untuk kualitas High, `CRF=20` untuk Ultra, dan `CRF=24` untuk Standard).

### Alur Pengiriman & Bandwidth Cloudflare

Target akhir full Cloudflare: media public disajikan melalui Cloudflare Worker/R2 binding atau domain R2 yang dikontrol, dengan path selalu scoped ke `sites/{siteId}/...`.

- Header cache jangka panjang tetap wajib untuk aset immutable agar tidak memboroskan request Worker/R2.
- Route Next/Vercel-style seperti `/api/r2/[...key]` yang masih ada dianggap kompatibilitas sementara sampai migrasi Cloudflare selesai.

---

## 7. State Management & Contexts

### Root Contexts (`src/contexts/`)

- **`LastUpdatedContext`**: Menyimpan timestamp pembaruan database untuk sinkronisasi real-time.
- **`ModalContext`**: Mengatur penayangan modal dialog global.
- **`NavbarVisibilityContext`**: Mengendalikan tampilan menubar atas.
- **`ToastContext`**: Mengelola antrean notifikasi toast.
- **`WindowContext`**: Manajemen status pembukaan dan minimasi jendela OS simulator.
- **`BackgroundUploadContext`**: Antrean kompresi dan unggahan video background di sisi admin.

### OS-Level Contexts (`src/components/os/`)

- **`DesktopWindowContext`**: Registry window OS yang aktif dibuka.
- **`UnifiedZIndexContext`**: Mengelola stack urutan visual window menggunakan selector-based subscription (`useZIndexFor(id)` untuk leaf component, `useUnifiedZIndex()` untuk global layer).
- **`OSSystemContext`**: State sistem global (volume, kecerahan layar, status notes, spotlight search).
- **`LayoutPersistenceContext`**: Menyimpan koordinasi posisi window ke local storage.

---

## 8. Skema Keamanan & Validasi (Security Notes)

### Otentikasi Admin

- Otentikasi admin diamankan menggunakan token JWT (`admin_token`) yang disimpan dalam cookie terenkripsi HTTP-only.
- Filter otentikasi diatur di `src/middleware.ts` dan dievaluasi kembali di file middleware (`src/middleware/auth.ts`).

### Proteksi CSRF

- Setiap request mutasi data (`POST`, `PUT`, `DELETE`) wajib menyertakan header CSRF token yang divalidasi lewat fungsi `checkCSRF()` (`src/middleware/csrf.ts`).
- Sinkronisasi token CSRF antar tab admin dilakukan secara real-time melalui BroadcastChannel (`src/lib/security/client-csrf.ts`).

### Rate Limiting

- Proteksi brute force dikendalikan secara persisten menggunakan database Cloudflare D1 sebagai pencatat rate limit (`src/lib/dataRateLimit.ts`).
- Sistem fallback menggunakan cache memory lokal jika koneksi ke database D1 terputus atau saat menjalankan unit testing.

---

## 9. Perintah Pengembangan & Pengujian

### Perintah Utama (Package Scripts)

```bash
# Inisialisasi Environment Pengembangan
npm run dev               # Menjalankan dev server template
npm run fresh-start       # Menghapus cache build .next lalu menjalankan dev server
npm run ultra-fresh       # Pembersihan cache mendalam lalu menjalankan dev server

# Produksi & Deployment
npm run build             # Membangun aplikasi produksi Next.js
npm run build:clean       # Menghapus cache build Next secara paksa sebelum membangun kembali
npm run start             # Menjalankan aplikasi produksi hasil build secara lokal
npm run pre-deploy        # Verifikasi integritas proyek (lint, types, audit)
npm run deploy            # Workflow deployment lengkap (pre-deploy + build)

# Unit Testing & E2E
npm test                  # Menjalankan unit testing via Vitest
npm run test:watch        # Menjalankan unit testing interaktif (watch mode)
npm run test:coverage     # Menghasilkan laporan cakupan kode (coverage report)
npm run test:e2e          # Menjalankan E2E testing via Playwright (headless)
npm run test:e2e:ui       # Membuka dashboard interaktif Playwright E2E UI

# Browser Automation & Local UI Testing (Global Utility)
# agent-browser sudah terinstall secara global untuk screenshot, snapshot, & browser testing.
# Contoh penggunaan:
# agent-browser open http://localhost:3000
# agent-browser snapshot
# agent-browser screenshot


# Pemeliharaan & Pembersihan
npm run lint              # Mengecek kualitas kode menggunakan ESLint 9 Flat Config
npm run clear-cache       # Menghapus direktori cache build .next secara aman
npm run fix-webpack       # Memperbaiki error Webpack cache failure yang sering muncul
npm run ultra-clean       # Menghapus node_modules dan cache secara keseluruhan
npm run audit             # Audit integritas basis data, relasi data, dan file
```

### Integrasi Eksternal Produk

Repo ini berasal dari portfolio tunggal pribadi, tetapi integrasi personal lama sudah dihapus dari template. Untuk produk, notifikasi harus dibangun ulang sebagai provider generic berbasis `FEATURE_NOTIFICATIONS`, quota, dan `site_id`.

---

## 10. Konfigurasi Environment & Batasan Quota Cloudflare

### Konfigurasi Environment Variables (`.env.local`)

Lihat berkas `.env.example` sebagai referensi utama. Beberapa variabel penting meliputi:

- `CLOUDFLARE_D1_DATABASE_ID` & `CLOUDFLARE_D1_API_TOKEN`: Kredensial database Cloudflare D1.
- `CLOUDFLARE_R2_BUCKET` & `CLOUDFLARE_R2_PUBLIC_BASE_URL`: Kredensial media bucket Cloudflare R2.
- `JWT_SECRET` & `PASSWORD_SALT`: Digunakan untuk enkripsi token otentikasi.
- `FEATURE_AI`, `FEATURE_NOTIFICATIONS`, `FEATURE_CUSTOM_DOMAIN`, `FEATURE_ANALYTICS`: Feature gate produk (lihat `.env.example`). `FEATURE_CLIENT_DASHBOARD` dan `FEATURE_MASTER_DASHBOARD` **sudah dihapus dari kode** — tidak ada lagi panel master untuk membuat/mengelola banyak site dari dalam admin.
- `AI_PROVIDER` & `AI_API_KEY`: Provider AI generic jika `FEATURE_AI=true`.
- `NOTIFICATION_PROVIDER` & `NOTIFICATION_API_KEY`: Provider notifikasi generic jika `FEATURE_NOTIFICATIONS=true`.
- `NEXT_PUBLIC_DEV_VITALS`: PenampilCore Web Vitals melayang di pojok halaman (khusus development).

### Penyesuaian Penghematan Quota Cloudflare

Guna menjaga agar aplikasi tidak boros request Worker/D1/R2, interval panggilan asinkron di-tune sebagai berikut:

- **`useChatSync` (Polling Obrolan):** Ditetapkan ke **8 detik saat aktif / 60 detik saat background**.
- **`useRealtimeSync` (Polling Versi Data):** Ditetapkan ke **30 detik** (mengurangi konsumsi request D1).
- **Transformasi Gambar:** Tag `<Image>` Next.js dikonfigurasi menggunakan transform WebP/AVIF dengan cache jangka panjang. Gunakan atribut `unoptimized` jika gambar berasal dari API eksternal yang sudah teroptimasi.

---

## 11. Workflow Operasional & Pemeliharaan

### Menambah Halaman Baru

1. Buat direktori route di `src/app/<route>/page.tsx`.
2. Jika butuh visual desktop, daftarkan route baru di komponen UI terkait.
3. Daftarkan tautan di `src/app/sitemap.ts` agar di-indeks mesin pencari.

### Menambah Endpoint API Baru

1. Buat berkas route baru di `src/app/api/<nama-endpoint>/route.ts`.
2. Gunakan helper dari `src/lib/api-response.ts` untuk format respon seragam.
3. Jika merupakan endpoint mutasi data, daftarkan path tersebut ke array pengecekan CSRF dan authorization di `src/middleware/constants.ts`.

### Audit dan Sinkronisasi Media R2 dengan Database D1

Admin status popout pada menubar desktop membandingkan jumlah item media di R2 dengan referensi di database D1 secara dinamis (menggunakan endpoint `/api/admin/storage-stats`). Jika terdeteksi ketidakcocokan data, jalankan perintah CLI pemeliharaan di bawah ini:

```bash
# Menampilkan laporan audit ketidakcocokan media wallpaper
npx tsx scripts/cloudflare/audit-orphan-wallpapers.ts

# Menghapus berkas media wallpaper di R2 yang tidak memiliki referensi di D1
npx tsx scripts/cloudflare/audit-orphan-wallpapers.ts --delete-orphans --yes

# Menghapus baris referensi wallpaper di D1 yang berkas R2-nya telah hilang
npx tsx scripts/cloudflare/clear-dangling-wallpapers.ts --yes

# Melakukan backfill URL poster untuk data wallpaper lama (one-time migration)
npx tsx scripts/cloudflare/backfill-wallpaper-poster-urls.ts --apply
```

> [!CAUTION]
> Operasi audit hapus media bersifat destruktif dan tidak memiliki alur undo bawaan. Selalu jalankan perintah di atas tanpa flag `--delete-orphans` terlebih dahulu untuk mempelajari daftar berkas sebelum melakukan penghapusan massal. Script pemeliharaan memiliki safety guard bawaan yang akan menolak penghapusan otomatis jika jumlah berkas yatim (orphan ratio) terdeteksi melebihi 20%.

---

## 12. Customer CRUD Architecture (Managed Service)

> **Wajib dibaca AI yang mengerjakan fitur customer-facing, admin panel, atau deploy pipeline.**

### Auth System

| Komponen | Detail |
|---|---|
| **Library** | `jose` (Edge-compatible, bukan `jsonwebtoken`) |
| **Cookie** | `site_user_token` (HTTP-only, secure, 2h TTL) |
| **CSRF** | Double-submit cookie pattern (`csrf_token` + `x-csrf-token` header) |
| **Endpoints** | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/check-auth` |
| **Middleware** | `src/middleware/customer-auth.ts` — JWT verify + sliding refresh |
| **Guard** | `requireAuth()`, `requireAdmin()` di `src/crud/shared/auth/guard.ts` |

### SITE_ID Configuration

```typescript
// src/crud/shared/config.ts
export const SITE_ID = process.env.CUSTOMER_SITE_ID || 'default-site';
```

- Hardcoded per deployment, tidak ada multi-site resolution
- Digunakan di: `siteRequestContext.ts`, `projectSiteContext.ts`, `siteMutationAuth.ts`
- Setiap D1 hanya berisi data 1 customer

### D1 Schema

Ada **dua** berkas DDL yang hidup berdampingan — jangan tertukar:

> **Invarian (audit 2026-10-08, temuan #1/#14):** portal onboarding menjalankan
> **kedua** daftar berurutan — `SHARED_SCHEMA_QUERIES` dulu, lalu `D1_SCHEMA_QUERIES`
> (CREATE IF NOT EXISTS; daftar kedua otomatis skip tabel yang sudah ada). Karena itu
> **kolom 4 tabel bersama (`sites`, `projects`, `media_assets`, `audit_logs`) wajib
> selaras antar kedua berkas** — khususnya kolom yang dibaca runtime `projectSqlService`:
> `projects.order_index`, `projects.cover_media_id`, `media_assets.sort_order`,
> `media_assets.alt_text`, `media_assets.updated_at`, plus tabel `project_narratives`
> (wajib ada di SHARED). Self-heal `src/lib/cloudflareD1.ts` menambahkan kolom tersebut
> lewat ALTER ter-guard untuk database lama. Kalau menambah kolom ke tabel bersama,
> tambahkan di **kedua** berkas.

**1. Skema runtime customer — `src/crud/shared/db/schema.ts` (`SHARED_SCHEMA_QUERIES`, 11 tabel).**
Dipasang portal onboarding ke D1 milik klien (`scripts/onboarding/server.ts`, `scripts/onboarding/cloud-manager.ts` — disusul `D1_SCHEMA_QUERIES`), lalu diverifikasi hasilnya sebelum lanjut, dan dibuat ulang saat runtime lewat `src/crud/shared/db/connection.ts`.

| # | Tabel | Fungsi |
|---|---|---|
| 1 | `sites` | Informasi site (id, slug, name, status, active_template_key) |
| 2 | `site_users` | Login credentials (email, password_hash, role) |
| 3 | `projects` | Data project portfolio |
| 3b | `project_narratives` | Studi kasus per project (challenge/solution/impact) — dibaca runtime |
| 4 | `media_assets` | Referensi file di R2 |
| 5 | `site_settings` | Pengaturan site (key-value) |
| 6 | `audit_logs` | Jejak aktivitas |
| 7 | `rate_limits` | Proteksi brute force |
| 8 | `app_kv` | Key-value store untuk konten legacy |
| 9 | `portfolio_templates` | Katalog template (diisi oleh `seedDeployment()`) |
| 10 | `site_template_entitlements` | Hak pakai template per site (diisi oleh `seedDeployment()`) |

**2. Skema bootstrap produk — `src/lib/d1-schema.ts` (`D1_SCHEMA_QUERIES`, 12 tabel).**
Dipakai `npm run cf:bootstrap` (`scripts/cloudflare/product-bootstrap.ts`), backup/restore (`scripts/cloudflare/backup-d1.ts`, `restore-d1.ts`), readiness gate, **dan dipasang portal setelah skema #1** (lihat invarian di atas). Empat namanya sama dengan skema di atas (`sites`, `projects`, `media_assets`, `audit_logs`) tapi definisi kolomnya berbeda, plus 8 tabel lain: `site_quota_overrides`, `project_narratives`, `submissions`, `ai_generations`, `orders`, `site_custom_domains`, `site_analytics`, `platform_settings` (skema ini tidak punya `site_users`, `site_settings`, `rate_limits`, `app_kv`, `portfolio_templates`, `site_template_entitlements`).

> Tidak ada kolom `plan`/tier di tabel `sites` — paket Lite/Pro sudah dihapus (v1.3.15); harga tunggal Rp199.000.

### Content Storage (app_kv)

Konten legacy disimpan sebagai JSON string di tabel `app_kv`:
- `about` — headline, description, bio
- `experience` — array experience items
- `skills` — array skill categories
- `contact` — email, phone, location
- `testimonials` — array testimonials
- `interests` — array interests
- `philosophy` — quote, principles

**Penting:** Jangan campur penggunaan `db.ref(path)` (content service) dengan `getD1Value(key)` (raw helper) pada path yang sama.

### Setup Flow

**Alur normal tidak memakai `/setup`.** Onboarding lewat portal `PENGELOLA_KLIEN.bat` → `localhost:4567` (`npm run client:new` → `scripts/onboarding/server.ts`):

```
1. Owner daftarkan klien baru di portal: Gmail klien + Account ID & API Token
   dari akun Cloudflare MILIK KLIEN (disimpan di arsip-klien/<slug>/config.env)
2. STEP 1-3: verifikasi kredensial → buat database D1 + bucket R2 di akun klien
3. STEP 4: pasang skema tabel (`SHARED_SCHEMA_QUERIES` **lalu**
   `D1_SCHEMA_QUERIES`) → seed row `site` (active_template_key sesuai pilihan
   template) dan admin user (scrypt), semua lewat binding parameter — lalu
   **verifikasi** tabel & baris benar-benar tersimpan sebelum lanjut
   (audit 2026-10-08, temuan #1/#2/#5)
4. STEP 5: arsipkan kredensial & dokumen ke arsip-klien/<slug>/ (config.env
   berisi ADMIN_EMAIL + ADMIN_PASSWORD)
5. Build + deploy per klien lewat `deployClient()`
   (`scripts/onboarding/client-deploy.ts`, dipanggil portal STEP 5):
   env build di-inject dari config.env (override 13 kunci, reset kunci owner,
   generate JWT_SECRET/PASSWORD_SALT per klien), lalu `npx wrangler deploy
   --config .open-next/wrangler.client.<slug>.jsonc` ke akun klien
6. Klien login https://<slug>.workers.dev/admin/login (atau custom domain)
   lalu mengisi isi situsnya sendiri lewat /admin (kredensial dari config.env)
```

**Jalur manual lama `/setup`** (bukan bagian alur normal):

```
1. POST /api/setup → seedDeployment()  (src/crud/shared/db/seed.ts)
   → Create site row di D1
   → Seed katalog template + entitlement default
   → Create admin user (scrypt password)
2. Endpoint MENOLAK dengan 400 "Setup sudah selesai. Admin user sudah ada."
   begitu ada admin (src/app/api/setup/route.ts:64-69, 96-99) — jadi /setup
   sudah mati pada deployment yang sudah di-onboarding portal.
3. Reset password klien bukan lewat /setup: owner jalankan
   scripts/cloudflare/reset-customer-password.ts
```

### Deploy Pipeline

Deploy per klien ditangani `deployClient()` di `scripts/onboarding/client-deploy.ts` (dipanggil portal `server.ts` STEP 5 dan CLI `cloud-manager.ts`), **bukan** `wrangler pages deploy` lagi:

```bash
# 1. Build dengan env klien (arsip-klien/<slug>/config.env) — 3 lapis:
#    a. proses build: override 13 kunci dari config.env, reset 21 kunci owner
#       jadi '' (buildClientEnvPlan), generate JWT_SECRET/PASSWORD_SALT per klien
#    b. artefak runtime: .open-next/cloudflare/next-env.mjs ditulis ulang
#    c. config wrangler: .open-next/wrangler.client.<slug>.jsonc (vars
#       CUSTOMER_SITE_ID + KV namespace klien, tanpa binding milik owner)
# 2. Deploy Worker per klien (bukan Pages) ke akun klien:
npx wrangler deploy --config .open-next/wrangler.client.<slug>.jsonc
#    env: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN dari config.env

# Customer akses: https://<slug>.workers.dev (atau custom domain)
# Customer login: https://<slug>.workers.dev/admin/login
```

> Kenapa berubah (v1.3.20): `wrangler pages deploy` lama **tidak memasang env D1/R2 per klien** → semua deployment klien memakai database owner (celah audit 2026-10-04). Lihat `docs/tracker/logs/patch_celah_env_klien_2026_10_04.md`.
> `scripts/deploy/build-customer.sh` dan `scripts/deploy/deploy-customer.sh` (sisa jalur lama, tidak dipanggil kode mana pun) **sudah dihapus** pada audit 2026-10-08.

### Admin UI Zones (4 Zones)

| Zone | Apps |
|---|---|
| **Konten & Berkas** | Projects, Profile, Experience, Skills, Archive, Labels, Explorer, Event Pages |
| **Sistem** | AI, Analytics, Activity Log, Backup, Harga Jual, Orders |
| **Tampilan** | Appearance, Dock, Widgets, Sounds |
| **Komunikasi** | Notifications, Messages, Feedback, Contacts |

> Zone "Sistem & Tampilan" lama (10 app) dipecah jadi **Sistem** + **Tampilan** pada 2026-10-09 atas keputusan owner (3 → 4 zone); definisi zona = data di `src/app/admin/desktop/registry.ts` (`ADMIN_ZONES`).

> Zone "Manajemen Sistem & Klien" (clientDashboard, paymentConfig, orders) sudah dihapus sepenuhnya (registry bersih + berkas panel `ClientDashboardPanel`/`PaymentConfigPanel` dihapus pada v1.3.20; panel `OrdersPanel` dihapus lalu **dibuat ulang** di v1.3.29 sebagai app "Pesanan" — `/admin/system/orders`). Endpoint `orders` tetap hidup (dipakai panel Pesanan, script load-test, support-playbook); endpoint `payment-config` **sudah dihapus total** 2026-10-09 (route + fungsi service `getAdminPaymentConfig`/`updatePaymentConfig` — nol pemanggil, billing baca `paymentConfigService` langsung, bukan lewat API); endpoint `sites` tetap hidup untuk tooling.

### Test Mock Pattern

Saat menulis test untuk routes yang pakai auth:

```typescript
// Mock shared core auth
vi.mock('@/lib/admin/siteMutationAuth', () => ({
  validateSiteMutationRequest: validateSiteMutationRequestMock,
}));

// In beforeEach
validateSiteMutationRequestMock.mockResolvedValue({ role: 'admin' });

// For unauthenticated test
validateSiteMutationRequestMock.mockResolvedValue(null);
```

---

## 13. Troubleshooting & Resolusi Masalah Umum

### Kegagalan Cache Webpack / Next Build

Jika Next.js mengalami error cache kompilasi atau kegagalan modul Webpack, jalankan:

```bash
npm run clear-cache
npm run fix-webpack
```

### Konflik Port Dev Server

Jika port `3000` atau `3100` terdeteksi sedang digunakan oleh proses latar belakang yang menggantung, jalankan perintah ini di shell CLI:

```bash
npx kill-port 3000
npx kill-port 3100
```

### Penanganan Deprecations & Security Overrides

Guna mengunci dependency yang rentan, pastikan kolom `overrides` di file `package.json` tetap terjaga untuk modul-modul berikut:

```json
"overrides": {
  "@tootallnate/once": "^3.0.1",
  "fast-xml-parser": "^5.5.9",
  "flatted": "^3.3.3",
  "undici": "^7.5.0",
  "next": {
    "postcss": "^8.5.14"
  }
}
```

---

_Terakhir Diperbarui: 2026-09-01_
_Tingkat Kepercayaan Informasi: Terverifikasi Penuh oleh Pengujian Unit & Sistem_

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

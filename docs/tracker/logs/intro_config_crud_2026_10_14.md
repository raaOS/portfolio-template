# Log #160 — CRUD "Intro Animasi": Pilih Loader Pembuka per Template + Fix Cacat Logika Intro (v1.3.42)

- **Tanggal:** 2026-10-14
- **Versi:** 1.3.42
- **Status:** ✅ Selesai (gerbang: `tsc --noEmit` 0, ESLint 0 error, unit test **131 file / 1055 test PASS** — +12 test baru dari baseline 1043)

## Permintaan Owner

1. "Loader/booting animasi kan ada 2 sekarang, masing-masing template (ada 3 template demo) — apa CRUD loader bisa menentukan template mana pakai loader apa?"
2. Diikuti audit kejujuran ("yakin gak lagi tidak cacat logika?") yang menemukan **3 cacat logika nyata** di kode intro (C1–C3) + 1 kelemahan rencana (C2) → owner menyetujui eksekusi rencana versi yang sudah diperbaiki: CRUD pilih animasi per template, dipakai klien di `/admin`, storage blob `about`.

## Kondisi Sebelum (fakta yang diverifikasi dengan membaca kode)

- Mapping template→loader **hardcode**: os-desktop → `StartScreen` (HELLO hitam, latar putih); infinite-canvas & spatial-gallery → `HelloIntro` (HELLO oranye, latar hitam, `ready={sceneReady}` di spatial). Penentunya ada di `page.tsx:82-89`, `preview/[template]/page.tsx:100-116`, dan pemanggilan loader di tiap renderer.
- **Tidak ada CRUD loader**: nol field loader/intro di `updateAboutSchema`; panel Tampilan cuma Wallpaper/Ikon/Objek 3D; satu-satunya penulis `active_template_key` = portal onboarding.
- **C1 (cacat):** `HelloIntro` tanpa safety fallback → (a) chunk `lottie-react` gagal = layar hitam permanen `z-[200]`; (b) `ready` tak pernah `true` (WebGL gagal → `onReady` scene tak pernah fire; atau `canvasReady` menunggu idle-callback **20 detik** di `SpatialGalleryRenderer.tsx:87`) = **HELLO loop selamanya**.
- **C2 (cacat):** `PUT /api/about` → `revalidateSiteContentPaths(siteId, ['/', '/about'])` — `/preview/*` tidak direvalidate → demo preview basi ≤ ISR 60 dtk.
- **C3 (dicatat, tidak diubah):** satu-satunya `soundManager.play('startup')` ada di `StartScreen.tsx` jalur klik/keyboard (skip manual); jalur normal `onComplete` → `playSound:false` (senyap). `powerOn`/`skipBoot` di `useBootSequence` sempat dead export.
- Yang **aman** (diverifikasi, tidak diubah): guard double-start StartScreen (`hasStartedRef`), cleanup timer/rAF, rantai data `about`→renderer (`dataMapper.ts:56` meneruskan seluruh `about`; `DesktopEnvironment` sudah baca `aboutData.soundConfig` & merender `StartScreen` di scope sama), jalur `wasBootSkipped` untuk reveal.

## Perubahan

### 1. Kontrak data (blob `about`)

- `src/types/about.ts`: tipe baru `IntroStyle` (`'hello-black' | 'hello-orange' | 'none'`), `IntroTemplateKey`, `IntroConfig` (Partial<Record>); field `introConfig?` ditambahkan ke `AboutData` **dan** `UpdateAboutData` (interface manual, bukan zod-infer).
- `src/lib/validations/adminCrud.ts`: `introStyleSchema` (enum) + `introConfigSchema` (object key literal per template, `.strict()`) → `updateAboutSchema.introConfig?`. Typo key/nilai = 400.
- `src/lib/services/aboutService.ts`: merge `introConfig` di `updateAboutData` — pola **replace-per-map** (sama seperti `spatialGalleryConfig`).

### 2. Konsumsi renderer

- `src/components/shared/HelloIntro.tsx`: prop `style` (`hello-orange` default | `hello-black`) menukar JSON lottie + latar (hitam/putih); **jaring pengaman absolut `SAFETY_HIDE_MS = 30000`** (`safetyTriggered` memaksa `leaving` meski `ready` false / sinyal lengkap tak pernah fire; timer hanya di-arm selama belum keluar → tidak dobel fade). Tambah `data-testid`/`data-intro-style` untuk test.
- `src/components/os/ui/StartScreen.tsx`: prop `style` (`hello-black` default | `hello-orange`) menukar JSON + latar; `data-intro-style` ditambahkan. Perilaku boot lama tak tersentuh.
- `src/components/os/core/DesktopEnvironment.tsx` (`DesktopMain`): baca `aboutData.introConfig?.['os-desktop']` (default `hello-black`); `style` diteruskan ke `StartScreen`; **`'none'` → effect memanggil `skipBoot()`** (jalur reveal skipped-boot yang sudah ada, `:527-533`) — boot dilewati penuh tanpa membongkar state machine.
- `InfiniteCanvasRenderer.tsx` / `SpatialGalleryRenderer.tsx`: baca `introConfig` masing-masing (default `hello-orange`); `{introStyle !== 'none' && <HelloIntro style={introStyle} />}` (spatial tetap `ready={sceneReady}`).
- `src/app/api/about/route.ts` (C2): revalidate kini `['/', '/about', '/preview/os-desktop', '/preview/infinite-canvas', '/preview/spatial-gallery']`.

### 3. Panel admin

- **BARU** `src/app/admin/system/components/IntroConfigManager.tsx`: 3 kartu template × 3 radio (HELLO Hitam / HELLO Oranye / Tanpa Intro) + tombol Simpan; selalu mengirim map lengkap 3 key. Tanpa badge "template aktif" — `active_template_key` tidak tersedia di payload `/api/about` (dicatat sebagai penyederhanaan, bukan kelalaian).
- `src/app/admin/system/appearance/page.tsx`: sub-tab ke-4 "Intro Animasi" (ikon PlayCircle, aksen indigo).

### 4. Test (12 baru)

- `src/components/shared/__tests__/HelloIntro.test.tsx` (BARU, 5): fade normal default oranye; varian hitam latar putih; `ready=false` → safety 30 dtk memaksa keluar; tanpa sinyal lottie → safety; jalur normal menyelesaikan timer tanpa dobel fade.
- `StartScreen.test.tsx` (+3): default latar putih + `data-intro-style`; `hello-orange` latar hitam; boot tetap jalan di varian oranye.
- `adminCrud.test.ts` (+4): map lengkap valid; map parsial valid; nilai asing ditolak; key asing (typo) ditolak via `.strict()`.

### 5. Dokumentasi

- `CHANGELOG.md` `[1.3.42]`, `APP_VERSION` 1.3.42 (`src/lib/constants.ts`), entri INDEX #160.

## File yang Dimodifikasi

- `src/types/about.ts`
- `src/lib/validations/adminCrud.ts`
- `src/lib/validations/__tests__/adminCrud.test.ts`
- `src/lib/services/aboutService.ts`
- `src/components/shared/HelloIntro.tsx`
- `src/components/shared/__tests__/HelloIntro.test.tsx` (BARU)
- `src/components/os/ui/StartScreen.tsx`
- `src/components/os/ui/__tests__/StartScreen.test.tsx`
- `src/components/os/core/DesktopEnvironment.tsx`
- `src/components/templates/infinite-canvas/InfiniteCanvasRenderer.tsx`
- `src/components/templates/spatial-gallery/SpatialGalleryRenderer.tsx`
- `src/app/api/about/route.ts`
- `src/app/admin/system/appearance/page.tsx`
- `src/app/admin/system/components/IntroConfigManager.tsx` (BARU)
- `src/lib/constants.ts`, `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md`

## Catatan Verifikasi / Keputusan

- **Default zero-migration:** `introConfig` kosong → os-desktop `hello-black`, dua lainnya `hello-orange` = perilaku persis v1.3.37/1.3.36. Tidak ada data lama yang perlu diubah.
- **Timeout absolut 30 detik** dipilih > idle-timeout 20 detik `SpatialGalleryRenderer` (margin 10 dtk untuk muat GLTF); device ekstrem lambat bisa diputus lebih awal → degradasi wajar (latar intro tetap menutup sampai scene fade-in).
- **`skipBoot()` untuk `'none'`** menandai sessionStorage `portfolio_os_booted` — pengunjung dengan sesi aktif tidak melihat intro lagi sampai sesi baru; konsisten dengan perilaku skip navigasi internal.
- **C3 (suara startup hanya di skip manual)** sengaja TIDAK diubah — kemungkinan disengaja sejak v1.3.37; `powerOn`/`skipBoot` kini kembali dipakai (`skipBoot` oleh fitur `'none'`).
- **ISR tetap 60 detik** untuk perubahan yang tidak lewat `PUT /api/about` (batasan arsitektur, bukan cacat fitur).
- Bundle tiap template kini memuat kedua JSON lottie (hitam + oranye, puluhan KB) — diterima; bisa di-dynamic-import varian kedua bila owner menuntut.

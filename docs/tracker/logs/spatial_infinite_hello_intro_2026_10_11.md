# Log #154 — Intro HELLO Bersama: Spatial-Gallery & Infinite-Canvas Putar Animasi Sampai Selesai (v1.3.36)

- **Tanggal:** 2026-10-11
- **Versi:** 1.3.36
- **Status:** ✅ Selesai, live & terverifikasi

## Permintaan Owner

1. Poster cover awal (v1.3.35) **masih terlihat mengganggu** — hapus poster di awal, ganti dengan animasi lottie HELLO yang sudah ada di template.
2. Di **spatial-gallery** dan **infinite-canvas**, animasi HELLO diputar **sampai selesai satu putaran penuh** dulu, baru transisi menampilkan halaman utama.

## Perubahan

### 1. Komponen baru bersama `src/components/shared/HelloIntro.tsx`

- Layar hitam penuh (`fixed inset-0 z-[200] bg-black`) + animasi lottie **HELLO oranye** (`public/lottie/hello orange.json` — gradient stroke #FF5900, terlihat jelas di latar gelap; varian "hitam" hanya untuk latar terang).
- Durasi satu putaran animasi: **6 detik** (720 frame @ 120 fps).
- Sinyal selesai: `onComplete` / `onLoopComplete` (event lottie-web per putaran) → fade-out **700 ms** → overlay dilepas (`gone`).
- `pointer-events-none`: interaksi tetap tembus ke konten di belakangnya (membantu pemanasan aset 3D spatial selagi intro).
- Prop opsional `ready` (default `true`): pemakai bisa menahan intro sampai konten siap.
- Lottie dimuat via `dynamic(() => import('lottie-react'), { ssr: false })` — pola sama dengan OS Desktop StartScreen & infinite-canvas CanvasControls.

### 2. spatial-gallery (`SpatialGalleryRenderer.tsx`)

- Overlay lottie v1.3.35 diganti `<HelloIntro ready={sceneReady} />`.
- Intro baru memudar setelah **HELLO selesai satu putaran DAN scene 3D siap** → tidak ada layar hitam antara intro → galeri.

### 3. infinite-canvas (`InfiniteCanvasRenderer.tsx`)

- `<HelloIntro />` dipasang sebagai anak pertama root renderer — sebelumnya kanvas langsung tampil tanpa pembuka.

## File yang Dimodifikasi

- `src/components/shared/HelloIntro.tsx` (BARU)
- `src/components/templates/spatial-gallery/SpatialGalleryRenderer.tsx`
- `src/components/templates/infinite-canvas/InfiniteCanvasRenderer.tsx`
- `src/lib/constants.ts` (`APP_VERSION` → 1.3.36)
- `CHANGELOG.md`

## Verifikasi

- tsc 0, eslint 0, unit test **1012/1012 lulus**.
- Deploy hijau: Version ID `2a1630d5-f64b-4e53-8090-0969aee60024`; health **1.3.36** + connected.
- Live spatial: overlay intro aktif saat load (opacity 1) → SVG lottie tampil (440×174) → overlay **hilang sendiri** setelah putaran penuh (bukti sinyal completion + fade bekerja) → canvas 3D hidup, galeri tampil; **nol error console**.
- Live infinite-canvas: overlay intro aktif saat load → hilang sendiri setelah animasi selesai; kanvas tampil; **nol error console**.

## Catatan Verifikasi (bukan bug)

- Busy-wait sinkron di harness evaluate **memblokir main thread** → chunk lottie tak sempat dieksekusi selama busy-wait berjalan (artefak metode, sudah dihindari pada pengujian ulang).
- Tab tersembunyi (window minimalkan) menunda `requestAnimationFrame` → animasi lottie membeku selagi tab di latar; browser melanjutkannya saat tab terlihat kembali. Perilaku normal, bukan regresi.

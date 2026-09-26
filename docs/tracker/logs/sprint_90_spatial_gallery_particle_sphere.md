# Sprint 90 — Spatial Gallery Total Rework: Particle Sphere 3D Orbit

**Tanggal:** 2026-09-15
**Status:** 🟢 Completed (tsc 0 error, eslint bersih, runtime QA browser PASS)
**Versi:** v1.3.4

## Latar Belakang

Template `spatial-gallery` lama (orbit artwork ring + camera rig + curved grid) memiliki cacat visual berat yang tidak bisa diperbaiki secara inkremental: 21 aset gambar tumpang tindih, tidak membentuk lingkaran orbit teratur, tidak bisa scroll/putar, dan layout tidak sesuai referensi. Keputusan: **rombak total** mengganti engine scene dengan komponen "Particle Sphere" (basis kode 21st.dev yang di-copy owner, diadaptasi ke stack repo).

## Perubahan

### 1. Engine Baru: `RingGallery.tsx` (replacement total scene lama)

- 1500 partikel debu membentuk bola fibonacci (distribusi merata, `InstancedMesh` — 1 draw call, bukan 1500 mesh).
- Hingga 24 gambar project mengorbit di bidang ekuator (radius 9), menghadap keluar pusat via `Matrix4.lookAt`.
- Auto-rotasi grup Y-axis 0.0005/frame; OrbitControls untuk drag putar + scroll zoom + pan.
- Texture loading per-slot dengan rantai fallback: poster video side-car (`.jpg`/`.webp`) → cover → gallery[0] (via `getVideoPosterCandidates` + `resolveStorageUrl`), tanpa Suspense — aman dari crash saat URL 404, slot gagal tetap tampil sebagai plane warna fallback.
- PRNG deterministik `mulberry32` (seed 1337) menggantikan `Math.random()` — menghilangkan 4 error `react-hooks/purity` React Compiler, sekaligus layout partikel stabil antar render (anti hydration flicker).
- `flipY = false` + `ClampToEdge` + `SRGBColorSpace` + anisotropy 4 sesuai instruksi komponen asli.
- **Rasio aspek asli (owner menolak 1:1):** tinggi plane diseragamkan (`IMAGE_SIZE = 1.4`), lebar = tinggi × aspect ratio asli texture (dibaca dari `t.image.width/height` saat load), di-clamp `ASPECT_MIN 0.5` – `ASPECT_MAX 1.9` agar thumbnail 9:16/panorama ekstrem tidak merusak ritme orbit. Fallback plane 1:1 tampil hanya sebelum texture termuat.

### 2. Renderer Baru: `SpatialGalleryRenderer.tsx`

- Membungkus `RingGallery` dalam `<Canvas>` + `OrbitControls` (pola `demo.tsx`) — memperbaiki runtime error fatal `R3F: Hooks can only be used within the Canvas component!` (hook R3F sebelumnya dipanggil di luar Canvas).
- Overlay minimal: brand site (kiri bawah) + hint interaksi (kanan bawah).

### 3. Penghapusan File Lama (dead code spatial-gallery)

Folder `src/components/templates/spatial-gallery/` dipangkas dari 18 file → 2 file:
- Dihapus: `Scene.tsx`, `components/` (ArtworkOrbit, CameraRig, CentralObject, CurvedGrid, CustomCursor, HoverLabel, LoadingScreen, ModeSwitcher, Navigation, OrbitalSystem, ProjectCounter), `hooks/` (useMouseParallax, useOrbitalProgress, useReducedMotion), `utils/` (orbit.ts).
- Tersisa: `RingGallery.tsx` + `SpatialGalleryRenderer.tsx`.

### 4. Bugfix Parasit: Import Mati `OSDock` (sisa refactor Phase 2)

- `src/components/os/layers/UIOverlaysLayer.tsx:7` masih import `OSDock` dari `'../core/Dock'` padahal refactor Phase 2 (Sprint 109) sudah memindahkannya ke `../core/OSDock`. Warning webpack muncul berulang di tiap Fast Refresh. Fixed → import ke `'../core/OSDock'`. Verifikasi console browser: warning hilang.

## Verifikasi

- `tsc --noEmit`: 0 error pada file terkait (sisa error hanya issue lama `@testing-library/react` di test infinite-canvas, pre-existing, tidak tersentuh).
- `eslint` 3 file berubah: 0 error 0 warning.
- Browser QA (`agent-browser` di `http://localhost:3000/preview/spatial-gallery`): halaman render tanpa crash, overlay tampil, console bersih (hanya deprecation `THREE.Clock` internal three.js).
- Deps `three@0.186` + `@react-three/fiber@9.7` + `@react-three/drei@10.7` sudah ada di package.json (tidak perlu install baru; peer-deps react 19.3 aman via legacy resolution existing).

## File yang Dimodifikasi

| File | Aksi |
|---|---|
| `src/components/templates/spatial-gallery/RingGallery.tsx` | Baru — engine scene Particle Sphere |
| `src/components/templates/spatial-gallery/SpatialGalleryRenderer.tsx` | Rewrite — Canvas + OrbitControls wrapper |
| `src/components/templates/spatial-gallery/Scene.tsx` | Dihapus |
| `src/components/templates/spatial-gallery/components/` (11 file) | Dihapus |
| `src/components/templates/spatial-gallery/hooks/` (3 file) | Dihapus |
| `src/components/templates/spatial-gallery/utils/` (1 file) | Dihapus |
| `src/components/os/layers/UIOverlaysLayer.tsx` | Fix import path `OSDock` |

## Catatan untuk AI Berikutnya

- Jangan kembalikan folder `components/hooks/utils` lama di spatial-gallery — sudah digantikan penuh oleh `RingGallery.tsx`.
- Kalau menambah efek yang butuh `useTexture`/`useFrame`, hook R3F wajib berada DI DALOM `<Canvas>`; untuk loading texture yang failure-tolerant, tiru pola `TextureLoader` + rantai `tryNext` di `RingGallery.tsx` (jangan pakai `useTexture` Suspense bila URL media bisa 404).
- Referensi visual owner: https://k95.it/en (rings) — tapi keputusan final mengikuti instruksi 21st.dev Particle Sphere.

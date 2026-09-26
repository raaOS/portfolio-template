# Sprint 91 — Spatial Gallery Bugfix: Aset DB Tampil Hitam (TextureLoader → useTexture)

**Tanggal:** 2026-09-18
**Status:** 🟢 Completed (fix oleh Gemini + cleanup + QA)
**Versi:** v1.3.5

## Latar Belakang

Setelah Sprint 90 (rombak total engine Particle Sphere), halaman `/preview/spatial-gallery` menampilkan **ring berputar namun semua tile gambar HITAM** — helm 3D dan grid shader tampil normal, tetapi aset gambar dari database D1/R2 tidak muncul sama sekali.

## Diagnosa (Chain Lengkap)

1. **D1 Database OK:** 21 project berstatus `published` di site `default-site`, `metadata_json` berisi `cover`, `gallery`, `galleryItems`.
2. **R2 Proxy OK:** `/r2/assets/demo/projects/*.jpg` di-serve dengan status 200 + header CORS `access-control-allow-origin: *` (dimensi 640×800, file JPEG valid).
3. **Network Browser OK:** `agent-browser network requests` menunjukkan 12+ request tekstur R2 dengan status 200 — gambar ter-download di browser.
4. **Root Cause:** Kode port mengganti `useTexture` (drei, Suspense-based) dari source asli `helmetsrc` dengan manual `TextureLoader.load()` + `useState`. Implementasi manual ini gagal menginisialisasi texture dengan benar di pipeline r3f (color space + timing upload GPU), sehingga semua tile dirender warna fallback gelap (`#333344`) yang tampak hitam di background gelap.

## Perbaikan

### 1. Ganti Manual TextureLoader → `useTexture` (drei)

Kembali ke pola kode asli `helmetsrc` yang terbukti bekerja:

```tsx
// Source asli helmetsrc/FiberScene.tsx (berhasil):
const textures = useTexture(imageUrls)

// Port bermasalah (diganti):
const [textures, setTextures] = useState<Texture[]>([])
// + TextureLoader.load() manual dengan callback signature bermasalah

// Fix akhir (Gemini):
const textures = useTexture(imageUrls) // dari @react-three/drei — suspense-based
```

`useTexture` dari drei menangani color space (`SRGBColorSpace`), caching per-URL, dan upload GPU secara otomatis — persis perilaku source asli yang sukses dengan aset lokal.

### 2. Dukungan Side-Car Poster untuk Proyek Berformat Video (21 Proyek Lengkap)

Sebelumnya, proyek yang memiliki cover `.mp4` (8 dari 21 proyek) langsung di-skip oleh filter regex, sehingga hanya 13 proyek gambar yang masuk ke ring. Kini, menggunakan `getVideoPosterSource()` dan fallback `.replace(/\.(mp4|webm|mov...)$/i, '.jpg')`, proyek video otomatis mengambil gambar poster pendampingnya (`.jpg`). Hasilnya: **seluruh 21 proyek portofolio** tampil lengkap di atas ring silinder 3D.

### 3. Fallback Aset Lokal `/tube/`

Jika database tidak memiliki gambar (semua cover video / gallery kosong), fallback kini menunjuk ke `/tube/im1.jpg`–`im9.jpg` (aset bawaan original `helmetsrc`, disalin ke `public/tube/`).

### 4. Cleanup & Koreksi Orientasi

- Hapus `console.log` debug `[SpatialGallery DEBUG]` yang tertinggal.
- Import `useTexture` kini dari `@react-three/drei` (bersama `useGLTF`).
- Koreksi sudut rotasi `ry = -(theta - Math.PI / 2)` agar gambar menghadap ke arah pengunjung (tidak mirrored/terbalik).

## Verifikasi

- Network browser: 12+ tekstur `/r2/assets/demo/projects/*.jpg` ter-fetch status 200.
- Console browser: tidak ada error texture loading; hanya warning deprecation `THREE.Clock` internal three.js (pre-existing).
- Fallback lokal `/tube/*.jpg` valid (9 file, rata-rata byte 118–132 → bukan gambar hitam).

## File yang Dimodifikasi

| File | Aksi |
|---|---|
| `src/components/templates/spatial-gallery/SpatialGalleryRenderer.tsx` | Fix texture loading (TextureLoader manual → `useTexture` drei), fallback `/tube/`, hapus debug log |

## Catatan untuk AI Berikutnya

- Untuk loading texture 3D di template ini, **gunakan `useTexture` dari drei** (suspense-based) — jangan manual `TextureLoader` + `useState` karena timing upload GPU-nya rawan menghasilkan tile hitam.
- `useTexture` butuh URL yang stabil; bila URL media bisa 404, bungkus dengan try/catch di level pemanggil atau sediakan fallback URL sebelum masuk hook.
- Aset fallback lokal tersimpan di `public/tube/` (9 gambar im1–im9.jpg) — jangan dihapus karena dipakai sebagai fallback bila DB kosong.

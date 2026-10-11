# Spatial Gallery: Poster Awal Loading Diperbaiki — Tidak Lagi Meregang/Crop (v1.3.34, 2026-10-11)

**Status:** ✅ Selesai — live & terverifikasi (harness + screenshot owner), nol error console.
**Perintah owner:** "https://makeitbetter.my.id/preview/spatial-gallery ada bug visual seperti gambar cover saat mulai — perbaiki" (+ screenshot: poster "KING +62" ter-crop aneh meregang fullscreen).

---

## 1. Diagnosis (fakta terverifikasi)

- Yang dilihat owner = **poster LCP** di `SpatialGalleryRenderer.tsx`: `<img>` absolut yang tampil **seketika** saat halaman dibuka (ter-SSR/paint cepat) sampai scene 3D siap, lalu fade-out 0.8s. Poster ini disengaja sejak Sprint LCP fix: tanpanya terukur **layar hitam ±14 detik / NO_FCP** di headless sampai chunk three.js + texture termuat.
- **Bug visual:** poster dipaksa `objectFit: 'cover'` fullscreen — cover potret (640×800) ter-crop aneh di layar landscape (kepala/teks terpotong) → tampak seperti gambar rusak.
- **Bukan regresi baru:** diff `git show 303231e:...SpatialGalleryRenderer.tsx` membuktikan logika poster **100% identik** sebelum rewrite panel v1.3.32 — bug ini sudah ada sejak poster dipasang, baru dilaporkan sekarang.
- File fallback `/tube/im1.jpg` exist (dicek) → bukan masalah gambar rusak.

## 2. Perubahan

| File | Perubahan |
|---|---|
| `SpatialGalleryRenderer.tsx` | 1 baris: `objectFit: 'cover'` → **`'contain'`** pada poster (karya tampil utuh & terpusat, letterbox hitam senada latar galeri). Fungsi LCP + fade-out tetap persis |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.33 → **1.3.34** |
| `CHANGELOG.md` | Entri `[1.3.34]` di baris teratas |

**Tidak disentuh:** `SpatialScene.tsx`, modal, mesin 3D, logika `sceneReady`/lazy-load.

## 3. Verifikasi

| Uji | Hasil |
|---|---|
| `npx tsc --noEmit` / `eslint` | **0 / 0 error** |
| Deploy | **exit 0**, Version ID `7d682225-2a4d-4b53-a0f5-c4ac850bb2b9` |
| `/api/health` | **1.3.34** + `database: connected` |
| Frame awal loading (harness) | `objectFit: contain` terhitung; poster src benar |
| Screenshot owner | Poster "KING +62" tampil **utuh** (termasuk teks bawah), terpusat, letterbox rapi |
| Scene 3D | `hasCanvas: true` — mount & fade-out poster tetap jalan |
| Console (error) | **0 pesan** |

## 4. File yang dimodifikasi

- `src/components/templates/spatial-gallery/SpatialGalleryRenderer.tsx`
- `src/lib/constants.ts`, `CHANGELOG.md`
- `docs/tracker/INDEX_TRACKER.md`, log ini

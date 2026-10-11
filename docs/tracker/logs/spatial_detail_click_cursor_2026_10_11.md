# Spatial Gallery: Klik Tile → Panel Detail (Ringkasan + Proses) & Cursor Terlihat (v1.3.32, 2026-10-11)

**Status:** ✅ Selesai — live & terverifikasi interaktif (klik asli owner + raycast harness), nol error console.
**Perintah owner:** fokus UI/UX Spatial Gallery (baru ±25%): (1) klik cover project → tampilkan ringkasan project berisi gambar/video + proses, mengikuti contoh screenshot (tab Ringkasan/Proses, sub-tab Tantangan/Solusi/Dampak); (2) cursor mouse yang tidak terlihat dibuat terlihat; (3) "kerjakan secara hati tidak merusak logic Spatial Gallery yang sudah dibuat".
**Keputusan desain yang disepakati di tahap plan:** tanpa CRUD/endpoint baru (data sudah lengkap di database), panel bertema gelap khas spatial, cursor kustom diganti native.

---

## 1. Fakta riset sebelum eksekusi

- Tipe `Project` yang dikirim ke renderer sudah memuat semua field yang tampil di contoh: `cover` + `galleryItems` (image|video + poster) + `gallery` legacy, `role`, `timeline`, `team`, `software[]`, `type`, dan `narrative` (challenge/solution/impact — legacy `result`; seni visual: concept/process/detail). Mapper `project_narratives` → `project.narrative` sudah jalan (`projectMapper.ts`); `mapD1ToTemplateData` meneruskan projects utuh. **Jadi penambahan murni lapisan tampilan.**
- Tile tabung 3D (`SpatialScene.tsx`) hanya punya event hover (`onPointerOver/Move/Out`); klik = tambahan mengikuti pola sama.
- Sebelumnya: `cursor: none` + cursor kustom bola putih RAF (±60 baris) — dilaporkan owner tidak terlihat.

## 2. Perubahan (3 file kode + versi/dokumen)

| File | Perubahan |
|---|---|
| **BARU** `SpatialProjectModal.tsx` | Panel detail tema gelap: media utama (gambar/video + thumbnail strip dari cover/galleryItems/gallery, dedupe), chips klien & tahun, meta grid (Peran/Software/Waktu/Tim/Tipe — conditional), "Tentang Proyek", tag; tab **Ringkasan** & **Proses** (sub-tab **Tantangan/Solusi/Dampak** — atau **Konsep/Proses/Detail** untuk `type: visual_art`; field kosong → tab/bagian tidak dirender; dukung legacy `result` sebagai Dampak). Tutup via ✕ / klik luar / Esc |
| `SpatialScene.tsx` | useMemo pembangun texture kini juga membangun `projectIndexes[i]` = index project pemilik `imageUrls[i]` (fallback lokal = array kosong); mesh tile +`onClick` → `onImageClick(projectIndex)` (dengan `stopPropagation`); prop `onImageClick` mengalir renderer → `SpatialCanvas` → `ImageTube` mengikuti pola `onHover*`. **Mesin rotasi/gulir/shader/useFrame tidak disentuh** |
| `SpatialGalleryRenderer.tsx` | State `selectedProject` + `onImageClick`; rotasi tabung pause (target skala kecepatan → 0) selama panel terbuka & restore saat tutup (via ref yang sudah ada); render modal **di luar** container (siblings — wheel/pointer overlay tidak bocor ke tube); **cursor kustom dihapus → cursor native** (`cursor: none` dibuang); tooltip hover, parallax `targetCenterUv`, lazy-load idle 20s, poster LCP tetap utuh |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.31 → **1.3.32** |
| `CHANGELOG.md` | Entri `[1.3.32]` di baris teratas |

## 3. Verifikasi (semua terverifikasi langsung)

| Uji | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npx eslint` (3 file spatial) | **0 error** |
| Deploy `npm run deploy` | **exit 0**, Version ID `7c950f4f-4ece-4f7f-963d-94666329daf2` |
| `/api/health` | **1.3.32** + `database: connected` |
| `/preview/spatial-gallery` & `/` | **200** |
| Klik tile (klik asli owner di browser sendiri) | Panel terbuka — "Identitas Monogram Hijau", chips "Personal Work"/"2025", meta **Peran/Software/Waktu/Tim/Tipe** terisi, "Tentang Proyek" berisi teks narrative asli, media gambar tampil |
| Tab Proses (harness, klik asli via ref) | Sub-tab **Tantangan/Solusi/Dampak** tampil dengan teks dari `project_narratives` |
| Tombol ✕ | Panel tertutup, canvas 3D tetap hidup & berputar |
| Console (error) | **0 pesan** |
| Scene | Tabung berputar normal (screenshot owner — 2 frame berbeda), model 3D tengah utuh |

## 4. Catatan insiden & jujur

- **Dev server tertinggal memblokir deploy pertama:** guard `ensure-next-dev-not-running` menolak build (port 3000 dipegang `npm run dev` yang berjalan sejak 00:02 — kemungkinan ditinggal owner). Dihandle `npx kill-port 3000` (prosedur AGENTS §13), deploy ulang hijau. Kalau owner sedang membuka `localhost:3000`, jalankan ulang `npm run dev` — tapi tutup sebelum deploy berikutnya.
- **Klik sintetis (dispatch event) tidak konsisten** mengenai tile bergerak — bukan bug fitur; klik mouse asli (owner & tool harness) bekerja konsisten. Catatan untuk AI uji masa depan: uji klik tile spatial dengan mouse asli, bukan dispatch sintetis.
- Cursor native terpasang lewat penghapusan `cursor: 'none'`; verifikasi visual terserah penggunaan nyata owner (kodomik: CSS container tidak lagi menyembunyikan cursor).
- Keputusan produk terkait (sebelumnya, terkait laporan owner): **tidak menambah CRUD** ke Spatial — CRUD os-desktop (sticky note/CV/hard-skill) tidak relevan dengan konsep galeri 3D; data case-study yang dibutuhkan tampilan ini sudah ada di CRUD bersama (`/admin/projects`).

## 5. File yang dimodifikasi

- `src/components/templates/spatial-gallery/SpatialProjectModal.tsx` (baru)
- `src/components/templates/spatial-gallery/SpatialGalleryRenderer.tsx`
- `src/components/templates/spatial-gallery/SpatialScene.tsx`
- `src/lib/constants.ts`, `CHANGELOG.md`
- `docs/tracker/INDEX_TRACKER.md`, log ini

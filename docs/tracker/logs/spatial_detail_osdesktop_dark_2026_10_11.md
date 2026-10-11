# Spatial Gallery: Panel Detail Disamakan dengan Template Demo macOS — Mode Gelap (v1.3.33, 2026-10-11)

**Status:** ✅ Selesai — live & terverifikasi interaktif (uji harness + screenshot owner), nol error console.
**Perintah owner:** "untuk tampilan Klik cover project → panel detail bisa gak disamaain dengan yang ada di template demo mac OS tapi dark".
**Prinsip eksekusi:** jangan meniru manual — **pakai komponen yang sama persis** dengan window project OS Desktop, supaya dijamin identik dan otomatis ikut perbaikan OS Desktop berikutnya.

---

## 1. Riset sebelum eksekusi (semua fakta terverifikasi)

- Root `Providers` (`src/components/layout/Providers.tsx`) sudah memuat `LanguageProvider` → komponen OS Desktop yang memakai `useLanguage` aman dipakai di halaman preview mana pun.
- `tailwind.config.ts` → `darkMode: 'class'` → varian `dark:` aktif jika kelas `dark` dipasang di ancestor (dipaksa di root modal).
- Struktur window project OS Desktop (`ProjectDetailTwoColumn` mode `isWindowMode`): kolom kiri 42% (cover via `ProjectCover` + interaction bar) | kolom kanan (header judul serif `ProjectHeader` + `ProjectDetailTabsPane`: nav tab pill geser indigo — Ringkasan/Proses/Galeri + badge jumlah — konten tab: badges+`ProjectMeta`+"Tentang Proyek"; story: `ProjectNarrative` folder-tabs; galeri: `ProjectGallery` + `LightboxGallery`).
- `useProjectDetail` (hook internal komponen) menembak GET `/api/metrics` + `/api/comments` (deferred 1.5s) — **kedua endpoint ada** (`src/app/api/metrics/route.ts`, `src/app/api/comments/route.ts`); pola panggilan sama persis dengan window OS Desktop di produksi (bukan perilaku baru).
- `LightboxGallery` menangani Esc via listener capture-phase (z-[100000]) → Esc modal ditahan saat lightbox terbuka (cek DOM di bubble phase) supaya Esc pertama hanya menutup lightbox.
- Call-site jendela OS (`ProjectDetailWrapper`) = acuan penyusunan `cover`/`gallery`/`ratio` (ratio `coverWidth/coverHeight` fallback 1.77, poster video dari ekstensi `.jpg`).

## 2. Perubahan (satu file kode + versi/dokumen)

| File | Perubahan |
|---|---|
| `SpatialProjectModal.tsx` (tulis ulang) | Modal kini hanya **pembungkus**: overlay gelap + kartu `max-w-6xl` tinggi `min(90vh,900px)` + tombol ✕ chrome window + Esc/klik luar; isi = **`ProjectDetailTwoColumn isWindowMode`** (komponen OS Desktop yang sama). Kelas `dark` dipaksa di root overlay. Cover/gallery disusun pola `ProjectDetailWrapper` dengan `resolveStorageUrl` (pipeline spatial) + poster video otomatis; legacy `gallery: string[]` ikut terdeteksi videonya. Panel sebelumnya (tiruan manual dark kustom ±300 baris) dihapus — diganti ~100 baris pembungkus |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.32 → **1.3.33** |
| `CHANGELOG.md` | Entri `[1.3.33]` di baris teratas |

**Tidak disentuh:** `SpatialScene.tsx`, `SpatialGalleryRenderer.tsx` (props modal `{project,onClose}` tidak berubah), mesin 3D, CRUD, endpoint.

## 3. Verifikasi (semua terverifikasi langsung)

| Uji | Hasil |
|---|---|
| `npx tsc --noEmit` | **0 error** |
| `npx eslint` (modal) | **0 error** |
| `npm test` (unit) | **1012/1012 lulus** (128 file) |
| Deploy `npm run deploy` | **exit 0**, Version ID `9399d89f-617d-42b1-baff-ce8b64c99684` |
| `/api/health` | **1.3.33** + `database: connected` |
| Klik tile di tabung 3D | Panel terbuka — "Komposit Gerbang Neraka" (judul serif), kelas `dark` aktif, ✕ ada, cover media tampil di kolom kiri |
| Tab Ringkasan | Chips "Personal Work"/"2025", meta PERAN/SOFTWARE (ikon Ps)/WAKTU/TIM/TIPE, "TENTANG PROYEK" — **screenshot owner membuktikan identik gaya window macOS dark** |
| Tab Proses | Folder-tabs **Konsep / Dampak** (project seni visual; field kosong otomatis tidak tampil — perilaku `ProjectNarrative`) dengan teks narrative asli — **screenshot owner** |
| Tab Galeri | Otomatis tidak dirender untuk project tanpa galeri (perilaku OS Desktop) |
| Tombol ✕ | Panel tertutup, canvas 3D tetap hidup & berputar |
| Console (error) | **0 pesan** |
| Esc | Tertangani; saat lightbox galeri terbuka, Esc pertama hanya menutup lightbox |

## 4. Catatan

- Tab Galeri + lightbox + interaction bar (suka/bagikan/ulasan/terjemah) ikut otomatis karena memakai komponen bersama — sama persis dengan demo macOS. Endologi metrics/comments memakai `siteId` default sama seperti `ProjectDetailWrapper`.
- Karena komponen dipakai bersama dengan OS Desktop, **perubahan styling OS Desktop berikutnya otomatis terbawa** ke panel spatial — pertahankan pola ini, jangan menyalin file lintas template.
- Uji klik sintetis tetap tidak konsisten pada tile bergerak (catatan v1.3.32) — klik mouse asli owner tetap cara uji valid.

## 5. File yang dimodifikasi

- `src/components/templates/spatial-gallery/SpatialProjectModal.tsx` (tulis ulang)
- `src/lib/constants.ts`, `CHANGELOG.md`
- `docs/tracker/INDEX_TRACKER.md`, log ini

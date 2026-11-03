# Lembaran Hero Diperbesar & Jarak Koridor Dirapatkan (v1.3.76, 2026-10-30)

- **Status:** Completed (perubahan konstanta; verifikasi gerbang dicatat di bagian bawah)
- **Permintaan owner:** *"ukurannya bisa di perbesar gak? dan jarak antar tumpukan di dekatkan? tanpa merusak logicnya tanpa merusak salah klik — ketika kita klik A yang muncul A."*

## Ringkasan

Hero `MagazineShowcase` (koridor lembaran WebGL) memakai lembaran 720×450 design px dengan jarak 0,5× lebar lembaran. Lembaran diperbesar ke **960×600** (rasio 16:10 tetap) dan jaraknya dirapatkan ke **0,26×** lebar lembaran (−31%). **Hanya 6 konstanta yang diubah** — mesin gerak, snap, state fokus, overlay demo live, dan jalur hit-test tidak disentuh.

## Perubahan

| Konstanta | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `DEFAULTS.pageWidth` | 720 | **960** | lembaran di tengah koridor 50% → 67% tinggi viewport |
| `DEFAULTS.pageHeight` | 450 | **600** | rasio 16:10 wajib tetap (overlay live 1440×900) |
| `DEFAULTS.spacing` | 5 | **2** | jarak `0.5×` → `0.26×` lebar lembaran (360 → 250 px basis desain) |
| `DEFAULT_TRAVEL.drift` | 1.2 | **0.62** | jaga ritme ±3,5 dtk/lembaran (`0.26 / (0.12 × 0.62)`) |
| `CELL_MAX` | 1024 | **1536** | sel atlas tidak ter-upscale setelah lembaran diperbesar (3 gambar → atlas 3072², di bawah `ATLAS_MAX` 4096) |
| `PICK_MAX` | 1600 | **2048** | pass pick lebih halus di monitor besar |

## Kenapa hit-test tetap akurat (klik A → A)

- `pick()` me-render ulang scene yang sama dengan `pickMaterial`; material itu memakai **objek uniforms yang sama** (`uniforms: this.material.uniforms`) dan vertex shader yang sama → posisi/ukuran/jarak yang dipakai pick otomatis identik dengan yang terlihat, tidak ada rumus koordinat duplikat yang bisa melenceng.
- Pemilihan tetap berbasis depth buffer (lembaran paling depan yang terlihat), jadi pada area tumpang-tindih yang terpilih adalah lembaran yang benar-benar diketuk.
- Lapisan video preview tetap disembunyikan selama pass pick (perbaikan v1.3.71 — sumber bug "klik A buka B").
- `pageWidth/pageHeight` dipertahankan 16:10 supaya overlay iframe 1440×900 tetap menempel presisi (tidak gepeng/bercelah).

## File diubah

- `src/components/landing/MagazineShowcase.tsx` — 6 konstanta + komentar riwayat penyesuaian #8.
- `src/lib/constants.ts` — `APP_VERSION` `1.3.75` → `1.3.76`.
- `CHANGELOG.md` — entri `[1.3.76]`.
- `docs/tracker/INDEX_TRACKER.md` — entri #178.
- `docs/tracker/logs/fitur_hero_ukuran_jarak_lembaran_2026_10_30.md` — log ini.

## Verifikasi

- **Gerbang:** `tsc --noEmit` **0 error**, `eslint` pada 2 file yang diubah **bersih**, `vitest` (`magazine-showcase.test.tsx` + `constants.test.ts`) **19 test PASS / 2 file**.
- **Visual (dev lokal, 1296×886, WebGL nyata):** lembaran koridor terlihat jelas lebih besar dan lebih rapat dibanding tangkapan layar owner; latar split off-white/biru, navbar, dan pil "geser · ketuk…" tetap utuh (tidak tertutup lembaran).
- **Uji ketuk:** klik sintetis pada koridor membuka demo sesuai lembaran yang diklik — urutan uji menembak `/preview/infinite-canvas`, `/preview/os-desktop`, lalu `/preview/spatial-gallery` (terlihat di log dev server); label header overlay ("Infinite Canvas" dst.) dan `src` iframe berasal dari indeks lembaran yang sama (`images[index % n]`), jadi tidak ada pasangan label/demo yang tertukar. Klik di celah antar lembaran tidak membuka apa pun (perilaku benar, `hit = -1`).
- **Catatan uji:** dev server dijalankan dengan `.env.local` sementara `STOREFRONT=true` (tanpa kredensial D1, sehingga `/preview/*` menampilkan error D1 di dalam iframe — tidak terkait perubahan ini). File itu **sudah dihapus** setelah pengujian; dev server dimatikan.
- **Tidak bisa diverifikasi dari sini:** rasa akhir di produksi (kecepatan drift, ketajaman tekstur pada layar owner) — butuh mata owner setelah deploy.


## Deploy

- **2026-10-30 (WIB):** `npm run deploy` sukses. Pre-deploy lolos (compat audit 0 blocker, tsc 0 error, eslint bersih, **150 file / 1.266 test PASS**), build OpenNext + upload Worker selesai, **Version ID `ad5b6e92-0a30-4632-a173-68d0385af8d4`**.
- **Verifikasi produksi:** `https://makeitbetter.my.id/api/health` → `version 1.3.76`, `database connected` (105 ms), worker-health probe `32/32`. Bundle hero produksi (`/_next/static/chunks/1_yn6bcb-tiul.js`) memuat `pages:20, spacing:2, pageWidth:960, pageHeight:600`, `drift:.62`, dan `Math.min(1536, …)` — nilai lama `1024` sudah tidak ada.
- **Catatan operasional:** dev server lokal (port 3000) dihentikan sebelum deploy karena `ensure-next-dev-not-running` menolak build saat port masih aktif.

## Catatan lanjutan

- `public/landing/spatial-gallery.webp` hanya 3,5 KB (1440×900, sangat flat) — kalau ingin terlihat setajam dua template lain setelah diperbesar, tangkapan layarnya perlu direkam ulang. `os-desktop.webp` 1524×720 (rasio 2,12) sehingga di-letterbox pada lembaran 16:10.
- Kalau mobile terasa terlalu "in your face", opsi berikutnya adalah cap responsif berbasis tinggi viewport (perubahan logika kecil, terpisah dari perubahan ini).

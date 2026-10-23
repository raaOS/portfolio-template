# Tracker Log: Perbaikan Akurasi Klik Lembaran Hero (Pick WebGL Dirusak Lapisan Video) — v1.3.67

**Status:** ✅ Selesai (kode + dokumentasi; gerbang verifikasi di bawah)
**Mulai:** 2026-10-23
**Selesai:** 2026-10-23
**Rujukan terkait:** [log fitur Video Hero (v1.3.49)](fitur_hero_video_preview_crud_admin_2026_10_20.md) — sumber lapisan video yang tak sengaja ikut merusak pick.

## 🎯 Tujuan (Objective)

Keluhan owner (dengan screenshot panggung hero di halaman utama): **"klik template A yang kebuka malah template B/C"** — mengetuk salah satu lembaran di koridor majalah (`MagazineShowcase`) membuka demo template yang salah.

## ✅ Task List

- [x] Telusuri kode hero terbaru (catatan: worktree awal berada di commit lama `a1639ea`; halaman utama saat ini memakai `MagazineShowcase`, BUKAN `LiveStage` — branch dibawa ke `main` v1.3.66 dulu).
- [x] Identifikasi akar masalah di jalur pick WebGL.
- [x] Perbaiki (sembunyikan lapisan video selama pass pick).
- [x] CHANGELOG `[1.3.67]` + `APP_VERSION` + log ini.

## 🔍 Diagnosis (baca & trace dulu)

Alur klik di `MagazineShowcase.tsx`:

1. `onPointerDown` → `pick(clientX, clientY)` (`MagazineShowcase.tsx:1036`).
2. `pick()` menukar material mesh utama ke `pickMaterial` (shader `PICK_FRAGMENT`: `gl_FragColor = vec4((vIndex + 1.0) / 255.0, 0.0, 0.0, 1.0)`) lalu me-render **seluruh scene** ke `pickTarget` dan membaca **kanal merah** 1 piksel di titik klik → `hit = red - 1` = index lembaran.
3. `hit` → fokus/angkat lembaran → iframe `previewUrl` `images[hit % images.length]`.

**Cacatnya:** scene berisi **mesh lapisan video preview** (fitur v1.3.49, kini aktif di hampir semua lembaran sejak v1.3.55/56). Mesh video:

- memakai `VIDEO_FRAGMENT` yang menulis `vec4(color.rgb, 1.0)` — **warna video apa pun, alpha 1 (opaque, menulis depth)**;
- sengaja dibuat **menonjol 1.6× ketebalan** dari lembaran induk (`VIDEO_VERTEX: uPageThickness * 1.6`) supaya bebas z-fighting → selalu berada **di depan** lembaran induk;
- tidak ikut ditukar materialnya di `pick()` (hanya `this.mesh` yang ditukar).

Akibatnya piksel yang dibaca `pick()` di area lembaran ber-video = **warna video**, bukan kode index. Nilai merah sembarang (0–255) → `hit` jatuh ke nomor lembaran acak; begitu `0 <= hit < pages` (20), klik diterima dan **template lain terbuka**. Pixel sangat gelap/sangat terang jatuh di luar rentang → klik terlihat "tidak responsif". Ini persis gejala yang dilaporkan.

**Mengapa dulu tidak ada:** sebelum v1.3.49 tidak ada mesh video → pick bersih. Regresi muncul bersama fitur video dan makin luas saat v1.3.55/56 membuat semua lembaran ber-video.

**Yang sudah diperiksa & BUKAN penyebab** (anti-halusinasi — disebut supaya tidak "diperbaiki" lagi nanti):

- Pemetaan index → gambar/preview konsisten: `writeCells()` memakai `cells[i % cells.length]` (urutan sumber atlas) dan live memakai `images[hit % images.length]` — sama-sama urutan `cfg.images`.
- Koordinat baca piksel (`u`, `1 - v`, skala `PICK_MAX`) benar; target pick memakai piksel CSS dengan kamera/aspect yang sama.
- Encoding `(i+1)/255` ke target 8-bit untuk `pages ≤ 20` balik-eksek presisi (tidak ada kuantisasi merusak).
- `pick()` dipanggil saat `pointerdown` dengan uniform frame yang sama dengan yang tampil di layar (bukan posisi lama).

## 🛠️ Perbaikan

`MagazineShowcase.tsx` → `pick()`: sembunyikan sementara seluruh `videoMeshes` sebelum render pass pick, pulihkan visibilitasnya setelah membaca piksel:

```ts
const videoVisible = this.videoMeshes.map((m) => m.visible);
for (const m of this.videoMeshes) m.visible = false;
// …render pickTarget + readRenderTargetPixels…
for (let i = 0; i < this.videoMeshes.length; i++) {
  this.videoMeshes[i].visible = videoVisible[i];
}
```

Kenapa bentuk ini (ponytail — perubahan sesedikit mungkin yang bekerja):

- Pass pick adalah render hitung-murni ke buffer tersembunyi; menyembunyikan mesh video **tidak mengubah apa pun yang tampil di layar**. Visibilitas asli dipulihkan langsung, dan `updateVideos()` tetap menyetelnya lagi tiap frame.
- Alternatif yang ditolak: (a) menambah index ke shader video lalu mengembalikannya lewat kanal lain — menggandakan kompleksitas shader untuk hasil sama; (b) raycast CPU — butuh representasi geometri kedua; (c) menolak pixel yang tidak "persis" — membuat klik terasa mati di tepi.

**Tidak diubah:** gerak koridor, snap, siklus live, tampilan video, `TemplateDetailModal` (sudah dihapus v1.3.48), route API, D1/R2.

## 🚪 Gerbang Verifikasi

- [x] `npx eslint src/components/landing/MagazineShowcase.tsx` → 0 error.
- [x] `npx tsc --noEmit` → **0 error**.
- [x] `npx vitest run src/components/landing/__tests__/magazine-showcase.test.tsx` → **9/9 PASS** (6 lama + 3 guard `sameOriginMediaUrl`).
- [ ] **Jalur pick butuh WebGL nyata (jsdom tidak punya)** → verifikasi visual oleh owner setelah deploy: ketuk 3 lembaran berbeda, masing-masing harus membuka demo yang tepat.

---

# Bagian 2 — SecurityError `texImage2D`: video lintas domain mematikan panggung (laporan susulan owner)

**Status:** ✅ Selesai (bagian kedua, commit sama)
**Gejala (console):**
`SecurityError: Failed to execute 'texImage2D' on 'WebGL2RenderingContext': The video element contains cross-origin data` — stack di `MagazineScene.step()` (`renderer.render`), terulang tiap frame → panggung berhenti render.

## Diagnosis

- URL video hero disimpan di D1 `platform_settings.hero_preview_videos` sebagai **URL absolut http(s)** (wajib menurut `validateHeroVideoUrl`, `heroVideoService.ts:64`), bisa menunjuk domain R2 publik / CDN — **lintas domain** dengan halaman jualan.
- `<video>` boleh memutar lintas domain, tapi **WebGL tidak boleh mengunggahnya jadi tekstur** (`texImage2D`) tanpa CORS-clean. Beda dengan gambar poster yang lewat `loadImage()` (sudah `crossOrigin='anonymous'`), elemen video di `setupVideos()` **tidak pasang** `crossOrigin` → browser melempar `SecurityError` **di dalam rAF loop** → seluruh render mati, bukan cuma videonya.
- Kenapa sebelumnya tidak terlihat: fitur video hero baru dipakai penuh sejak v1.3.55/56 (semua lembaran ber-video) dan URL absolut menunjuk domain berbeda.

## Perbaikan (3 lapis, sesedikit mungkin)

1. **`sameOriginMediaUrl()` (baru, exported + dikunci 3 test):** media yang punya key R2 dikenal (`extractStoragePath`, helper repo yang sudah ada — tidak menulis parsing baru) dialihkan ke proxy **same-origin `/r2/<key>`** — jalur media resmi repo yang sudah mendukung Range + `access-control-allow-origin: *` (dipakai wallpaper video). Dipakai `srcOf()` (poster/gambar) dan `previewVideoOf()` (video). Path relatif & URL eksternal non-R2 dikembalikan apa adanya (jika ternyata eksternal non-R2 dan tetap memicu error → tertangani lapis 3).
2. **`el.crossOrigin = 'anonymous'`** di `setupVideos()` — jaring pengaman: kalau URL ternyata eksternal non-R2, fetch jadi CORS-mode; server tanpa ACAO → video gagal muat → handler `error` yang SUDAH ADA menandai `videoDead` → jatuh ke gambar statis (bukan SecurityError di loop render).
3. **`previewVideoOf()` hanya mengembalikan URL same-origin** (v1.3.67 revisi): URL ber-key R2 sudah jadi `/r2/…`; URL eksternal non-R2 → **string kosong** = video dilewati, lembaran memakai poster statis. Ini pengganti guard `try/catch` yang terbukti **tidak berguna**: three.js menangkap `SecurityError`-nya sendiri di `WebGLState.texImage2D` dan hanya `console.error` (`THREE.WebGLState: …`) — error tidak pernah naik ke `renderer.render`, jadi satu-satunya cara adalah mencegah tekstur lintas domain dibuat. `crossOrigin='anonymous'` tetap dipasang sebagai lapisan tambahan.

**Tidak diubah:** `heroVideoService` (validasi URL absolut tetap — rewrite terjadi di sisi tampilan), route `/r2/*`, upload admin, D1.

**Disederhanakan dari rencana awal:** (a) opsi rewrite URL di server (`heroVideoService`/`page.tsx`) ditolak — menyentuh service + test service + cache D1 untuk hasil yang identik; (b) guard `try/catch` di `step()` **dihapus** setelah terbukti dead code (three menelan error).

## Gerbang Verifikasi Bagian 2

- [x] `tsc --noEmit` → 0 error; `eslint` file → 0 error.
- [x] `vitest` magazine-showcase → **13/13 PASS** (+3 guard `sameOriginMediaUrl`, +4 guard `previewVideoOf`).
- [ ] Verifikasi visual owner setelah deploy: video hero berputar di lembaran (bukan cuma poster) + console bebas `SecurityError`.

> ⚠️ **Penting (laporan owner 2026-10-23):** traceback yang owner kirim masih menunjuk `MagazineShowcase.tsx:1367` — posisi `renderer.render` pada **v1.3.66** (sebelum perubahan ini; di versi ini baris itu sudah bergeser). Artinya environment yang diuji owner **belum memuat perbaikan** — kemungkinan besar site produksi atau salinan repo lain. Perbaikan baru berlaku setelah branch digabung ke `main` + deploy ulang.

---

## Backport ke `main` — v1.3.71 (2026-10-24)

Perbaikan di log ini sebelumnya **tidak pernah masuk `main`** (hanya ada di branch `fix/landing-click` dan worktree turunannya), sehingga dev server `localhost:3000` yang menjalankan `main` v1.3.70 tetap menampilkan `SecurityError texImage2D` tiap frame dan klik lembaran hero masih bisa salah template.

Backport dilakukan atas permintaan owner saat perapian worktree:

- `src/components/landing/MagazineShowcase.tsx` + `src/components/landing/__tests__/magazine-showcase.test.tsx` diambil dari commit `bfac743` (versi final, sudah termasuk `c17107f` + `34ee75b`).
- `APP_VERSION` → `1.3.71`, CHANGELOG `[1.3.71]`, entri INDEX_TRACKER #175.
- Verifikasi: `vitest` magazine-showcase PASS, `tsc --noEmit` 0 error, `eslint` bersih.

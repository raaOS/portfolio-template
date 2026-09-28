# Tracker Log: Perbaikan Poster Wallpaper Video (Semua Poster Isinya Sama — Foto Orang)

**Status:** 🟢 Completed  
**Mulai:** 2026-09-28  
**Selesai:** 2026-09-28  
**Rilis:** CHANGELOG `[1.3.8]`

## 🎯 Tujuan (Objective)
- Menjawab laporan owner: saat pertama kali membuka `http://localhost:3000/preview/os-desktop` yang terlihat adalah gambar JPG/PNG berisi **foto orang di tengah**, padahal wallpaper-nya video.
- Mengganti poster side-car keempat wallpaper video dengan frame asli tiap video.

## 🔍 Diagnosis (Root Cause)

Dua hal berbeda, jangan tertukar:

**1. JPG muncul dulu sebelum video = desain performa (by design, bukan bug).**  
`src/components/os/ui/DesktopBackground.tsx` memakai pola *poster-first*: `<img>` poster tidak pernah di-unmount (elemen LCP), `<video>` di-*fade-in* di atasnya setelah `canplay`, dan mount video ditunda sampai idle (maks 4 detik) agar range-request MP4 tidak berebut bandwidth saat fase kritis LCP. Video juga sengaja tidak diputar pada `saveData`/2G, perangkat ≤2 core, atau `prefers-reduced-motion` → poster jadi satu-satunya tampilan.

**2. Isi poster JPG-nya salah total = bug data.**  
Bukti keras sebelum perbaikan, keempat poster side-car **identik byte-per-byte**:

```
37402  5E84582207CA61F3646A7DAFAACA5C03  1780744973336-hunt-showdown...jpg
37402  5E84582207CA61F3646A7DAFAACA5C03  1780767617527-zen-kois...jpg
37402  5E84582207CA61F3646A7DAFAACA5C03  1779992198762-pink-bloom...jpg
37402  5E84582207CA61F3646A7DAFAACA5C03  1780086176924-sachiro...jpg
```

Isinya foto orang, bukan frame video mana pun (frame-0 video Hunt = wallpaper skull, diverifikasi via browser).

Akar masalah di `scripts/cloudflare/upload-video-wallpapers-r2-d1.ts` (Sprint 83, dijalankan 10 Sep 2026 04:19–04:20 UTC — cocok dengan `Last-Modified` keempat object):

```ts
// 1 posterBuffer dibuat SEKALI dari PNG ini, lalu buffer yang SAMA
// di-upload sebagai poster ke-4 video (baris 75-83)
const posterBuffer = await sharp('public/wallpapers/optimized-wallpaper.png')
  .resize(1920, 1080, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
```

`public/wallpapers/optimized-wallpaper.png` (dan `.webp` = `DEFAULT_WALLPAPER_URL`) memang berisi foto orang — itulah "PNG orang di tengah" yang dilaporkan.

## 📂 File yang Dimodifikasi (Modified Files)

- `scripts/cloudflare/upload-video-wallpapers-r2-d1.ts` → pembuatan/upload poster bersama dihapus (ditinggalkan sebagai landmine kalau dijalankan ulang: menimpa 4 poster benar dengan foto orang); 4 `posterUrl` hardcoded ditambah `?v=2` agar rerun tidak membalik cache-bust.
- `scripts/cloudflare/fix-wallpaper-posters.ts` → **baru.** One-time fix: upload 4 poster baru ke key yang sama (S3 PutObject, `image/jpeg`, `CacheControl` immutable) + tambah `?v=2` pada `posterUrl` 4 entry di baris D1 `app_kv` `content_default-site` dan `content`. Mode dry-run default, eksekusi dengan `--apply`.
- `src/lib/urlResolver.ts` → `extractStoragePath()` kini membuang query/fragment sebelum ekstraksi key. Tanpa ini, `posterUrl` `?v=2` menghasilkan key `...jpg?v=2` → dianggap **dangling** oleh `clear-dangling-wallpapers` (bisa menghapus baris wallpaper) dan gagal dihitung oleh `storage-stats`/delete. Object key R2 tidak pernah berisi query.
- `src/lib/__tests__/urlResolver.test.ts` → **baru.** 5 test: path `/r2/`, buang query cache-buster, buang fragment, URL absolut, input kosong/path tak dikenal → `null`.
- `CHANGELOG.md` → bullet perbaikan di `[1.3.8]`.
- `docs/tracker/INDEX_TRACKER.md` → entri 116 (log dock 2026-09-28, sebelumnya belum terindeks) dan 117 (log ini).

## 🖼️ Poster Baru (frame 0,5 detik, 1920×1080, ditangkap via canvas browser)

| Wallpaper | Isi frame | Byte | MD5 (sesudah) |
|---|---|---|---|
| Hunt Showdown Veil of Thorns | wallpaper tengullakaran monokrom | 394.974 | `B3ECD5F8FB01D16C014125EE81854EBB` |
| Zen Kois Live Wallpaper | wanita kimono + ikan mas | 216.614 | `6046AB471D21B3C6EE01D885860D9BD9` |
| Pink Bloom Field Clear Sky | ladang bunga cosmos pink | 149.026 | `609A4E881183D6FAB1BE90C3E1B7F3A2` |
| Sachiro Dark Nights | anime berambut putih + koi | 131.906 | `BAC7D48E97CB2635954D377C148396F6` |

Keempatnya kini berbeda (sebelumnya satu MD5 untuk semuanya).

## 🧪 Verifikasi (Verified)

- **Cara capture:** ffmpeg tidak tersedia di PATH, jadi frame diambil lewat canvas di halaman (`drawImage` ke `<canvas>` → `toDataURL('image/jpeg', 0.82)`), lalu di-stream ke disk per-chunk 100KB. Screenshot browser **tidak dipakai** untuk bukti karena terbukti menampilkan frame yang tertukar (lag komposit); semua hasil diverifikasi visual per file.
- **R2:** fetch ulang keempat URL `?v=2` → 4 MD5 berbeda (tabel di atas), byte cocok dengan file hasil capture.
- **D1:** `GET /preview/os-desktop` → `posterUrl` keempat kini berakhiran `.jpg?v=2`.
- **Browser:** `img[alt="Desktop wallpaper"]` → `.../1780744973336-hunt-showdown...jpg?v=2`. Dengan video disembunyikan, poster yang tampil = wallpaper skull (bukan foto orang).
- **Gate:** `npx tsc --noEmit` = 0 error; `npx eslint src` = 0 error; `npx vitest run` = **113 files / 856 tests PASS** (termasuk 5 test baru).

## ⚠️ Catatan & Follow-up (belum dikerjakan)

- ~~`public/wallpapers/optimized-wallpaper.png` / `.webp` / `.avif` **masih berisi foto orang**… Perlu konfirmasi owner~~ → **SELESAI 2026-09-28** (bagian "Wallpapers Statis" di bawah): foto orang sudah diganti frame Hunt / dihapus, 2 entry D1 sudah direname.
- `#t=14` sebagai default `startTime` video (`DesktopBackground`) melebihi durasi video Hunt (12,03 s) — kecil, tapi tidak ada gunanya untuk video pendek.
- Nama file `sachiro-dark-nights` tidak cocok dengan isi video (terang, anime koi) — hanya catatan, bukan bug.

---

# Wallpapers Statis: Foto Orang Dihapus/Diganti Frame (2026-09-28, lanjutan)

Tindak lanjut dari follow-up di atas: seluruh foto orang di `public/wallpapers/` dan R2/D1 dihapus/diganti dengan frame video aktif Hunt "Veil of Thorns".

## Masalah

- `DEFAULT_WALLPAPER_URL` (fallback saat poster gagal) + 2 file lokal lain masih berisi foto orang.
- 2 entry picker D1 bernama "macOS Monterey Gradient/High-Res" menunjuk objek R2 `optimized-wallpaper.*` yang isinya foto orang (nama vs isi tidak cocok).
- 10 file foto lain `.avif`/`.webp` tidak terpakai; 2 objek R2 orphan foto orang.

## Perubahan

### File lokal (`public/wallpapers/`) — 3 file ditulis ulang, 10 dihapus

- **Ditulis ulang** (isi = frame Hunt 1920×1080, sumber `poster-hunt.jpg`): `optimized-wallpaper.webp` (q60, 192.372 B), `optimized-wallpaper.png` (palet 1152×648 q30 dither0, 181.725 B), `1772328103874-4nb3gn114vgo-wallaper.webp` (192.372 B — ini file yang direferensikan `about.json` untuk fallback). Semua <200KB (aturan repo).
- **Dihapus (10 file, tak direferensikan di D1/kode/manifes):** 5 `.avif` (semuanya) + `1769442661067…webp`, `1771963001387…webp`, `1771963212220…webp`, `1771963282882…webp`, dan `1772328103874…avif`. File mati diganti isi = sia-sia, jadi dihapus. Folder kini 3 file.

### R2 + D1 — `scripts/cloudflare/fix-wallpaper-statics.ts` (dry-run default, `--apply`)

- Upload ulang 2 key `optimized-wallpaper.webp/png` dengan isi frame baru (192.372 / 181.725 byte).
- Hapus 2 objek orphan: `assets/wallpapers/1771963001387-yfwye4hggmcu-wallaper.webp` dan `1771963212220-fy3vb66wba5k-wallaper.webp`.
- D1 `app_kv` (`content_default-site` + `content`), 4 perubahan per baris: rename `macOS Monterey Gradient` → **`Veil of Thorns (Statis)`**, `macOS Monterey High-Res` → **`Veil of Thorns (Statis, PNG)`**, dan `url` keduanya + `?v=2` (R2 `Cache-Control: immutable, max-age=31536000`). `activeWallpaperId` tetap video `w-1780744973336-veil-thorns`.

### Landmine rerun dibersihkan (2 script seed)

- `scripts/cloudflare/fix-wallpapers-d1-r2.ts`: (a) 2 upload entry file terhapus dibuang, (b) `defaultWallpapers` ikut nama baru + `?v=2` dan entry `w-default-abstract-flow` (menunjuk file terhapus) dibuang, (c) **guard rerun**: `activeWallpaperId`/`blur` dijaga dari nilai sebelumnya (sebelumnya hardcode → rerun mereset wallpaper aktif customer ke gambar statis & blur 0).
- `scripts/cloudflare/upload-video-wallpapers-r2-d1.ts`: 2 entry statis hardcoded (baris ±127-138) ikut nama baru + `?v=2`.

## File yang Dimodifikasi

| File | Perubahan |
|---|---|
| `public/wallpapers/optimized-wallpaper.webp` | ditulis ulang (frame Hunt, 192.372 B) |
| `public/wallpapers/optimized-wallpaper.png` | ditulis ulang (frame Hunt, 181.725 B) |
| `public/wallpapers/1772328103874-4nb3gn114vgo-wallaper.webp` | ditulis ulang (frame Hunt, 192.372 B) |
| `public/wallpapers/*.avif` + 4 `.webp` lain | **dihapus** (10 file, tak terpakai) |
| `scripts/cloudflare/fix-wallpaper-statics.ts` | **baru** — R2 upload + hapus orphan + rename/`?v=2` D1 |
| `scripts/cloudflare/fix-wallpapers-d1-r2.ts` | buang entry mati, nama baru + `?v=2`, guard `activeWallpaperId`/`blur` |
| `scripts/cloudflare/upload-video-wallpapers-r2-d1.ts` | 2 entry statis: nama baru + `?v=2` |
| `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md` | dokumentasi |

## Verifikasi (Verified)

- **Dry-run → apply:** 2 upload, 2 hapus orphan, 4+4 perubahan D1.
- **D1 dump:** kedua baris kini `Veil of Thorns (Statis)` / `Veil of Thorns (Statis, PNG)` + url `?v=2`; `activeWallpaperId` = `w-1780744973336-veil-thorns`; 6 entry (4 video + 2 statis).
- **HTTP:** `GET /r2/assets/wallpapers/optimized-wallpaper.webp?v=2` → 200, 192.372 B, MD5 `1CFFD9DC9243…` (sama dengan file lokal; sebelumnya `A97C89FC7660…`/`B6E94B1905C7…` lama); kedua file lokal + fallback `1772328103874…webp` → MD5 sama `1CFFD9DC9243…`; orphan R2 → **404**.
- **Browser (`agent-browser`):** `/preview/os-desktop` → wallpaper = frame skull video, dock & window normal, `agent-browser errors` = **0 error**; tak ada foto orang.
- **Gate:** `npx tsc --noEmit` = 0; `npx eslint src` = 0; `npx vitest run` = **113 files / 856 tests PASS**.

## Catatan / Follow-up

- **Perubahan perilaku script** (laporan ke owner): `fix-wallpapers-d1-r2.ts` kini mempertahankan `activeWallpaperId`/`blur` saat rerun — sebelumnya hardcode reset. Ini disengaja agar rerun script seed tidak menimpa pilihan wallpaper customer.
- `optimize-assets.js` (jika dijalankan ulang) mengonversi `optimized-wallpaper.png` → webp q80 1152×648 dan akan menimpa webp q60 1920×1080 baru — jangan jalankan script itu tanpa memeriksa dampaknya.
- `#t=14` melebihi durasi video Hunt & nama file `sachiro-dark-nights` tidak cocok isi — tetap tercatat, belum dikerjakan.

---

# Deploy Produksi: Bug Foto Orang Masih Muncul di Demo `makeitbetter.my.id` (2026-09-28, lanjutan)

**Status:** 🟢 Completed — owner menyetujui deploy ulang.

## Laporan Owner

> "di demo template pun ada bug visual yg sama wallpaper orang itu muncul pas awal mulai"

## Diagnosis (3 lapis, jangan tertukar)

| Lapis | Kondisi sebelum deploy | Status |
|---|---|---|
| **D1** | Sudah benar — `GET /api/about` & `/api/homepage` produksi sudah mengembalikan "Veil of Thorns (Statis)" + `posterUrl ?v=2` | ✅ tidak perlu diubah |
| **R2** | Sudah benar — poster `.jpg` (bare & `?v=2`) = `B3ECD5F8…` frame Hunt; statics `1CFFD9DC9243…` / `B6E94B1905C7…` | ✅ tidak perlu diubah |
| **HTML ISR** | **BASI** — header `x-opennext-cache: STALE`, `cache-control: s-maxage=1, stale-while-revalidate=2592000`. `/preview/os-desktop` & `/preview/infinite-canvas` masih snapshot pra-fix: `posterUrl` **tanpa `?v=2`**, nama "macOS Monterey Gradient/High-Res". Cache-bust `?cb=timestamp` tidak membantu → masalah di origin (KV incremental), bukan edge. | ❌ butuh deploy |
| **Aset `public/`** | **MASIH FOTO ORANG** — `makeitbetter.my.id/wallpapers/optimized-wallpaper.webp` = 16.146 B / MD5 `A97C89FC7660…` (foto orang, terunduh & dilihat); lokal = 192.372 B frame Hunt. Ini `DEFAULT_WALLPAPER_URL` (fallback saat poster gagal). | ❌ butuh deploy |

**Kenapa "muncul pas awal mulai":** HTML basi menulis `posterUrl` tanpa `?v=2`, sedangkan response R2 di-set `immutable, max-age=31536000` → browser pengunjung yang pernah membuka demo sebelum perbaikan menyajikan **poster foto orang dari cache 1 tahun** tepat di frame pertama, sampai video fade-in menutupinya. Di browser sesi bersih (tanpa cache) gejalanya tidak terlihat — itulah kenapa bug ini lolos verifikasi lokal.

## Perbaikan: `npm run deploy`

Percobaan **pertama gagal** (lihat "Insiden" di bawah). Percobaan kedua sukses:

- Pre-deploy gates: required files/env/forbidden keys OK, compat audit **473 file, 0 blockers**.
- Build: Next.js 16.3.6 Turbopack, 67/67 static pages, `/preview/*` revalidate 1m.
- `populateCache`: **59 entri** diunggah ke KV incremental remote (snapshot HTML segar menggantikan yang basi); tag cache tidak perlu.
- Aset: **19 file baru/diubah** dari `.open-next/assets` (termasuk `/wallpapers/1772328103874-…webp` dan `/wallpapers/optimized-wallpaper.png`), 905 sudah ada.
- **Version ID `163a5779-d070-4b9d-b828-b4e6e7fb525a`** — worker `portfolio-os-template`, startup 17 ms.

## Insiden: `workerd` gagal `CreateDirectory` (masalah LINGKUNGAN, bukan kode)

Percobaan deploy #1 jatuh di `opennextjs-cloudflare deploy` → `getPlatformProxy()`:

```
kj/filesystem-disk-win32.c++:773: failed: CreateDirectory: #5 Access is denied.
path = miniflare-email-store
MiniflareCoreError [ERR_RUNTIME_FAILURE]: The Workers runtime failed to start.
```

`miniflare-email-store` = **uniqueKey Durable Object email-store** (bukan path folder); workerd membuatnya sebagai sub-folder dari `os.tmpdir()/miniflare-<hex>/email-store`.

Diagnostika yang menyingkirkan kandidat biasa:

- Bukan antivirus: hanya Windows Defender (sehat, `EnableControlledFolderAccess=0`, tanpa ASR rule, tidak ada event 1116/1117, disk bebas 128 GB).
- Bukan binary: `workerd --version` → `workerd 2026-09-23`, status 0.
- Bukan ACL repo: `New-Item` & `mkdirSync` rekursif pada path yang sama persis **berhasil** di Node.

**Akar masalah (sistematik, 4/4 replikasi):** workerd hanya bisa membuat folder di dalam folder project.

| `TEMP`/`TMP` | Hasil `getPlatformProxy` |
|---|---|
| `C:\Users\USER\AppData\Local\Temp` (default) | ❌ FAIL |
| `C:\Users\USER\AppData\Local\Temp\mfnest` | ❌ FAIL |
| `C:\Users\USER\.mftmp` | ❌ FAIL |
| `C:\Users\USER\Documents\mftmp` | ❌ FAIL |
| `<project>\node_modules\.cache\mftemp` | ✅ **OK** |

**Workaround dipakai untuk deploy (tidak mengubah repo, tidak butuh admin):**

```powershell
$env:TEMP="C:\Users\USER\Documents\tamplate-portofolio\node_modules\.cache\mftemp"
$env:TMP=$env:TEMP
npm run deploy          # ... lalu hapus folder itu
```

> [!NOTE]
> **Runbook untuk deploy berikutnya di mesin ini:** jika `opennextjs-cloudflare deploy` gagal dengan `kj/filesystem-disk-win32 … CreateDirectory … miniflare-email-store`, set `TEMP`/`TMP` ke folder di dalam project (mis. `node_modules\.cache\mftemp`) lalu jalankan ulang. Penyebab pasti di level OS/kebijakan mesin belum dipastikan (Defender terlihat bersih) — dicatat sebagai misteri lingkungan.

## Verifikasi Pasca-Deploy (semua PASS — `verify-prod-after-deploy.mjs`)

- HTML `/preview/os-desktop` & `/preview/infinite-canvas`: `?v=2` ✅, "Veil of Thorns (Statis)" ✅, "macOS Monterey" sudah tidak ada ✅, tidak lagi merujuk `public/wallpapers/*.webp` sebagai fallback ✅.
- `GET /api/about` tetap data baru + `?v=2`.
- `public/wallpapers/optimized-wallpaper.webp` → **192.372 B / `1CFFD9DC9243…`** (frame Hunt), `1772328103874-…webp` → `1CFFD9DC9243…`, `optimized-wallpaper.png` → **181.725 B / `B6E94B1905C7…`** — ketiganya bukan lagi foto orang (`A97C89FC7660…` / `3054898CB244…`).
- Poster R2 bare **dan** `?v=2` → `B3ECD5F8FB01…` (identik, jadi pengunjung lama pun sekarang mendapat frame baru begitu HTML segar merujuk `?v=2`).
- `GET /`, `/about`, `/api/health`, `/api/data/version` → 200.
- **Browser sesi bersih** (`agent-browser --session final`): request poster kini `…jpg?v=2` (200), screenshot fase awal = frame Veil of Thorns, desktop penuh (ikon, dock, window About Me) tanpa satu pun foto orang, `agent-browser errors` = **0 error**.

## Catatan / Follow-up

- **Dev server sempat dimatikan** selama deploy (`ensure-next-dev-not-running.js`) dan sudah dijalankan ulang.
- Folder temp workaround (`node_modules\.cache\mftemp`) sudah dihapus setelah deploy; folder uji `.mftmp`/`mftmp` lain juga sudah dibersihkan. Tidak ada file repo yang berubah karena insiden ini.
- **ISR produksi perlu dipantau:** sebelum deploy, `revalidate = 60` tidak pernah meng-commit HTML baru selama berjam-jam (tetap `STALE` walau D1 sudah benar) — setelah deploy isi kembali segar karena snapshot baru. Jika kelak perubahan D1 butuh puluhan menit untuk terlihat di `/preview/*`, kemungkinan background revalidation OpenNext memang tidak commit; solusinya jalankan `npm run deploy` atau panggil `POST /api/revalidate` (saat ini hanya revalidasi `/`, `/about`, `/contact` — tidak menyentuh `/preview/*`).
- Status: seluruh perbaikan poster + wallpapers statis (entri 117 & 118) **kini juga berlaku di demo produksi**.

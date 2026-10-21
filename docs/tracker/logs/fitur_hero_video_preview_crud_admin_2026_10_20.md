# #172 — Video Preview Hidup di Lembaran Hero + Panel Admin "Video Hero" (v1.3.49, 2026-10-20)

**STATUS: ✅ Selesai & LIVE** (`/api/health` = **1.3.49**, Version ID `59c56de5-7483-44e8-9f61-32af503df059`, commit `41ec7eb`).

> **Update 2026-10-21 — test nyata owner: 3 bug ditemukan & diperbaiki berurutan (v1.3.50–1.3.52).**
>
> 1. **v1.3.50** — klik Video Hero dari desktop hanya menampilkan _"Panel 'heroVideos' belum tersedia"_: key `heroVideos` tidak pernah masuk `PANEL_MAP` (`WindowContentRenderer.tsx`) walau terdaftar di `registry.ts` + `APP_ROUTE_MAP`; `ClientAdminLayout` tidak merender halaman route, semua isi window diambil dari `PANEL_MAP`. Bug kelas terulang ke-3 (`ai` v1.3.28, `harga` v1.3.29). Perbaikan: dynamic import `HeroVideosPanel` + key `heroVideos`; **guard test coverage baru** di `registry.test.ts` (semua app `ADMIN_ZONES` wajib ada di `PANEL_MAP`, kecuali `ai` yang sengaja mati) — `PANEL_MAP` kini di-export. Gate: **139 file / 1.135 test PASS**; commit `8a77db0`.
> 2. **v1.3.51** — upload kompresi WASM + unggah R2 **sukses 200** tapi simpan D1 selalu 400 _"URL video harus http:// atau https://"_: route `/api/admin/upload` mengembalikan **URL relatif** (`/r2/…`) sedangkan validasi service mewajibkan http(s) absolut (guard disengaja). Bonus: `folder=hero-videos` tidak dikenali route upload (hanya `sounds`/`wallpapers`/`models`/`assets/*`) → file jatuh ke `assets/projects` campur file karya. Fix di panel: `new URL(url, origin)` sebelum simpan + `folder=assets/hero-videos`; validasi service tidak diubah. Commit `9cb721c`.
> 3. **v1.3.52** — setelah simpan sukses, klik **Hapus** (mutasi kedua) ditolak _"Invalid or missing CSRF token"_. Akar masalah **lintas-fitur**: `GET /api/auth/check-auth` (dipoll `useAdminAuth`) membuat token CSRF **baru setiap kali** & menimpa cookie `csrf_token`, sedangkan cache client (`client-csrf.ts`) mengirim token lama → basi → ditolak; bisa mempengaruhi semua form admin. Fix: check-auth **pakai ulang token cookie** yang ada (pola lama `/api/admin/check-auth`); 1 test baru (anti-rotate). Suite penuh **139 file / 1.136 test PASS**. Commit `107df99`.
>
> **Bukti alur upload lengkap sukses (slot OS Desktop, v1.3.51):** file test 277 KB → progress kompresi WASM di browser produksi → POST upload 200 (`hero-os-desktop.mp4` 248 KB, R2 `assets/hero-videos/`) → D1 `hero_preview_videos` = `{"os-desktop":"https://makeitbetter.my.id/r2/assets/hero-videos/hero-os-desktop.mp4"}` → panel badge **aktif** + preview video readyState 4 (screenshot pola test warna) → video publik HEAD 200 video/mp4 → homepage (ISR 60 dtk) memutar `hero-os-desktop.mp4` di lembaran hero (`paused=false`, t=1,98 dtk). Langkah **Hapus** menunggu deploy v1.3.52 (bug CSRF #3) — dilanjut setelahnya.

**Bukti verifikasi produksi (2026-10-20 malam):**
- Health 1.3.49; `/`, 3× `/preview/*`, `/landing/os-desktop.mp4` = **200**.
- `GET /api/admin/hero-videos` anonim = **401** (owner-mode aktif → lolos guard lalu auth menolak = perilaku benar di site owner; di site klien = 404, diuji unit test).
- DOM produksi (`makeitbetter.my.id`): 1 kanvas WebGL + 3 elemen `<video>` terpasang. `os-desktop.mp4` **readyState 4, muted/loop/playsInline, paused=false, currentTime maju 2,79 → 0,51 detik (1 putaran loop penuh 9 dtk terlewati)** = video benar-benar berjalan. Dua video lain `error code 4` (file memang sudah dihapus) → lapisan video disembunyikan otomatis → lembaran menampilkan gambar screenshot (tanpa kotak hitup/kosong).
- Screenshot 2x (selisih 3 dtk): satu lembaran terbaca menampilkan **bingkai video** (desktop OS tanpa jendela — beda dari `os-desktop.webp` statis yang berjendela + sticky note) sementara bingkai sebelahnya = tangkapan layar statis persis file webp → lapisan video menempel benar di lembaran sambil drift.
- Deploy sempat gagal 1x transitif (DNS `api.cloudflare.com` tidak terresolver) → retry sukses. Suite penuh sebelum commit: **139 file / 1.134 test PASS**; tsc 0; lint bersih; pre-commit lolos.

## Ringkasan Permintaan Owner

Setelah v1.3.48 (koridor majalah → snap → demo live on-tap) live, owner ingin lembaran yang **bergerak** juga terlihat "hidup". Percobaan awal memakai script perekam otomatis (Playwright + ffmpeg-static): owner membatalkan — *"STOP, ribet pakai script, biar aku rekam manual aja, dan masukan ke halaman CRUD admin dashboard, tapi karena CRUD belum ada mungkin dibuatkan."* Keputusan: **owner rekam layar sendiri** (HP/laptop), AI buatkan **panel CRUD admin** untuk upload; kompresi & konversi format otomatis saat upload; fitur **owner-only** agar tidak kebawa deploy ke customer.

## Keputusan Desain

1. **Lapisan video WebGL di hero = TETAP dipakai** (hasil kerja v1.3.49 awal, sudah lolos gerbang): mesh video per-slot berbagi **uniform objek** dengan material utama (sinkron nol biaya per frame), shader `VIDEO_VERTEX` = salinan 1:1 fisika `PAGE_VERTEX` (ketebalan ×1.6 supaya kedua muka kotak video menonjol ±0.3 ketebalan dari lembaran induk → bebas z-fighting dari sisi kiri & kanan), `videoSlotIndices()` (murni, diuji) memilih ≤2 lembaran dengan `|zCorridor|` terkecil kecuali sliver pusat (`VIDEO_SKIP_CENTER` 0.35). Sembunyi otomatis: fokus/live tayang, tab tersembunyi (`visibilitychange`), video error → fallback gambar.
2. **Sumber video = D1, bukan file hardcode**: `platform_settings` key `hero_preview_videos` (JSON per slot), dibaca homepage storefront (ISR 60 dtk). Fallback berlapis: URL admin → video default bawaan `/landing/<screenshot>.mp4` → gambar screenshot. `os-desktop.mp4` (536 KB, hasil rekaman percobaan awal yang benar) dipertahankan sebagai video default contoh; 2 video jelek hasil rekaman dingin (layar boot, 11–43 KB) **dihapus**.
3. **Kompresi di client saat upload** (bukan server, bukan script): memakai `useFFmpeg` hook yang sudah ada (WASM FFmpeg self-hosted `/ffmpeg`, profil `standard`: MP4 H.264 720p, CRF 24, GOP 60, audio dibuang, `+faststart` → mulai diputar sambil masih diunduh = buka browser cold pun langsung hidup). Hasil diunggah ke R2 via `/api/admin/upload?folder=hero-videos&filename=hero-<slug>` (jalur upload admin yang sudah ada; video/mp4 non-wallpaper = **original passthrough**, tidak di-encode ulang). Batas rekaman mentah 500 MB (diproses lokal, tidak dikirim).
4. **Owner-only 3 lapis** (pola Harga Jual/Pesanan): app `ownerOnly: true` di `registry.ts` (disaring `getAdminZONES` — tidak tampil di desktop admin klien), route API `requireOwnerMode()` → **404 di klien** (bukan 403), dan pipeline `deployClient` sudah memaksa `OWNER_MODE=false` dua lapis. CSRF otomatis (semua mutasi API lewat `checkCSRF` middleware; panel kirim header `x-csrf-token` via `getWritableCsrfToken`).

## Perubahan Kode

| File | Aksi |
|---|---|
| `src/lib/services/heroVideoService.ts` | Baru — `getHeroPreviewVideos()` (cache 60 dtk, tidak pernah melempar, gagal query tidak di-cache), `updateHeroPreviewVideo()` (upsert per slot; `url` kosong = hapus slot), `validateHeroVideoUrl()` (http(s) absolut ≤500 char; tolak `javascript:`/protocol-relative), `HERO_VIDEO_SLOTS` |
| `src/app/api/admin/hero-videos/route.ts` | Baru — GET (ownerMode + `validateAdminRequest` checkCsrf:false), PUT `{slug,url}` (ownerMode + auth + CSRF middleware) |
| `src/app/api/admin/hero-videos/route.test.ts` | Baru — 12 test: auth 401, pola `validateAdminRequest`, simpan/hapus, 400 tanpa slug, guard 404 klien (GET/PUT/unset fail-closed) |
| `src/lib/services/heroVideoService.test.ts` | Baru — 13 test: validasi URL/slot, baca peta (saring slot & URL invalid), fallback `{}` (tabel kosong/JSON rusak/D1 mati), cache 60 dtk (1 query untuk 2 baca), upsert/hapus/error tulis |
| `src/app/admin/desktop/registry.ts` | App `heroVideos` "Video Hero" (zone Tampilan, `ownerOnly: true`, ikon Clapperboard) + `APP_ROUTE_MAP` |
| `src/app/admin/hero-videos/page.tsx` | Baru — halaman admin (AdminAuthGuard + AdminHeader, pola `/admin/harga`) |
| `src/app/admin/desktop/panels/HeroVideosPanel.tsx` | Baru — CRUD 3 slot: pratinjau `<video>`, upload (kompres → R2 → simpan URL D1), hapus, progress bar, status; WASM FFmpeg single-thread → satu encode pada satu waktu |
| `src/app/page.tsx` | Storefront branch baca `getHeroPreviewVideos()` → props `heroVideos` |
| `src/components/landing/LandingPage.tsx` | Props `heroVideos?` → `previewVideo` per gambar lembaran |
| `src/components/landing/MagazineShowcase.tsx` | `MagazineImage.previewVideo?`; `previewVideoOf()` = URL admin ?? turunan `.webp→.mp4` ?? ''; komentar kepala disesuaikan; hapus `HEADER_HEIGHT` mati (sisa rewrite Gemini) |
| `src/lib/constants.ts` | `APP_VERSION` → 1.3.49 |
| `package.json` | Hapus `rekam:demo` (dibatalkan owner) |
| `scripts/media/record-demo-previews.ts`, `_probe*.ts` | **Dihapus** (percobaan script perekam otomatis; alur resmi = rekam manual + upload admin) |
| `public/landing/infinite-canvas.mp4`, `spatial-gallery.mp4` | **Dihapus** (rekaman layar boot / cache dingin — isinya kosong); `os-desktop.mp4` (536 KB) dipertahankan sebagai video default |

## Gerbang & Verifikasi

- `vitest` target (service + route + magazine): **33 test PASS** (15 baru).
- `tsc --noEmit`: 0 error; `eslint` file tersentuh: bersih.
- Suite penuh + deploy + verifikasi produksi: lihat catatan akhir di bawah (diupdate setelah deploy).

## Catatan Wajib (Pemeliharaan)

> **Jika tampilan demo template berubah** (wallpaper/layout/fitur baru di halaman utama demo), **rekam ulang video hero & upload lewat admin → zone Tampilan → Video Hero** (ganti per slot). Tanpa ini, preview video hero jadi tidak akurat terhadap demo terbaru. Slot yang dikosongkan otomatis jatuh ke video default/gambar — aman kapan saja.

## Aturan yang TIDAK Boleh Dilanggar AI Berikutnya

- Jangan tampilkan aplikasi "Video Hero" / route API-nya di site klien (ownerOnly + requireOwnerMode; jangan dilepas tanpa keputusan owner).
- Jangan tambah slot video di hero melebihi 2 (lembaran terbaca) — lebih dari itu membebani bandwidth dekod video.
- Jangan kembalikan script perekam otomatis (`rekam:demo`) — sudah dibatalkan owner.
- Jangan simpan URL video dari sumber selain http(s) absolut (guard validasi ada di service & route).

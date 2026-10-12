# Log #160 — Loader Animasi Homepage "Deck Reveal" (ala k95.it) + App Admin "Loader" (v1.3.41)

- **Tanggal:** 2026-10-12
- **Versi:** 1.3.41 (renumber — nomor 1.3.37 lama tabrakan dengan fix os-desktop HELLO di main)
- **Status:** 🟢 Selesai & Terverifikasi (tsc 0, eslint 0, `npm test` **130 file / 1034 test PASS**, E2E browser deck-reveal + once-per-sesi hijau); **renumber #155 → #160 saat integrasi main**, rilis digabung ke **v1.3.41**. Deploy `87f82f7d` (klaim LIVE lama) **di-rollback** ke `d16af178` (v1.3.39) — tree ber-base lama kehilangan 4 commit main; deploy ulang v1.3.41 menyusul. Verifikasi panel admin di browser masih tertunda (butuh login admin — sama seperti entri 121/123)

## Permintaan Owner

1. Rekreasi boot loader **k95.it**: tumpukan gambar yang melebar berjenjang dengan counter `[0]→[100]`, lalu patch reveal menyingkap halaman utama.
2. Fase 1: preview **terisolasi** dulu — **dilarang** menyentuh 3 template (os-desktop, infinite-canvas, spatial-gallery) dan logikanya; harus mudah dihapus kalau tidak disukai.
3. Fase 2 (setuju lewat kuesioner): loader **"DeckReveal"**, gambar dari cover project sungguhan (maks 10 layer), **pemilihan gambar terpisah** dari setelan ikon desktop, berlaku **untuk ketiga template**, dan app admin tersendiri **"Loader"** di zona Tampilan karena owner ingin mengkustomisasi banyak loader.
4. _"lakukan, pastikan kembali bug di cek"_ → implementasi + audit bug penuh.

## Keputusan Teknis

- **Penyimpanan:** `loaderConfig` di dalam blob `about` (tabel `app_kv`) — mengikuti pola `wallpaperConfig`. **Tanpa tabel & endpoint baru.**
- **Bentuk config:** `{ enabled, style: 'deck-reveal', imageProjectIds[], durationMs?, accentColor?, showCounter? }` — `style` enum supaya nanti bisa tambah gaya loader lain tanpa breaking change.
- **Guard sesi:** `sessionStorage['portfolio_loader_played']` — loader tampil sekali per sesi (pola sama dengan boot guard `portfolio_os_booted`).
- **Koeksistensi:** DeckReveal jalan sebagai overlay **sebelum** StartScreen os-desktop berjalan normal; gate dipasang di `src/app/page.tsx` sehingga satu pemasangan menjangkau semua template (renderer tidak disentuh sama sekali).
- **Default aman:** `enabled: false` di fallback `about.json` → deployment lama tidak berubah perilaku sampai diaktifkan dari admin.

## Perubahan

### Fase 1 — Preview terisolasi

- Rute `/lab/loader` (`src/app/lab/loader/page.tsx`) + komponen loader; riset meng-ekstrak timing k95: 9 layer `[84..100]%`, stagger 0.28, easing cubic-bezier(.16,1,.3,1) (Newton-Raphson), exit patch `box-shadow: 0 0 0 200vmax`.
- Setelah jadi fitur produksi, komponen dipindah ke `src/components/shared/DeckRevealLoader.tsx`; lab page tinggal import dari sana. Menghapus folder `lab/loader` meninggalkan nol sisa.

### Fase 2 — Integrasi CRUD penuh

1. **Tipe & validasi:** `LoaderConfig` di `src/types/about.ts` (masuk `AboutData` + `UpdateAboutData`); `loaderConfigSchema` (strict) di `src/lib/validations/adminCrud.ts` + masuk `updateAboutSchema` (API `/api/about` otomatis memvalidasi).
2. **Service:** replace-if-defined di `aboutService.updateAboutData` (pola `spatialGalleryConfig`); tidak perlu asset-cleanup karena gambar = cover project, bukan aset unggahan about.
3. **`DeckRevealLoader` upgrade:** 10 layer (`[82,84,...,98,100]`), props `durationMs` (default 2800) / `accentColor` (default `#1500E1`) / `showCounter`; failsafe turunan dari `durationMs`.
4. **`HomepageLoaderGate`** (client): session guard async (lint-safe via `setTimeout 0`), resolve gambar via **helper yang sudah ada** `resolveCover()` (`src/lib/images.ts` — video → poster side-car), fallback ke semua cover project kalau admin belum memilih, tidak render sama sekali kalau tidak ada gambar.
5. **Admin:** app **"Loader Animasi"** di registry zone `display` (ikon MonitorPlay) + `APP_ROUTE_MAP` + `PANEL_MAP` + route `/admin/system/loader` + `LoaderPanel.tsx` (desktop window) + `LoaderManagerForm.tsx` (sakelar, grid pilih project bernomor urut 1–10 dengan badge & cap, slider durasi, color picker, toggle counter).
6. **Test:** 7 test zod `loaderConfig` (batas 10 ID, hex color, range durasi, enum style, strict mode) + 6 test `HomepageLoaderGate` (guard mati/sekali-per-sesi, urutan `imageProjectIds`, fallback, skip video tanpa poster, no-image → tidak render).

## File yang Dimodifikasi

**Baru:**
- `src/components/shared/DeckRevealLoader.tsx` (dipindah dari `src/components/lab/`)
- `src/components/shared/HomepageLoaderGate.tsx`
- `src/components/shared/__tests__/HomepageLoaderGate.test.tsx`
- `src/app/admin/system/components/LoaderManagerForm.tsx`
- `src/app/admin/desktop/panels/LoaderPanel.tsx`
- `src/app/admin/system/loader/page.tsx`
- `src/app/lab/loader/page.tsx` (sandbox preview)

**Diubah:**
- `src/types/about.ts`, `src/lib/validations/adminCrud.ts`, `src/lib/services/aboutService.ts`
- `src/app/page.tsx` (render gate — 1 blok kondisional), `src/data/about.json` (default `loaderConfig` disabled)
- `src/app/admin/desktop/registry.ts` (app + route map), `src/app/admin/desktop/WindowContentRenderer.tsx` (PANEL_MAP)
- `src/lib/validations/__tests__/adminCrud.test.ts` (+7 test)
- `src/lib/constants.ts` (`APP_VERSION` → 1.3.41), `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md`

**Tidak disentuh (sengaja):** 3 template renderer, `DesktopEnvironment.tsx` (protected core), semua logic boot StartScreen.

## Bug yang Ditemukan & Diperbaiki Saat Audit

1. **TS2532** `LoaderManagerForm` — `DEFAULT_CONFIG.durationMs` bertipe optional → diperbaiki dengan konstanta `DEFAULT_DURATION_MS`.
2. **ESLint `react-hooks/set-state-in-effect`** di `HomepageLoaderGate` (sessionStorage check + setState sinkron di effect) → dijadwalkan via `setTimeout(…, 0)` — pola yang sama dengan `ActivityLogPanel`/`OrdersPanel`.
3. **Asumsi poster salah:** test fixture awal memakai video path `r2/assets/…` yang ternyata **bisa** di-infer poster-nya oleh `getVideoPosterSource` (pola `assets/`) → fixture diganti URL eksternal supaya kasus "video tanpa poster" benar-benar teruji.
4. **`resolveCover` mengembalikan SVG placeholder "PREVIEW"** untuk project tanpa cover → ditambah guard `if (!project?.cover) return null` di kedua `pickProjectImage` (admin form + gate) supaya placeholder tak pernah jadi layer loader.
5. Typo sementara di test (`getByKeyTestIdSafe`) + eslint-disable yang tidak terpakai → dibersihkan; seluruh suite dijalankan ulang.
6. **🔴 BUG NYATA — loader tidak pernah tampil di dev (StrictMode double-effect).** Gejala verifikasi browser: flag sesi `portfolio_loader_played` terisi `'1'` tapi overlay `.boot-loader` tidak pernah muncul (teramati di 2 browser berbeda). Akar masalah: `reactStrictMode: true` di `next.config.mjs` membuat dev menjalankan effect **setup → cleanup → setup**; versi lama menulis/membaca flag sesi di **badan effect** (run ke-1 mengonsumsi flag + menjadwalkan `setTimeout`, lalu cleanup membatalkan timer-nya) sehingga run ke-2 melihat flag terisi dan skip → loader "termakan" tanpa pernah tampil. **Prod tidak terpengaruh** (StrictMode ganda hanya di dev), tapi ini juga bisa menghangat kalau komponen pernah remount cepat. **Fix:** keputusan sesi (baca/tulis flag) dipindah ke **dalam callback timer** — timer yang selamat dari siklus StrictMode-lah yang mengambil keputusan, idempoten. **Regression test ketat ditambahkan** (render `<StrictMode>`) dan **dibuktikan empiris**: dengan logika lama test GAGAL (1 failed), dengan fix LULUS.

## Temuan Pre-Existing (bukan regresi fitur ini)

- **Worktree tanpa `.env.local`** → `next build` gagal di fase prerender (`getProjectsSql` throw "Cloudflare D1 env is incomplete") termasuk halaman `/projects` yang tidak tersentuh. Fix: salin `.env.local` dari repo utama `Documents\tamplate-portofolio` (gitignored; pernah juga dicatat di entri 138). Setelah itu **build hijau penuh**.
- **Dev tanpa D1** → homepage melempar error boundary di `page.tsx:63` (`loadHomepageData`) **sebelum** `loadAboutData` tercapai; kondisi lama, bukan dari perubahan ini.
- Stale webpack cache sempat melempar ENOENT `src/components/lab/BootStackLoader.tsx` (nama lama sebelum rename) setelah file dipindah — hilang sendiri setelah dev server restart.

## Verifikasi

- `npx tsc --noEmit` → **0 error**; ESLint pada seluruh file tersentuh → **0 error, 0 warning**.
- `npm test` → **129 file / 1026 test PASS** (14 test baru; termasuk test sinkronisasi `APP_VERSION` ↔ CHANGELOG teratas + regression test StrictMode).
- `npm run build` → **hijau** (route table lengkap; `/lab/loader` ikut prerender) setelah `.env.local` disalin.
- Browser `/lab/loader` → counter berjalan (`[41]` dsb), layer melebar berjenjang, replay bekerja.
- **Homepage nyata end-to-end** (dev dengan `STOREFRONT=false` sementara + gate dipaksa aktif sementara, keduanya **sudah di-revert**): screenshot `scratch/loader-homepage-2.png` menunjukkan overlay loader di atas homepage OS desktop dengan **cover project asli D1** (poster promo) + counter `[6]`; eval DOM: `loader: true`, `layers: 10`, flag sesi terisi. Load kedua di sesi yang sama → `loader: false` (**once-per-sesi terbukti end-to-end**).
- **Tertunda:** panel admin butuh login (`ADMIN_PASSWORD_SCRYPT` tidak bisa dibalik) — sama seperti catatan entri 121/123; form admin terverifikasi via tsc/lint/7 test zod + komponen testable.

## Handoff / Catatan Owner

- Fitur dirilis bersama **v1.3.41** (merge ke main — nomor 1.3.37 lama tabrakan); `npm run deploy` dijalankan dari main.
- Untuk mengaktifkan: admin → **Tampilan → Loader Animasi** → sakelar enable + pilih cover project → simpan; lalu buka situs di tab baru (sekali per sesi).
- `STOREFRONT=true` di `.env.local` menentukan wajah `/` (toko vs portofolio) — sesuaikan saat mau melihat loader di homepage dev.

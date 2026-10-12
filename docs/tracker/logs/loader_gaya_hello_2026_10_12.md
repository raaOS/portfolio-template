# Log #161 — Loader Gaya "Hello" (Lottie) untuk Semua Template (v1.3.41)

- **Tanggal:** 2026-10-12
- **Versi:** 1.3.41 (renumber — nomor 1.3.38 lama tabrakan dengan fitur bisnis di main)
- **Status:** 🟢 Selesai & Terverifikasi (tsc 0, eslint 0, `npm test` **130 file / 1034 test PASS** +3 test forceSkip, E2E browser hello hijau); **renumber #156 → #161 saat integrasi main**, rilis digabung ke **v1.3.41**. Deploy `87f82f7d` (klaim LIVE lama) **di-rollback** ke `d16af178`; deploy ulang v1.3.41 menyusul

## Permintaan Owner

1. _"loader animasi hello apa bisa dimasukan sebagai opsi pilihan?"_ — di app admin **Loader**, owner ingin pilihan gaya: **Deck Reveal** ATAU **Hello** (animasi lottie HELLO, fitur v1.3.36).
2. Klarifikasi lewat diskusi: _"loader/booting animasi bisa dipilih di CRUD admin panel — hello lottie atau deck-reveal — **untuk semua template**"_: pilihan gaya harus berlaku di ketiga template.

## Masalah "HELLO dobel" & Keputusan Desain

Template **spatial-gallery** (`<HelloIntro ready={sceneReady} />`) & **infinite-canvas** (`<HelloIntro />`) sudah punya intro HELLO bawaan (v1.3.36). Tanpa penanganan, gaya Hello bisa menghasilkan HELLO 2×, dan gaya Deck Reveal menghasilkan "Deck Reveal lalu HELLO" (dua boot berturut).

**Aturan main yang disepakati — app Loader = pemilik satu-satunya animasi booting saat aktif:**

| Template | Gaya Hello | Gaya Deck Reveal | Loader mati |
|---|---|---|---|
| os-desktop | Gate putar HELLO (sekali per sesi) | Gate putar deck | StartScreen bawaan |
| infinite-canvas | Intro bawaan memutar (gate diam) — visual identik, tanpa dobel | Gate putar deck; intro bawaan **disenyapkan** | Intro bawaan (v1.3.36) |
| spatial-gallery | sama — intro bawaan + penjagaan `ready` scene 3D **dipertahankan** (anti layar hitam) | sama — intro bawaan disenyapkan | Intro bawaan (v1.3.36) |

Kunci desain: **gaya hello tidak perlu suppress apa pun** (gate diam di template ber-intro bawaan; bawaan yang main), sedangkan **gaya deck-reveal menyenyapkan intro bawaan** via prop baru `suppressIntro` (keputusan server-side di `page.tsx` — tanpa race flag runtime, tanpa mengubah perilaku saat loader mati).

## Perubahan

1. **Tipe & zod:** `LoaderStyle = 'deck-reveal' | 'hello'` (`src/types/about.ts` — komentar field deck-reveal-specific diperjelas); `style: z.enum(['deck-reveal', 'hello'])` di `loaderConfigSchema` (`adminCrud.ts`). `.strict()` dipertahankan; `imageProjectIds` tetap wajib (array kosong untuk hello).
2. **`HomepageLoaderGate`:** dynamic import `HelloIntro` (pola sama dengan `DeckRevealLoader`, ssr:false); prop baru `activeTemplateKey` (default `'os-desktop'`); cabang: `style==='hello'` + bukan os-desktop → `null` (intro bawaan yang main); hello + os-desktop → `<HelloIntro />` **tanpa syarat gambar**; deck-reveal tak berubah. Guard sesi (`portfolio_loader_played`) dipakai gaya apa pun.
3. **`page.tsx`:** `loadAboutData` dipindah ke atas (sebelum renderer dihitung); `suppressIntro = loaderConfig?.enabled === true && style === 'deck-reveal'` dioper ke kedua renderer; `activeTemplateKey` dioper ke gate.
4. **2 renderer** (`InfiniteCanvasRenderer`, `SpatialGalleryRenderer`): prop opsional `suppressIntro` (default `false`) → `{!suppressIntro && <HelloIntro … />}`. Satu baris + komentar per file; `TemplateRendererProps` tidak diubah (intersection lokal).
5. **`HelloIntro`:** `data-testid="hello-intro"` di root div (nol perubahan perilaku — untuk keperluan test).
6. **`LoaderManagerForm`:** kartu pilih gaya (Deck Reveal/Hello, ikon Layers/Sparkles); saat Hello: sembunyikan slider durasi, color picker, toggle counter, pemilih gambar; tampilkan catatan (durasi/warna mengikuti animasi bawaan; spatial/canvas pakai intro bawaan, tidak dobel). Nilai lama deck-reveal tetap tersimpan di state saat ganti gaya.
7. **Test:** +1 zod (`accepts hello style`); +4 gate (hello×os-desktop tampil tanpa syarat gambar + flag sesi terisi; hello×spatial-gallery & hello×infinite-canvas → gate diam; hello hanya sekali per sesi). Mock `HelloIntro` ditambahkan di test gate.

## File yang Dimodifikasi

- `src/types/about.ts`, `src/lib/validations/adminCrud.ts`
- `src/components/shared/HomepageLoaderGate.tsx`, `src/components/shared/HelloIntro.tsx` (testid saja)
- `src/app/page.tsx`
- `src/components/templates/infinite-canvas/InfiniteCanvasRenderer.tsx`, `src/components/templates/spatial-gallery/SpatialGalleryRenderer.tsx` (prop `suppressIntro` — **satu-satunya** sentuhan template, otorisasi owner via permintaan "untuk semua template")
- `src/app/admin/system/components/LoaderManagerForm.tsx`
- `src/components/shared/__tests__/HomepageLoaderGate.test.tsx`, `src/lib/validations/__tests__/adminCrud.test.ts`
- `src/lib/constants.ts` (`APP_VERSION` → 1.3.41), `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md`

## Bug Check (audit jujur, tanpa halusinasi)

- **Race flag runtime — ditemukan saat desain, dicegah:** rencana awal menyenyapkan intro bawaan via flag runtime (`sessionStorage`) berisiko salah urutan (efek komponen dalam jalankan duluan vs gate) → dobel. Diganti keputusan **server-side** `suppressIntro` di `page.tsx` — deterministik, tanpa race.
- **Default `activeTemplateKey`:** tanpa default, gate hello diam juga di os-desktop (karena `undefined !== 'os-desktop'`) → default `'os-desktop'` di destructuring, konsisten dengan fallback `page.tsx`.
- **Indentasi fragment ternary di form** hanya kosmetik (JSX valid, lint/lolos) — tidak dirapikan agar diff minimal.
- **Perilaku lama utuh:** `suppressIntro` default `false` → saat loader mati, ketiga template persis seperti sebelumnya (v1.3.37/v1.3.36).
- Tidak ada perubahan skema DB/endpoints; `about.json` fallback tetap `style: 'deck-reveal'`.

## Verifikasi

- `npx tsc --noEmit` → **0 error**; ESLint 10 file tersentuh → **0 error, 0 warning**.
- `npm test` → **129 file / 1031 test PASS** (gate 11 test — 4 baru; zod loaderConfig 8 test — 1 baru).
- Browser E2E (flip sementara `STOREFRONT=false` + config hello dipaksa, keduanya **sudah direvert**): polling DOM 12× @900ms menangkap `[data-testid=hello-intro]` + lottie SVG **hidup terus-menerus t+0–t+4s** lalu hilang setelah fade ~6.7s (sekali per sesi — flag terisi); screenshot `scratch/loader-hello-homepage.png` memperlihatkan animasi HELLO oranye fade-out di atas homepage os-desktop nyata. Catatan artefak: pada muat pertama setelah dev server restart, eval di +1.5s sempat melihat `helloIntro: false` — itu latensi kompilasi chunk dynamic `HelloIntro` (belum pernah masuk graph chunk os-desktop), **bukan bug**; muat kedua (chunk ter-compile) langsung tampil.
- **Rilis digabung ke v1.3.41** (merge main — nomor 1.3.38 lama tabrakan); deploy dijalankan dari main.

## Handoff / Catatan Owner

- **Dibatalkan:** deployment `87f82f7d-330c-454b-823f-5522aabea7b4` (2026-10-12) **di-rollback** ke `d16af178` (v1.3.39) karena tree ber-base lama kehilangan main v1.3.37–1.3.39; rilis final = **v1.3.41** (deploy menyusul setelah merge ke main).

- Mengaktifkan: admin → **Tampilan → Loader Animasi** → enable → pilih gaya **Hello** atau **Deck Reveal** → simpan.
- Catatan UX: dengan loader aktif, animasi boot tampil **sekali per sesi** (reload dalam sesi sama tidak mengulang) — konsisten untuk kedua gaya; di spatial/canvas gaya Hello, intro bawaan tetap tampil setiap penuh-load halaman (perilaku v1.3.36 yang sudah ada).

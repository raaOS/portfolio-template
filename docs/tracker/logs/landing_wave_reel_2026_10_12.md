# Landing Storefront: Wave Reel 1 Section (v1.3.40)

_Tanggal: 2026-10-12/13 · Status: ✅ Selesai & Terverifikasi_

## Latar & Sasaran

Homepage deployment storefront (`STOREFRONT=true`, hanya `isStorefrontDeployment()`) diganti total menjadi **satu section "wave reel"** terinspirasi <https://saurow-reel.vercel.app/>:

- Nav (logo + harga + tombol **Pesan** selalu terlihat) → **satu pinned reel section** (runway ~380vh desktop / 300vh mobile, inner `position: sticky`) → mini footer (harga, Pesan, `/syarat-ketentuan`, `/kebijakan-privasi`, © tahun).
- Section "Fitur Utama" + grid statis lama dihapus.
- 3 kartu demo template berisi **iframe live** (bukan poster) bergeser horizontal pada pita tak terbatas digerakkan scroll vertikal; **gelombang (wave) mengikuti kecepatan scroll**, diam saat scroll berhenti.
- Klik kartu → popup: **Live Preview** (buka `/preview/<slug>` di tab baru) dan **Pesan** (WhatsApp `wa.me` dengan prefill; nomor kosong → fallback `/checkout`).
- Deployment situs klien (non-storefront) **tidak terpengaruh**.

## Keputusan Desain Kunci

| Keputusan | Alasan |
|---|---|
| DOM + CSS 3D transform, **bukan WebGL/R3F** | WebGL tidak bisa menampilkan isi iframe live sebagai tekstur |
| Scroll native + lerp internal (tanpa Lenis/SmoothScroll) | tanpa dependency baru, hindari konflik pustaka scroll |
| "Pesan" = `wa.me` langsung dengan prefill (nama template + harga + link `/checkout` absolut) | owner memilih jalur pesan singkat; trade-off: pesan langsung tidak terekam sebagai order |
| Nomor WA disimpan di D1 `platform_settings` key `owner_whatsapp` (bukan env) | bisa diubah tanpa redeploy — lewat panel **Harga Jual** (owner-only) |
| `PRICE_PLACEMENT = { nav, footer, modal }` di puncak `LandingPage.tsx` | penempatan harga gampang diatur sesuai permintaan owner |
| Satu CSS var `--reel-scale` (0.36 / 0.48 ≥1600px / 0.30 768–1199px / 0.17 <768px / reduced-motion 0.29 & 0.20) | ukuran kartu & skala iframe ikut 1 variabel |
| Hanya 3 iframe (double-modulo wrap) + mount ditahan IntersectionObserver + `loading="lazy"` + `pointer-events:none` | beban berat tidak bersaing dengan paint pertama |
| Transform ditulis langsung ke `style` di rAF (tanpa `setState` per frame); loop berhenti saat idle/stage tersembunyi/`visibilitychange` hidden | jaga 60 fps |

## Backend (selesai & terverifikasi sebelum frontend)

- `src/lib/services/pricingConfigService.ts`: `normalizeWhatsappNumber` (digit murni 8–15), `getOwnerWhatsapp` (cache 60 dtk, **tidak pernah melempar**), `updateOwnerWhatsapp` (upsert), `clearOwnerWhatsappCache`.
- `src/app/api/admin/pricing/route.ts`: GET/PUT diperluas membaca/menulis `owner_whatsapp`.
- `src/lib/services/paymentConfigService.ts`: rantai fallback `owner_whatsapp` → `NEXT_PUBLIC_ADMIN_WA` → legacy `payment_config.adminWhatsapp` di `getPublicPaymentInfo()`. Endpoint `payment-config` tetap **tidak dihidupkan lagi** (dihapus 2026-10-09).
- `src/app/admin/desktop/panels/HargaPanel.tsx`: kartu input nomor WhatsApp.
- Test diperpanjang: `pricingConfigService.test.ts`, `route.test.ts`.

## File Frontend Baru / Diubah

Baru:
- `src/components/landing/reel/reelData.ts` — `REEL_TEMPLATES` + `buildOrderHref()` (sumber kebenaran link Pesan).
- `src/components/landing/reel/useReelMotion.ts` — mesin gelombang (scrollX lerp, velocity → amplitudo, double-modulo wrap, `applyFrame`, layout effect isomorfik, IO mount-gating).
- `src/components/landing/reel/ReelSection.tsx` — pinned section, counter `01/03`, hint.
- `src/components/landing/reel/TemplateModal.tsx` — popup (focus trap, Esc, scroll lock + kompensasi scrollbar).
- `src/components/landing/__tests__/reelData.test.ts` (5 kasus) & `useReelMotion.test.tsx` (4 kasus).

Diubah:
- `src/components/landing/LandingPage.tsx` (shell baru + `PRICE_PLACEMENT`), `src/components/landing/landing.css` (ditulis ulang; `.landing-doc`/`.landing-nav`/`.landing-logo`/`.landing-nav-link` **dipertahankan** untuk halaman legal), `src/app/page.tsx` (injeksi `basePrice` + `adminWhatsapp`, `revalidate 60`), plus 6 file backend di atas.

## Bug Yang Ditemukan & Diperbaiki Selama QA

1. **Baris `reel-foot` terpotong 60px di bawah viewport saat scrollY=0** — `.reel-stage` semula `top:0; height:100svh`; diperbaiki jadi `top: var(--nav-h); height: calc(100svh - var(--nav-h))`. Terverifikasi: stageTop=60, h1 top=94, foot top=846 (stage height 826).
2. **Kartu menumpuk di tengah pada frame pra-hydration** — ditambah fallback transform CSS `nth-child` di dalam `@media (prefers-reduced-motion: no-preference)`; posisi pra-JS vs pasca-JS terverifikasi selisih <1px (tanpa "snap").
3. **Komposisi scroll 0 ada lubang di tengah** — fase wrap diubah dari `(i - count/2)*stride` menjadi **`i * stride`**, sehingga selalu **kartu #1 di tengah** + dua kartu mengintip di pinggir; counter SSR `01/03` kini persis sama dengan hitungan JS (tidak ada kedipan).
4. **Harga hilang total dari nav di layar <560px** — diganti `font-size: 11px` (harga tetap tampil di layar pertama; ukuran mengecil, tidak hilang).

## Hasil Verifikasi (angka)

- `npx tsc --noEmit` → **TSC OK** (0 error).
- `npm run lint` → **bersih** (0 error).
- `npm test` → **131 file / 1044 test lulus** (9 test baru: 5 `reelData` + 4 `useReelMotion`).
- Catatan jujur: `orderService.test.ts` >1 kasus sempat gagal sekali lalu lolos — **flaky & pre-existing** (ikut gagal pada tree bersih via `git stash`), bukan akibat perubahan ini.
- Browser QA (localhost:3000, tab desktop 800px & wrapper iframe 1280/390px):
  - **FPS saat scroll 1,6 detik: 194 frame (≈60 fps), frame terlama 16,2 ms, 0 long frame (>32 ms)**.
  - Gelombang: `y` mencapai ±15–25 px, `rotateZ` hingga **5–7°** (MAX_TILT), kembali rata ±0 px dalam ±1,6 dtk setelah scroll berhenti.
  - Wrap pita mulus di kedua sisi (posisi x terverifikasi `0 / +493 / −493` di 800px dan `0 / +280 / −280` di 390px), counter ikut berganti.
  - Sticky: stageTop=60, height=826, foot=846, docH=3870.
  - Modal: terbuka (judul + `Rp 199.000`), fokus → tombol tutup, focus trap berputar (close → Pesan → Live Preview → close), `body.overflow:hidden` + `padding-right:15px` (tanpa lompat layout), `scrollY` tidak berubah; Esc menutup & fokus kembali ke pemicu.
  - Tombol modal: **Live Preview** → `/preview/os-desktop` `target=_blank rel=noopener noreferrer`; **Pesan** → `/checkout` (nomor WA belum diatur di D1 = fallback benar, dengan keterangan di popup).
  - Mobile 390×844: `--reel-scale 0.17`, kartu 245px, stride 280, stage 784px, foot 804px, h1 30px, nav 60px — harga + tombol Pesan **muat berdampingan** di nav (price x=212 w=58, tidak tumpang tindih).
  - Halaman legal `/syarat-ketentuan` & `/kebijakan-privasi`: `.landing-doc` + `.landing-nav` + link silang kedua halaman tampil benar.
  - `prefers-reduced-motion`: diverifikasi lewat **unit test** (hook tidak menulis transform & tidak menjalankan rAF, tapi iframe tetap mount; perpindahan ke reduced di tengah jalan membersihkan transform + membatalkan rAF) + blok CSS baris statis — **tidak ada tool emulasi media di harness**, jadi tidak diverifikasi visual.

## Catatan Lingkungan

- `.env.local` disalin dari repo utama (gitignored; `STOREFRONT=true`, `OWNER_MODE=true`, kredensial D1) supaya preview & D1 terbaca di worktree.
- **`git stash -u` saat QA sempat meracuni cache HMR dev server** (file untracked hilang sementara → halaman tersendat di loading + error `Failed to read source ... reelData.ts`). Solusi: restart dev server; halaman normal kembali.
- Error SSR `useLanguage must be used within LanguageProvider` muncul 8× **hanya di baris 30–48 log (jendela kompilasi pertama server)**; 5 request isolasi (`/`, 3 preview, `/` lagi) menambah **0 error** → transien, bukan dari `LandingPage` (komponen ini tidak memakai `LanguageSwitch`).
- Artefak QA (`public/__qa-mobile.html`) sudah dihapus.

## Checklist Dokumen Wajib

- [x] `CHANGELOG.md` — entri baru di baris paling atas (v1.3.40).
- [x] Log ini.
- [x] Link di `docs/tracker/INDEX_TRACKER.md` (entri 158).

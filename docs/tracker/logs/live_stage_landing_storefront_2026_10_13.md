# Sprint: Redesain Storefront Panggung Demo Live (LiveStage) + Modal Konversi + Restyle "Sticker on Paper" + Split Latar 50/50 (2026-10-13 → 2026-10-14)

**Status:** 🟢 Selesai — diverifikasi lokal (tsc/lint/test) + QA browser (`localhost:3000`) pass (**v1.3.41**).  
**Permintaan Owner:** _"mengubah tampilan dan isi dalam halaman utama desain ui/uxnya total... 3 template demo dalam 1 section... saat diklik popup ada live preview dan pesan (WhatsApp/checkout)"_ → revisi keputusan owner sepanjang sprint:

1. _"aku pilih gemini tapi ubah ke iframe web live"_ — isi kartu wajib demo hidup, bukan gambar statis.
2. _"aku gak mau gambar statis mau dinamis seperti iframe live web"_ → isi kartu = iframe `/preview/[template]`, bukan screenshot.
3. _"apa gak perlu ada efek scroll aja buat normal aja dah"_ → halaman normal **100vh tanpa scroll**, tanpa runway/sticky.
4. **Versi pita silinder (TiltedGridHero) DITOLAK owner:** _"aku tidak suka efek iframe live web yg berputar"_ → efek `rotateY` silinder dibuang total.
5. _"tapi apa mengedepankan selera aku? yg mengedepankan estetik, playful, smooth animation, dan benci namanya kaku dan statis"_ → keputusan akhir: **Live Stage** — kartu tengah besar + 2 kartu samping, gerak ambient (float/parallax) + tukar posisi FLIP-spring; estetik-playful-smooth tanpa putaran.
6. **Hapus hero + hub bawah** (owner kirim screenshot kedua blok lalu bilang _"hapus"_, dikonfirmasi _"semua yg kamu sebut"_): judul `PORTFOLIO OS` + tagline, spotlight hub (badge/nama/sub + tombol "Pilih Template"), pill 01–03, teks panduan, dan baris harga **dibuang semua**. Halaman jadi navbar + panggung saja; h1 dipertahankan `sr-only` (SEO/a11y); jalur konversi = klik kartu tengah → popup + CTA nav "Pesan Template".
7. **Iframe "numpuk" (elemen tumpang tindih, parah di HP)** — owner: _"kenapa kalau live web iframe jadi numpuk, aslinya gak? apalagi mode hp numpuk banget"_ → akar: iframe dirender **seukuran kartu** (720×405 desktop, ~335×188 HP) sehingga halaman demo mendapat viewport kecil → layout responsifnya berantakan (icon menimpa window, dock ketimpa). Fix: iframe kembali dirender pada **viewport desain tetap 1440×810** + `transform: scale(--fit)` (`--fit` = lebar kartu/1440, diukur mount + resize di `LiveStage`) → demo selalu melihat desktop 1440px, tata letak **identik seperti aslinya** di semua ukuran kartu.
8. **Media popup ganti iframe live** — owner (screenshot popup): _"bisa gak gambar mockup itu di ganti iframe live web, pastikan tidak numpuk di semua mode device & responsive isi dalamnya"_ → `<Image>` mockup di `.wave-modal-media` diganti iframe `/preview/[id]` dengan pola `--fit` yang sama (1440×810 → scale ke lebar media, diukur mount + resize di `TemplateDetailModal`); `pointer-events: none` (scroll/tutup modal aman; interaksi penuh via tombol Live Preview). Mockup statis dibersihkan: field `imageUrl` di `TemplateItem` + 3 file `public/images/mockup-*.jpg` **dihapus**.
9. **Restyle visual "Sticker on Paper" (2026-10-14)** — owner kirim logo **MAKE IT BETTER STUDIO**: _"warna skrng aku gak suka... jujur aku suka minimalis tapi pop fun... aku gak suka desain ai slop, banyak gradasi, icon emoji, glow... tidak terlihat web site seorang Desain Grafis"_. Owner memilih **Opsi A "Sticker on Paper"** + tepi **"bersih tanpa bayangan"** (dari 3 opsi yang ditawarkan): kertas off-white, biru electric + hijau acid dari logo, **border hairline 1px tanpa shadow**; aturan keras nol gradient / nol glow / nol `backdrop-filter` / nol emoji; font display **Archivo Black** untuk brand/judul popup/harga.
10. **Split latar 50/50 (2026-10-14)** — owner (mock screenshot): _"aku pengen seperti ini warnanya setengah putih setengah biru, di tengah-tengah itu iframe live web"_ → latar viewport dibagi **tepi keras lurus persis di 50%**: atas kertas off-white, bawah biru logo `#0008FF`; panggung demo live tetap di tengah menembus garis split. Dibuat via pseudo-element `.wave-landing-viewport::after` (`inset: 50% 0 0 0`, blok datar `var(--wr-accent)`) — **bukan gradient** (konsisten aturan anti-AI-slop).
11. **Seluruh biru diseragamkan ke `#0008FF` (2026-10-14)** — owner: _"semua code biru pakai #0008FF"_ → semua kode biru storefront (`--wr-accent`, `--wr-border-hover`, ikon `Sparkles` nav, tint latar `.wave-modal-guarantee`, latar bawah split) diseragamkan ke **`#0008FF`** (rgb 0,8,255 — kontras putih-di-biru **~8,5:1 AAA**, sedikit lebih tinggi dari biru lama `#1b1bff`); klaim kontras di CHANGELOG/INDEX ikut dikoreksi 7,9:1 → 8,5:1.

---

## 1. Analisis & Keputusan Arsitektur

### Riwayat implementasi dalam sprint ini

1. **Gelombang v1 — WebGL (Three.js/R3F), `WaveReel*`:** WebGL hanya bisa memuat gambar/video statis — iframe mustahil jadi tekstur → kartu mockup JPG → ditolak owner ("mau iframe live web").
2. **Gelombang v2 — DOM + CSS 3D (dihapus):** mesin scroll `reel/*` — QA temukan animasi kaku, iframe kebesaran, stack macet setelah scroll → owner: "ganti total dan hapus bersih".
3. **Gelombang v3 — `TiltedGridHero` silinder (dihapus):** fork iframe tile datar pada baris `rotateY` melengkung, gerak CSS keyframes. Lolos semua test/QA, tapi **ditolak owner: "tidak suka efek berputar"**.
4. **FINAL — `LiveStage` (panggung kartu, tanpa putaran):** satu kartu besar tengah (demo aktif) + dua kartu samping mengecil/redup di kiri-kanan (polos di belakang kartu tengah), **semua menghadap lurus depan — nol rotateY**. Kehidupan datang dari: ambient float (sine ±7px, fase beda per kartu), mouse parallax (translate murni), tukar posisi **FLIP-spring** `cubic-bezier(0.34,1.56,0.64,1)` 520ms (efek jelly overshoot), entrance stagger, badge chip-ink + titik hijau acid "live" berdenyut. (Glow biru-ungu `.live-stage::before` sempat ada di batch pertama, lalu **dihapus** pada restyle poin 9.)

### Iframe SELALU dirender pada viewport desain 1440×810 + `--fit` (keputusan teknis kunci)

Meskipun kartu tengah berukuran asli `min(86vw, 720px)` 16:9, iframe **tidak** dirender `width/height: 100%` seukuran kartu: ia dirender tetap **1440×810** lalu `transform: scale(--fit)` dengan `--fit` = lebar slot/1440 (diukur saat mount + `resize`). Alasan (poin 7): bila iframe seukuran kartu, halaman demo "mikir" berjalan di jendela kecil → responsifnya berantakan & elemen **numpuk** (khususnya di HP). Dengan viewport desain tetap, demo selalu melihat desktop 1440px → tata letak identik seperti aslinya di ukuran kartu mana pun (berlaku juga untuk media popup, poin 8).

Trik coverflow tetap dipakai untuk slot: **lebar slot identik untuk ketiga kartu** (`var(--stage-card-w)`) dan dibedakan hanya lewat **transform** (`scale(0.6)` + `translateX(±46%)`) — karena semua animasi posisi/ukuran murni `transform`, tukar slot cukup dengan mengganti class → transisi beranimasi sendiri (FLIP), **tanpa penukar `src`, iframe tak pernah reload**.

### Parameter gerak

| Parameter | Nilai | Keterangan |
|---|---|---|
| Tukar slot (FLIP) | `cubic-bezier(0.34, 1.56, 0.64, 1)` 520ms | spring overshoot jelly; stagger `transition-delay` per slot 0/.08/.16s |
| Ambient float | `stageBob` 5.4s ease-in-out, `translateY(-7px)` | delay −1.8s / −3.6s → fase beda per kartu |
| Parallax | `--px/--py` × 10px/7px, `ease-out 0.5s` | translate murni (tanpa rotateY → tanpa pusing); diset dari `mousemove` (tanpa re-render) |
| Slot samping | `scale(.6)`, `x ±46%`, `opacity .55`, `brightness(.72) blur(1.2px)` | kesan kedalaman; z-index 2 (di belakang tengah z 3) |
| Entrance | `:not(.is-live) → scale(.82) opacity 0` | class `is-live` dipasang via DOM langsung di `useEffect` (lolos rule `react-hooks/set-state-in-effect`) |
| Reduced motion | `animation:none` + `transition:none !important` di `.stage-float`/`.stage-badge-dot`/`.stage-parallax`/`.stage-slot` + popup | panggung diam rapi, demo tetap hidup (selector `.live-stage::before` ikut dibuang karena glow sudah dihapus) |

### Performa (guardrail)

**Tepat 3 iframe live ter-mount** — dikunci test unit. Semua gerak = `transform`/`opacity` (kompositor, 60fps, nol layout thrash), **tanpa rAF, tanpa dependency baru, tanpa scroll-coupling**. Iframe `loading="lazy"` + `pointer-events:none` (zona klik = `<button>` terpisah ber-`aria-label`).

### Arah visual "Sticker on Paper" + split 50/50 (poin 9, 10 & 11)

| Token | Nilai | Peran |
|---|---|---|
| `--wr-bg` | `#f4f1ec` | kertas off-white (latar atas) |
| `--wr-card-bg` | `#ffffff` | kartu demo, nav pill, popup |
| `--wr-border` | `rgba(11,11,15,.16)` | hairline ink (semua tepi 1px, **tanpa bayangan** — pilihan owner) |
| `--wr-text-primary` / `--wr-text-secondary` | `#0b0b0f` / `#5a5a66` | teks utama / sekunder (~6,8:1 di putih) |
| `--wr-accent` | `#0008FF` | biru tunggal (instruksi owner poin 11) — CTA nav, Pesan Sekarang, harga, subtitle, ikon, **latar bawah split** |
| `--wr-pop-green` | `#38f538` | hijau acid logo — **khusus** titik "live" & chip "Paling Populer" (teks hitam = cetak keycap); bukan untuk teks |

Dihapus total: `--wr-accent-glow`, `--wr-wa-green`, 3 radial-gradient `.wave-stage`, glow `.live-stage::before` + `@keyframes stageGlow`, semua `box-shadow`, semua `backdrop-filter` (nav/pill/badge/close/backdrop), linear-gradient `.wave-btn-order`, overlay gradient media popup (tepi jadi keras/datar), sisa warna sky `#38bdf8`, emoji `✨`. Font **Archivo Black** (`next/font`, variabel `--font-brand`, `font-synthesis:none`) dipakai di `.wave-brand-title` / `.wave-modal-title` / `.wave-modal-price`.

**Split 50/50 (poin 10):** `.wave-landing-viewport::after { inset: 50% 0 0 0; background: var(--wr-accent) }` — blok datar, tepi keras lurus di tengah viewport. Painting order: pseudo `z-index:auto` (0) → **di bawah** `.live-stage` (z 5, panggung & kartu) dan `.wave-nav-floating` (z 25), di atas latar kertas; `pointer-events:none` agar zona klik tak terganggu. Tidak ada elemen interaktif di bawah panggung yang tertutup biru.

---

## 2. File yang Dibuat, Dimodifikasi, Dihapus (versi final)

| File Path | Tindakan & Penjelasan |
|---|---|
| `src/components/landing/LiveStage.tsx` | **BARU** — panggung 3 demo live: slot kelas (`is-center/left/right`) via `slotOf()` (tengah = `activeIndex`, kiri = active−1, kanan = active+1), ref `stageRef` + `classList.add('is-live')` untuk entrance, `handleMouseMove` men-set `--px/--py` di node (bukan setState), **`--fit` = lebar slot/1440 diukur saat mount + `resize`** (iframe 1440×810 → pas selebar kartu), iframe + zona klik `<button>` + badge nama demo di kartu aktif. |
| `src/components/landing/__tests__/live-stage.test.tsx` | **BARU** — 5 test: **guardrail 3 iframe + src tak pernah berubah saat slot bertukar**, tepat 1 `is-center`, rotasi slot saat `activeIndex` pindah, klik samping → `onActiveChange(i)` / klik tengah → `onActivate(i)`, `is-live` + label aksesibel + badge hanya di kartu aktif. |
| `src/components/landing/LandingPage.tsx` | Chrome Gemini dipertahankan **sebagian**: nav melayang + CTA "Pesan Template" saja; `<TiltedGridHero>` → `<LiveStage>`; **hero `PORTFOLIO OS` + tagline, footer hub (spotlight/"Pilih Template", pill 01–03, guide row, baris harga) DIHAPUS** — h1 tetap ada `sr-only`; state `hoveredTemplate/displayedTemplate` dibuang; klik kartu tengah → `setSelectedTemplate`. Restyle: root `main` membawa `archivoBlack.variable` (font brand untuk nav/judul popup/harga); ikon `Sparkles` nav `text-sky-400` → `text-[#0008FF]`. |
| `src/components/landing/landing.css` | Blok `.wave-band` **diganti** blok panggung: `.live-stage`, `.stage-parallax`, `.stage-slot` (custom props `--slot-x/s/o/z` + spring transition), `.stage-float` (`stageBob`), `.stage-card/iframe/hit/badge` + keyframes `stageBob/Pulse`; blok reduced-motion mematikan seluruh gerak ambient. **Blok hero (`wave-hero-*`), hub (`wave-bottom-*`, `wave-indicator-*`, `wave-inspect-btn`, `wave-pill-*`, `wave-guide-*`, keyframes `wavePulse`) + aturan responsifnya DIHAPUS**; slot dipusatkan `top:50%`. **Restyle Sticker on Paper (poin 9):** `:root` token baru (kertas/putih/ink/biru/hijau), **gradient `.wave-stage` + glow `.live-stage::before` + `stageGlow` dihapus**, semua `box-shadow`/`backdrop-filter`/linear-gradient dihapus → tepi hairline 1px tanpa bayangan, badge = chip ink (dot hijau tanpa glow), nav/pill/CTA flat (CTA biru → hover ink), popup kartu putih + backdrop flat `rgba(11,11,15,.6)`, tombol flat (preview border / order biru / WA hijau gelap `#15803d` demi kontras), `.wave-modal-media-overlay` **dihapus**, judul/harga/brand pakai `var(--font-brand)`. **Split 50/50 (poin 10):** `.wave-landing-viewport::after` blok `var(--wr-accent)` `inset:50% 0 0 0` (tepi keras di tengah, di bawah panggung z5 & nav z25). **Biru diseragamkan (poin 11):** `--wr-accent`/`--wr-border-hover` = `#0008FF`, tint garansi `rgba(0,8,255,…)`. Viewport tetap normal `100vh/100svh; overflow:hidden`. |
| `src/app/fonts.ts` | **+Archivo Black** (`variable: '--font-brand'`, `preload:false`, `display:swap`) — dipakai brand nav, judul popup, harga. |
| `src/components/ui/tilted-grid-hero.tsx` | **DIHAPUS** — komponen silinder `rotateY` (ditolak owner: "tidak suka efek berputar"). |
| `src/components/ui/__tests__/tilted-grid-hero.test.tsx` | **DIHAPUS** — 5 test lama ikut dibuang (dir `ui/__tests__` ikut kosong → dihapus). |
| `src/components/landing/templates.ts` | **RENAME** dari `waveReelTypes.ts` (katalog 3 template — sumber kebenaran); field **`imageUrl` dihapus** (mockup tak terpakai setelah popup pakai iframe live). |
| `src/components/landing/TemplateDetailModal.tsx` | Import → `./templates`; **media preview diganti iframe live** (`/preview/[id]`, 1440×810 + `--fit` diukur mount/resize dari `.wave-modal-media`, `pointer-events:none`, `key=template.id`) — `<Image>` mockup + import `next/image` dihapus; **div overlay gradient `.wave-modal-media-overlay` dihapus** (tepi keras) + **emoji `✨` baris garansi dibuang**; 3 jalur konversi tidak diubah: Live Preview (`/preview/[id]` tab baru), Pesan Sekarang (`/checkout?template=`), Tanya via WhatsApp (prefill `adminWhatsapp`). |
| `public/images/mockup-os-desktop.jpg`, `mockup-infinite-canvas.jpg`, `mockup-spatial-gallery.jpg` | **DIHAPUS** — aset gambar statis mantan media popup (satu-satunya pemanggil `imageUrl`). |
| `src/components/landing/reel/*` + `__tests__/useReelMotion.test.tsx` | **DIHAPUS** — mesin gelombang-scroll v2. |
| `src/components/landing/WaveReelCanvas/Scene/Mesh/Shader.ts` | **DIHAPUS** — arsip WebGL v1. |
| `src/app/page.tsx` | (dari v1) mengalirkan `basePrice` + `adminWhatsapp` ke `LandingPage` pada mode storefront, ISR 60 dtk — tidak berubah sprint ini. |
| `src/lib/constants.ts` | `APP_VERSION = 1.3.41` (wajib selaras dengan entri CHANGELOG teratas). |
| **Backend nomor WA (port dari worktree)** | |
| `src/lib/services/pricingConfigService.ts` (+`.test.ts`) | `getOwnerWhatsapp`/`updateOwnerWhatsapp`/`normalizeWhatsappNumber` — key D1 `owner_whatsapp`, cache 60 dtk, fallback env `NEXT_PUBLIC_ADMIN_WA`. |
| `src/app/api/admin/pricing/route.ts` (+`.test.ts`) | GET/PUT kini membawa `adminWhatsapp` (field opsional, minimal satu field). |
| `src/lib/services/paymentConfigService.ts` | `getPublicPaymentInfo().adminWhatsapp` = `owner_whatsapp` → env → legacy `payment_config`. |
| `src/app/admin/desktop/panels/HargaPanel.tsx` | Kartu "Nomor WhatsApp owner" di panel Harga Jual — ganti nomor tanpa deploy. |
| `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md` | Entri **[1.3.41]** & #159 ditulis ulang sesuai implementasi akhir (Live Stage + popup iframe live + restyle Sticker on Paper + split 50/50 + biru `#0008FF`). |

---

## 3. Hasil Verifikasi

- **TypeScript:** `npx tsc --noEmit` → **0 errors** (dijalankan ulang sesudah restyle).
- **Lint:** `npm run lint` → bersih (0 error, 0 warning). *Catatan:* `setLive(true)` di `useEffect` kena rule `react-hooks/set-state-in-effect` → diganti `stageRef.current?.classList.add('is-live')` (mutasi DOM, tanpa render berantai).
- **Test komponen:** vitest `live-stage.test.tsx` → **5/5 PASS** (guardrail 3 iframe + src stabil) + `template-detail-modal.test.tsx` → **4/4 PASS**.
- **Test Suite Repo:** `npm test` → **131 file / 1047 tests PASS** (dijalankan 5×: sebelum hapus hero+hub, sesudahnya, sesudah popup ganti iframe live, sesudah restyle Sticker on Paper, & sesudah split 50/50 — semuanya hijau).
- **QA Browser** (`localhost:3000`) — kondisi akhir:
  - **Desktop 1266×569 / 1440×900:** `h1` = **1** (`sr-only`, "PORTFOLIO OS"), hero/hub tidak ada, nav + CTA ada, 3 iframe live, `docH = clientH` → **tanpa scroll**. Klik kartu samping → slot bertukar dengan spring; klik kartu tengah → popup.
  - **Anti-numpuk `--fit` (fix poin 7):** desktop kartu 720px → `--fit = 0.5`; HP 390px → kartu 335px → `--fit ≈ 0.2326`; **`contentWindow = 1440×810` di KEDUA ukuran**.
  - **Popup media = iframe live (fix poin 8):** desktop media 658px → `--fit 0.457`; HP media 348px → `--fit 0.242`; **`contentWindow = 1440×810` di kedua ukuran**, `<img>` mockup tidak ada; konten mengalir & scrollable.
  - **Restyle "Sticker on Paper" (poin 9):** computed style desktop — latar `rgb(244,241,236)`, `--font-brand` = `"Archivo Black"` (aktif di nav brand & judul/harga popup, `font-synthesis:none`), CTA **`rgb(0,8,255)`** **`box-shadow:none`**, kartu putih border 1px `rgba(11,11,15,.16)` **shadow none**, badge chip `rgb(11,11,15)` + dot `rgb(56,245,56)` **tanpa glow**, `.wave-stage` `background-image:none`. Popup — backdrop `rgba(11,11,15,.6)` **`backdrop-filter:none`**, kartu putih shadow none, badge hijau `rgb(56,245,56)` teks ink, overlay gradient **tidak ada**, tombol Pesan Sekarang biru solid shadow none, garansi tanpa emoji. Kontras: putih-di-biru `#0008FF` **~8,5:1 (AAA)**, hitam-di-hijau ~12:1, sekunder-di-putih ~6,8:1 (AA).
  - **Split 50/50 (poin 10):** computed `::after` → `top: 450px` @1440×900 & `422px` @390×844 (**= tepat 50%**), `background: rgb(0,8,255)`; `elementsFromPoint(720,700)` (di dalam kartu, di bawah garis) → `stage-parallax` → **panggung di atas blok biru**; `docH = clientH` tetap; screenshot desktop & HP: tepi keras lurus persis di tengah, iframe live menembus split, nav tetap di kertas.
  - **Biru tunggal `#0008FF` (poin 11):** grep seluruh repo (`src/` + docs) → **nol sisa `#1b1bff`/`rgb(27,27,255)` di kode & dokumen aktif** (sisa rujukan hanya di log ini sebagai catatan migrasi poin 11); computed CTA & split = `rgb(0,8,255)`, tint garansi `rgba(0, 8, 255, 0.05)`; icon Sparkles `text-[#0008FF]`.
  - **Mobile 390×844:** kartu tengah 335px, `scrollH = clientH = 844` (tanpa scroll), popup mengalir + tombol 1 kolom + scrollable; screenshot desktop & HP bersih.
  - **Reduced-motion (emulasi `set media reduced-motion`):** `animation-name: none` (float & denyut), `transition-duration: 0s` (slot), `parallax transform: none` — panggung diam rapi, 3 iframe tetap hidup.
  - **Escape:** modal tertutup + `body.overflow` dilepas + 3 iframe panggung tetap hidup ✓.
- **Bug QA yang diperbaiki saat sprint:** (1) quote baris `import { cn }` rusak saat write file → tsc TS1002 (v3 silinder); (2) `animation-play-state:paused` kalah specificity dari shorthand inline → `!important` (v3 silinder); (3) ekspektasi slot salah di test baru (kiri = active−1, bukan urutan array); (4) `setState` di effect kena lint `react-hooks/set-state-in-effect` → `classList.add` langsung; (5) QA Escape sempat "gagal" karena event di-dispatch tanpa `bubbles:true` (listener di `window`) — salah teknis QA, bukan bug produk; ulangi dengan bubbles → tutup normal.

> Catatan commit: batch pertama (LiveStage + hapus hero/hub + backend WA + docs) = `a1639ea`. Batch 2 (fix `--fit` 1440×810, popup ganti iframe live + hapus mockup, restyle "Sticker on Paper", split 50/50, biru `#0008FF`, docs di atas) di-commit 2026-10-14 atas perintah owner ("rapihkan commit"). Pada kesempatan yang sama, commit loader milik sesi lain (`5423fee`, base v1.3.36, worktree `calm-otter`) di-cherry-pick ke atasnya: entri tracker loader **renumber #159/#160 → #160/#161** (nomor #159 sudah dipakai LiveStage), dua entri CHANGELOG loader digabung ke entri `[1.3.41]` yang sama, dan pesan commit loader ikut dikoreksi. Verifikasi gabungan: `tsc --noEmit` 0, ESLint 0, suite penuh PASS.

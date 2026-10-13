# Sprint: Redesain Storefront Panggung Demo Live (LiveStage) + Modal Konversi (2026-10-13)

**Status:** 🟢 Selesai — diverifikasi lokal (tsc/lint/test) + QA browser (`localhost:3000`) pass (**v1.3.41**).  
**Permintaan Owner:** _"mengubah tampilan dan isi dalam halaman utama desain ui/uxnya total... 3 template demo dalam 1 section... saat diklik popup ada live preview dan pesan (WhatsApp/checkout)"_ → revisi keputusan owner sepanjang sprint:

1. _"aku pilih gemini tapi ubah ke iframe web live"_ — isi kartu wajib demo hidup, bukan gambar statis.
2. _"aku gak mau gambar statis mau dinamis seperti iframe live web"_ → isi kartu = iframe `/preview/[template]`, bukan screenshot.
3. _"apa gak perlu ada efek scroll aja baut normal aja dah"_ → halaman normal **100vh tanpa scroll**, tanpa runway/sticky.
4. **Versi pita silinder (TiltedGridHero) DITOLAK owner:** _"aku tidak suka efek iframe live web yg berputar"_ → efek `rotateY` silinder dibuang total.
5. _"tapi apa mengambarkan selera aku? yg mengedepankan estetik, playful, smooth animation, dan benci namanya kaku dan statis"_ → keputusan akhir: **Live Stage** — kartu tengah besar + 2 kartu samping, gerak ambient (float/parallax) + tukar posisi FLIP-spring; estetik-playful-smooth tanpa putaran.
6. **Hapus hero + hub bawah** (owner kirim screenshot kedua blok lalu bilang _"hapus"_, dikonfirmasi _"semua yg kamu sebut"_): judul `PORTFOLIO OS` + tagline, spotlight hub (badge/nama/sub + tombol "Pilih Template"), pill 01–03, teks panduan, dan baris harga **dibuang semua**. Halaman jadi navbar + panggung saja; h1 dipertahankan `sr-only` (SEO/a11y); jalur konversi = klik kartu tengah → popup + CTA nav "Pesan Template".

---

## 1. Analisis & Keputusan Arsitektur

### Riwayat implementasi dalam sprint ini

1. **Gelombang v1 — WebGL (Three.js/R3F), `WaveReel*`:** WebGL hanya bisa memuat gambar/video statis — iframe mustahil jadi tekstur → kartu mockup JPG → ditolak owner ("mau iframe live web").
2. **Gelombang v2 — DOM + CSS 3D (dihapus):** mesin scroll `reel/*` — QA temukan animasi kaku, iframe kebesaran, stack macet setelah scroll → owner: "ganti total dan hapus bersih".
3. **Gelombang v3 — `TiltedGridHero` silinder (dihapus):** fork iframe tile datar pada baris `rotateY` melengkung, gerak CSS keyframes. Lolos semua test/QA, tapi **ditolak owner: "tidak suka efek berputar"**.
4. **FINAL — `LiveStage` (panggung kartu, tanpa putaran):** satu kartu besar tengah (demo aktif) + dua kartu samping mengecil/redup di kiri-kanan (polos di belakang kartu tengah), **semua menghadap lurus depan — nol rotateY**. Kehidupan datang dari: ambient float (sine ±7px, fase beda per kartu), mouse parallax (translate murni), tukar posisi **FLIP-spring** `cubic-bezier(0.34,1.56,0.64,1)` 520ms (efek jelly overshoot), entrance stagger, glow biru-ungu bernapas, badge "live" berdenyut.

### Kenapa iframe boleh besar dan tidak perlu discale (keputusan teknis kunci)

Di versi silinder, iframe dirender 1440×810 lalu di-scale turun (`--fit-*`) karena tile-nya kecil. Di Live Stage kartu tengah berukuran asli `min(86vw, 720px)` 16:9 → iframe cukup `width/height: 100%` **pada piksel aslinya** (lebih tajam, tanpa blur scale). Kartu samping memakai trick yang sama seperti coverflow: **lebar slot identik untuk ketiga kartu** (`var(--stage-card-w)`) dan dibedakan hanya lewat **transform** (`scale(0.6)` + `translateX(±46%)`) — karena semua animasi posisi/ukuran murni `transform`, tukar slot cukup dengan mengganti class → transisi beranimasi sendiri (FLIP), **tanpa penukar `src`, iframe tak pernah reload**.

### Parameter gerak

| Parameter | Nilai | Keterangan |
|---|---|---|
| Tukar slot (FLIP) | `cubic-bezier(0.34, 1.56, 0.64, 1)` 520ms | spring overshoot jelly; stagger `transition-delay` per slot 0/.08/.16s |
| Ambient float | `stageBob` 5.4s ease-in-out, `translateY(-7px)` | delay −1.8s / −3.6s → fase beda per kartu |
| Parallax | `--px/--py` × 10px/7px, `ease-out 0.5s` | translate murni (tanpa rotateY → tanpa pusing); diset dari `mousemove` (tanpa re-render) |
| Slot samping | `scale(.6)`, `x ±46%`, `opacity .55`, `brightness(.72) blur(1.2px)` | kesan kedalaman; z-index 2 (di belakang tengah z 3) |
| Entrance | `:not(.is-live) → scale(.82) opacity 0` | class `is-live` dipasang via DOM langsung di `useEffect` (lolos rule `react-hooks/set-state-in-effect`) |
| Reduced motion | `animation:none` + `transition:none !important` di `.stage-float`/`.live-stage::before`/`.stage-badge-dot`/`.stage-parallax`/`.stage-slot` | panggung diam rapi, demo tetap hidup |

### Performa (guardrail)

**Tepat 3 iframe live ter-mount** — dikunci test unit. Semua gerak = `transform`/`opacity` (kompositor, 60fps, nol layout thrash), **tanpa rAF, tanpa dependency baru, tanpa scroll-coupling**. Iframe `loading="lazy"` + `pointer-events:none` (zona klik = `<button>` terpisah ber-`aria-label`).

---

## 2. File yang Dibuat, Dimodifikasi, Dihapus (versi final)

| File Path | Tindakan & Penjelasan |
|---|---|
| `src/components/landing/LiveStage.tsx` | **BARU** — panggung 3 demo live: slot kelas (`is-center/left/right`) via `slotOf()` (tengah = `activeIndex`, kiri = active−1, kanan = active+1), ref `stageRef` + `classList.add('is-live')` untuk entrance, `handleMouseMove` men-set `--px/--py` di node (bukan setState), iframe + zona klik `<button>` + badge nama demo di kartu aktif. |
| `src/components/landing/__tests__/live-stage.test.tsx` | **BARU** — 5 test: **guardrail 3 iframe + src tak pernah berubah saat slot bertukar**, tepat 1 `is-center`, rotasi slot saat `activeIndex` pindah, klik samping → `onActiveChange(i)` / klik tengah → `onActivate(i)`, `is-live` + label aksesibel + badge hanya di kartu aktif. |
| `src/components/landing/LandingPage.tsx` | Chrome Gemini dipertahankan **sebagian**: nav melayang + CTA "Pesan Template" saja; `<TiltedGridHero>` → `<LiveStage>`; **hero `PORTFOLIO OS` + tagline, footer hub (spotlight/"Pilih Template", pill 01–03, guide row, baris harga) DIHAPUS** — h1 tetap ada `sr-only`; state `hoveredTemplate/displayedTemplate` dibuang; klik kartu tengah → `setSelectedTemplate`. |
| `src/components/landing/landing.css` | Blok `.wave-band` **diganti** blok panggung: `.live-stage` (+glow `stageGlow`), `.stage-parallax`, `.stage-slot` (custom props `--slot-x/s/o/z` + spring transition), `.stage-float` (`stageBob`), `.stage-card/iframe/hit/badge` + keyframes `stageBob/Glow/Pulse`; blok reduced-motion diperluas mematikan seluruh gerak ambient. **Blok hero (`wave-hero-*`), hub (`wave-bottom-*`, `wave-indicator-*`, `wave-inspect-btn`, `wave-pill-*`, `wave-guide-*`, keyframes `wavePulse`) + aturan responsifnya DIHAPUS**; slot & glow dipusatkan `top:50%`. Viewport tetap normal `100vh/100svh; overflow:hidden`. |
| `src/components/ui/tilted-grid-hero.tsx` | **DIHAPUS** — komponen silinder `rotateY` (ditolak owner: "tidak suka efek berputar"). |
| `src/components/ui/__tests__/tilted-grid-hero.test.tsx` | **DIHAPUS** — 5 test lama ikut dibuang (dir `ui/__tests__` ikut kosong → dihapus). |
| `src/components/landing/templates.ts` | **RENAME** dari `waveReelTypes.ts` (katalog 3 template — sumber kebenaran). |
| `src/components/landing/TemplateDetailModal.tsx` | Import → `./templates`; isi popup tidak diubah: Live Preview, Pesan Sekarang (`/checkout?template=`), Tanya via WhatsApp (prefill `adminWhatsapp`). |
| `src/components/landing/reel/*` + `__tests__/useReelMotion.test.tsx` | **DIHAPUS** — mesin gelombang-scroll v2. |
| `src/components/landing/WaveReelCanvas/Scene/Mesh/Shader.ts` | **DIHAPUS** — arsip WebGL v1. |
| `src/app/page.tsx` | (dari v1) mengalirkan `basePrice` + `adminWhatsapp` ke `LandingPage` pada mode storefront, ISR 60 dtk — tidak berubah sprint ini. |
| `src/lib/constants.ts` | `APP_VERSION = 1.3.41` (wajib selaras dengan entri CHANGELOG teratas). |
| **Backend nomor WA (port dari worktree)** | |
| `src/lib/services/pricingConfigService.ts` (+`.test.ts`) | `getOwnerWhatsapp`/`updateOwnerWhatsapp`/`normalizeWhatsappNumber` — key D1 `owner_whatsapp`, cache 60 dtk, fallback env `NEXT_PUBLIC_ADMIN_WA`. |
| `src/app/api/admin/pricing/route.ts` (+`.test.ts`) | GET/PUT kini membawa `adminWhatsapp` (field opsional, minimal satu field). |
| `src/lib/services/paymentConfigService.ts` | `getPublicPaymentInfo().adminWhatsapp` = `owner_whatsapp` → env → legacy `payment_config`. |
| `src/app/admin/desktop/panels/HargaPanel.tsx` | Kartu "Nomor WhatsApp owner" di panel Harga Jual — ganti nomor tanpa deploy. |
| `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md` | Entri **[1.3.41]** & #159 ditulis ulang sesuai implementasi akhir (Live Stage, bukan silinder). |

---

## 3. Hasil Verifikasi

- **TypeScript:** `npx tsc --noEmit` → **0 errors**.
- **Lint:** `npm run lint` → bersih (0 error, 0 warning). *Catatan:* `setLive(true)` di `useEffect` kena rule `react-hooks/set-state-in-effect` → diganti `stageRef.current?.classList.add('is-live')` (mutasi DOM, tanpa render berantai).
- **Test komponen:** vitest `live-stage.test.tsx` → **5/5 PASS** (termasuk guardrail 3 iframe + src stabil).
- **Test Suite Repo:** `npm test` → **130 file / 1043 tests PASS** (dijalankan 2×: sebelum & sesudah penghapusan hero+hub — tetap hijau).
- **QA Browser** (`localhost:3000`) — kondisi akhir setelah hapus hero+hub:
  - **Desktop 1266×569:** `h1` = **1** (`sr-only`, "PORTFOLIO OS", tidak terlihat visual), `.wave-hero-floating` & `.wave-bottom-floating` **tidak ada**, nav + CTA "Pesan Template" ada, 3 iframe live (slots `is-center/right/left`), `docH = clientH = 569` → **tanpa scroll**. Klik kartu samping (Spatial Gallery) → slot bertukar (`[right, left, center]`) dengan spring; klik kartu tengah → popup terbuka + `body.overflow=hidden`.
  - **Modal:** isi popup Spatial Gallery — Live Preview `/preview/spatial-gallery`, Pesan Sekarang `/checkout?template=spatial-gallery`, Tanya via WhatsApp `wa.me` prefill ✓; Esc menutup + scroll-lock dilepas ✓.
  - **Mobile 390×844:** kartu tengah `width = 335px` (86vw), `scrollH = clientH = 844` (tanpa scroll), nav ada, hub tidak ada, 3 iframe.
  - **Reduced-motion (emulasi `set media reduced-motion`):** `animation-name: none` (float & glow), `transition-duration: 0s` (slot), `parallax transform: none` — panggung diam rapi, 3 iframe tetap hidup.
- **Bug QA yang diperbaiki saat sprint:** (1) quote baris `import { cn }` rusak saat write file → tsc TS1002 (v3 silinder); (2) `animation-play-state:paused` kalah specificity dari shorthand inline → `!important` (v3 silinder); (3) ekspektasi slot salah di test baru (kiri = active−1, bukan urutan array); (4) `setState` di effect kena lint `react-hooks/set-state-in-effect` → `classList.add` langsung.

> Catatan: semua perubahan **belum di-commit** (permintaan owner: tanpa commit kecuali diminta).

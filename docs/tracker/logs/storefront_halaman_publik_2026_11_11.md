# Storefront: Halaman Jualan Nyata + Panduan Klien (v1.3.80, 2026-11-11)

## Keluhan awal

Owner: "di header atas project ini masih terasa sepi, tidak terlihat ada menu2 layaknya website jualan" — header beranda hanya brand + toggle Dot/Grid + satu tombol "Pesan Template".

## Diagnosis (terverifikasi di kode)

| Temuan | Bukti |
|---|---|
| Header cuma 3 elemen | `LandingPage.tsx` sebelum perubahan: brand, `.wave-pattern-switcher`, CTA |
| Beranda terkunci satu layar | `landing.css` `.wave-landing-viewport { height: 100svh; overflow: hidden }` |
| Tidak ada rute jualan | `src/app`: hanya `/`, `/checkout`, `/preview/[template]`, `/orders/[orderId]` |
| Halaman legal tak bergaya | `syarat-ketentuan/page.tsx` + `kebijakan-privasi/page.tsx` memakai `.landing`, `.landing-nav`, `.landing-doc`, `--lp-accent`, `--lp-muted` — **nol definisi** di seluruh `src/**/*.css` |

Keputusan owner: **Opsi C** (halaman terpisah + hero tetap), **tanpa tombol WhatsApp**, **Panduan Klien dibuat sekarang**.

## Perubahan

### Baru

- `src/components/landing/public-pages.css` — gaya halaman publik (`.lp-shell`, `.lp-nav`, `.lp-title`, `.lp-card`, `.lp-grid`, `.lp-steps`, `.lp-table`, `.lp-faq`, `.lp-doc`, `.lp-note`, `.lp-footer`). Palet "Sticker on Paper" sama dengan storefront.
- `src/components/landing/PublicChrome.tsx` — `PublicShell` (nav + footer). Tanpa state; tautan jualan disembunyikan saat `isStorefrontDeployment()` false (halaman legal tetap bisa dibuka di situs klien).
- `src/components/landing/PublicNav.tsx` — nav client (`usePathname`) berisi 3 tautan **lebar sama** + satu indikator putih yang bergeser (`--lp-active`).
- `src/app/(storefront)/layout.tsx` — layout route group agar nav tidak ter-unmount saat pindah halaman (syarat animasi geser).
- `src/app/(storefront)/fitur/page.tsx` - zona admin (Konten & Berkas, Tampilan, Komunikasi, Sistem) + media pipeline + batas jujur + CTA. Menggantikan katalog template: hero beranda sudah menjadi etalase demo, jadi `src/app/(storefront)/template/page.tsx` **dihapus** dan `/template` kini 404.
- `src/app/(storefront)/harga/page.tsx` — `getBasePrice()` (fallback `BASE_PRICE`), `revalidate = 300`, 4 isi paket, tabel biaya Cloudflare (termasuk catatan verifikasi kartu R2), 8 FAQ `#faq`.
- `src/app/(storefront)/cara-pesan/page.tsx` — 5 langkah + checklist persiapan pembeli + catatan R2 pending.
- `src/app/(storefront)/panduan/page.tsx` — panduan klien (login, konten, media, tampilan, kotak masuk, larangan hapus resource, kontak).

### Diubah

- `src/components/landing/LandingPage.tsx` — menu tengah `Fitur · Harga · Cara Pesan`, `.wave-nav-right` (toggle + CTA + burger), sheet HP (`menuOpen`), ikon `Menu`/`X`.
- `src/components/landing/landing.css` — gaya `.wave-nav-links/-link/-right/-burger/-sheet` + media query ≤900 px + sembunyikan sheet saat `body.mag-live-active`.
- `src/components/landing/public-pages.css` — `.lp-nav-links` jadi kontainer relatif + `.lp-nav-indicator` (geser 280 ms) + `.lp-nav-link` lebar tetap 104 px (≤640 px `flex: 1 1 0`).
- `src/app/syarat-ketentuan/page.tsx`, `src/app/kebijakan-privasi/page.tsx` — pindah ke `PublicShell` + `.lp-doc`; isi tidak diubah; title dipendekkan agar tidak dobel dengan template layout.
- `src/app/sitemap.ts` — 4 URL toko di dalam guard `isStorefrontDeployment()`.
- `src/app/orders/[orderId]/page.tsx` — tautan "Baca Panduan Klien" di banner `activated`.
- `src/lib/constants.ts` — `APP_VERSION` 1.3.79 → 1.3.80 (wajib sama dengan entri teratas CHANGELOG).

## Bug visual ditemukan saat verifikasi

Owner melaporkan teks di dalam pil nav tidak simetris.

- **Akar:** `globals.css` baris 266-275 memasang target sentuh WCAG `a, button, [role=button] { min-height: 44px; min-width: 44px }`. Anchor nav adalah flex item → blockified; tinggi dipaksa 44 px, sementara baris teks (line-height 18,75) menempel di atas. Terukur: box 44 px, teks 99–115 (9 px atas, 19 px bawah).
- **Perbaikan:** `display: inline-flex; align-items: center; justify-content: center; line-height: 1.2` pada `.wave-nav-link`, `.lp-nav-link`, `.wave-nav-sheet-link`, dan `.lp-footer a` (link footer juga flex item sehingga kena aturan yang sama).
- **Sesudah:** inset teks 13/13 px kiri-kanan, 13,2/13,8 px atas-bawah (sisa 0,6 px = metrik glyph, bukan padding).

## Verifikasi

- `npx tsc --noEmit` → 0 error.
- `npx eslint` 10 file berubah → bersih.
- `npx vitest run src/components/landing src/lib/services/orderService.test.ts src/app/api/admin/orders/route.test.ts` → **60/60 PASS**.
- Dev server: `/`, `/fitur`, `/harga`, `/cara-pesan`, `/panduan`, `/syarat-ketentuan`, `/kebijakan-privasi` semuanya **200**; `/template` **404** (halaman dihapus).
- HTML beranda memuat `wave-nav-links`, 3 `wave-nav-link`, `wave-nav-burger`, `wave-nav-sheet`; sheet terbuka benar (snapshot a11y: 3 link + CTA).
- Geometri nav diukur di Chromium (bukan asumsi): lihat tabel bug visual di atas.
- Pil nav baru: lebar **104/104/104 px** (sebelumnya 84,4/62,8/96); indikator `translateX` tertangkap di tengah animasi **148 px** menuju 208 px; node nav bertanda `data-probe` **masih ada** setelah `/fitur` → `/cara-pesan` (bukti layout tidak remount). Di `/syarat-ketentuan` (tidak ada tab aktif) indikator `opacity: 0`. Sitemap memuat `/fitur` dan **tidak lagi** `/template`.

## Catatan terbuka (jangan dianggap selesai)

- `/checkout` **tidak** memakai `isStorefrontDeployment()` (celah lama) dan belum menerima `?template=` (pemilihan template hanya di form checkout; katalog terpisah sudah dihapus).
- `/preview/*` tidak punya tautan balik ke storefront; semua tautan demo memakai `target="_blank"` supaya pengunjung tidak terjebak.
- Panduan Klien ikut 404 di situs klien (konsisten dengan gerbang storefront). Kalau nanti klien perlu membacanya dari domain sendiri, gating harus dipisah.

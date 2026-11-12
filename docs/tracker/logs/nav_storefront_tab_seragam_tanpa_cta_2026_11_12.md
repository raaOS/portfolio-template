# Nav Storefront: Hapus CTA "Pesan Template" + Tiga Tab Selebar Sama dengan Pil Geser (v1.3.83, 2026-11-12)

## Latar Belakang (permintaan owner)

> "hapus button pesan tampalte ini disemua halaman dan perbaikin 3 button menu (fitur,harga,cara pesan) buttonya tidak sama ukurannya dihalaman utama dan beri efek animasi slider saat pintah tab menu"

Lampiran owner: pil biru "Pesan Template ↗" di navbar.

## Yang Dikerjakan

### 1. CTA "Pesan Template" dihapus dari semua navbar

| Berkas | Yang dihapus |
|---|---|
| `src/components/landing/LandingPage.tsx` | `<div className="wave-nav-actions">` + `<Link className="wave-nav-cta">` (desktop), dan `.wave-nav-sheet-cta` di sheet burger; import `ArrowUpRight` tidak dipakai lagi |
| `src/components/landing/PublicChrome.tsx` | `<Link className="lp-nav-cta">` di `header.lp-nav` |
| `src/components/landing/landing.css` | `.wave-nav-actions`, `.wave-nav-cta`, `.wave-nav-cta:hover`, `.wave-nav-sheet-cta` |
| `src/components/landing/public-pages.css` | `.lp-nav-cta`, `.lp-nav-cta:hover`, aturan `.lp-nav-cta { margin-left: auto }` di `@media (max-width: 640px)` |
| `src/app/page.tsx` | komentar rute yang masih menyebut CTA "Pesan Template" |

Jalur jualan yang **tetap ada** (tidak ada konversi yang hilang):
- tombol **Pesan** di overlay demo live hero (`MagazineShowcase`) → `/checkout?template=<id>` (v1.3.82),
- CTA di badan halaman `/harga` dan `/cara-pesan` (`.lp-btn-primary`).

### 2. Tiga tab hero selebar sama + pil geser

Sebelumnya `.wave-nav-link` memakai `padding: 7px 13px` tanpa lebar tetap, jadi lebarnya mengikuti teks
("Fitur" vs "Cara Pesan" beda). Sekarang:

- `.wave-nav-link` → `width: 104px` (angka yang sama dengan `.lp-nav-link` di halaman dalam).
- Markup hero mendapat `<span className="wave-nav-indicator">` + inline style `--wave-active` (0/1/2).
- `.wave-nav-indicator` bergeser `transform: translateX(calc(var(--wave-active, 0) * 104px))` dengan
  `transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)` — timing identik dengan pil halaman dalam.
- Di `/` tidak ada tab yang aktif (hero bukan salah satu halaman jualan) → kelas `is-idle` menyembunyikan
  pil. Saat tab diketuk, `LandingPage` men-set `tabIndex` lebih dulu, jadi pil terlihat meluncur ke tab
  tujuan sebelum navigasi selesai.
- Hover tidak lagi memberi blok putih (`background`/`border` per tautan) — hanya perubahan warna teks,
  supaya tidak bertumpuk dengan pil penanda.

## Verifikasi (Chromium via `agent-browser`, viewport 1440x900)

| Uji | Hasil |
|---|---|
| Lebar 3 tab di `/` | `[104, 104, 104]` px |
| `--wave-active` setelah klik "Cara Pesan" (navigasi dicegah) | `2`, kelas `is-idle` hilang |
| `transform` pil saat animasi | `68.366px` pada t≈50 ms → selesai di `208px` (2 × 104) |
| Klik nyata `/` → `Cara Pesan` | URL `/cara-pesan`; pil nav halaman dalam `--lp-active = 2`, `transform 207.969px` |
| Teks "Pesan Template" di `/`, `/fitur`, `/harga`, `/cara-pesan`, `/panduan`, `/syarat-ketentuan` | tidak ditemukan (6/6) |
| Sheet burger 375 px | 3 tautan (`Fitur`, `Harga`, `Cara Pesan`), tanpa CTA |
| `tsc --noEmit` / `eslint src/components/landing` | 0 error / bersih |

## Catatan untuk AI Berikutnya

- Jangan menambahkan lagi CTA "Pesan Template" di navbar pada permintaan owner berikutnya tanpa konfirmasi;
  owner eksplisit minta dihapus dari semua halaman.
- Angka `104px` muncul di **tiga** tempat dan harus tetap sinkron: `.wave-nav-link` (lebar),
  `.wave-nav-indicator` (`width` + pengali `translateX`), dan `.lp-nav-link` (halaman dalam).
  Kalau label tab berubah (mis. teks lebih panjang), ubah ketiganya sekaligus.
- Pil hero hanya tampil setelah tab diketuk (`--wave-active`), karena `/` bukan salah satu halaman jualan.
- Halaman dalam (`/fitur` → `/harga` → `/cara-pesan`) sudah punya pil geser sejak v1.3.81 lewat
  `PublicNav` di layout route group `(storefront)` — nav-nya tidak di-unmount sehingga transisinya utuh.

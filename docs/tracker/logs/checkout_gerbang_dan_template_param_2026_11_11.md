# Checkout: Gerbang Server + Parameter `?template=` (v1.3.82, 2026-11-11)

## Latar Belakang

Owner meminta dua celah lama ditutup sebelum deploy:

> "kamu bilang: Satu catatan sisa yang tidak saya sentuh (celah lama): /checkout belum memakai gerbang isStorefrontDeployment() dan belum menerima ?template=. lakukan"

## Yang Dikerjakan

### 1. Gerbang `isStorefrontDeployment()` di halaman

- `src/app/checkout/page.tsx` dulu `'use client'` murni — tidak punya penjaga sendiri; satu-satunya penjaga adalah middleware (`src/middleware.ts` → `STOREFRONT_ONLY_PREFIXES = ['/checkout','/orders','/api/billing','/api/telegram']`).
- Sekarang `page.tsx` = **server component**: `if (!isStorefrontDeployment()) notFound()`, lalu merender `CheckoutForm` (client) yang dipindah ke `src/app/checkout/CheckoutForm.tsx`.
- Karena membaca `searchParams` (Promise di Next 16), rute ini dirender saat request — bukan HTML statis yang berpotensi disajikan langsung dari asset binding tanpa melewati Worker.

### 2. `?template=<id>`

- `CheckoutPage` meneruskan `template` (string atau array → ambil yang pertama) ke `CheckoutForm` sebagai `initialTemplateId`.
- Validasi di form: hanya `os-desktop`, `infinite-canvas`, `spatial-gallery`; selain itu fallback `os-desktop`.
- Tombol **Pesan** ditambahkan di header overlay demo hero (`MagazineShowcase`), menuju `/checkout?template=<id>`; id diambil dari `previewUrl` lewat helper baru `templateIdOf()`.

## Verifikasi

| Uji | Hasil |
|---|---|
| `GET /checkout` | **200** |
| `GET /checkout?template=infinite-canvas` | **200**, dropdown = **Infinite Canvas** |
| `GET /checkout?template=ngawur` | **200**, dropdown = **OS Desktop** (fallback) |
| Link "Pesan" di overlay demo | `href="/checkout?template=spatial-gallery"` (sesuai lembaran aktif) |
| `vitest` checkout + landing + constants | **25/25 PASS** |
| `tsc` / `eslint` | 0 error / bersih |

## Catatan untuk AI Berikutnya

- Jangan kembalikan `page.tsx` menjadi `'use client'` — gerbang server akan hilang.
- `/checkout` sengaja dinamis; jangan `force-static`.
- `TEMPLATES` di `CheckoutForm.tsx` adalah sumber tunggal daftar template checkout. Menambah template = tambah di situ **dan** pastikan `previewUrl` di `templates.ts` memakai slug yang sama.

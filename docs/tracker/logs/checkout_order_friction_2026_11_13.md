# Checkout & Halaman Order: Klaim Menyesatkan + 4 Friction Pembeli Ditutup (v1.3.84, 2026-11-13)

## Latar Belakang

Hasil audit kesiapan jualan 2026-11-12 (pertanyaan owner: "apa ini sudah aman dan flow bisnisnya sudah bisa di publish apa bisa mendapat klien?") menemukan 5 cacat yang terlihat langsung oleh calon pembeli. Owner menyetujui perbaikan murah tersebut ("lakukan").

## Yang Dikerjakan

### 1. Klaim palsu "alamat sudah dipesan/aktif" di form checkout

**Sebelum** (`src/app/checkout/CheckoutForm.tsx`):

> Alamat ini **dipesan** untuk Anda dan baru aktif setelah pembayaran diverifikasi
> serta setup selesai (maksimal 1×24 jam kerja).

**Masalah:** tidak ada reservasi apa pun. Slug yang sama bisa dipesan dua pembeli bersamaan dan baru ketahuan bentrok saat onboarding.

**Sekarang:** "Alamat ini **akan dipakai** untuk situs Anda dan baru aktif setelah pembayaran diverifikasi serta setup selesai (maksimal 1×24 jam kerja)" — tanpa klaim reservasi, dan ketersediaan slug dibuktikan lewat pengecekan **real-time** (poin 5).

### 2. `adminWhatsapp` kosong di produksi — belum diperbaiki (butuh data owner)

`payment-info` produksi masih mengembalikan `adminWhatsapp: ""` → fallback di kode memakai `628123456789` (nomor contoh). Perbaikan adalah **data**, bukan kode: isi `platform_settings.owner_whatsapp` dengan JSON `{"number":"62..."}` (dibaca `getOwnerWhatsapp()`, dipakai tombol wizard R2 juga).

### 3. Blok rekening bank kosong disembunyikan

`src/app/orders/[orderId]/page.tsx`: `hasBankAccount` = `bankName` **dan** `bankAccountNumber` terisi. Kalau salah satu kosong, container bank tidak dirender dan grid instruksi turun jadi 1 kolom (`grid-cols-1` saja). Sebelumnya pembeli melihat kartu berisi "• " / "—" kosong.

### 4. Validasi `templateId` di server + katalog seed disinkronkan

- `src/lib/services/orderService.ts` → `createOrder()` sekarang menolak template tak dikenal:

  ```ts
  if (input.templateId && !getTemplate(input.templateId)) {
    return { success: false, error: 'Template tidak dikenal. Silakan pilih salah satu template yang tersedia.' };
  }
  ```

  Ditaruh di chokepoint (satu-satunya penulis `orders.template_id`) supaya `?template=` arbitrer tidak bisa tersimpan lalu dipakai saat provisioning.
- `src/crud/shared/db/seed.ts` → baris `portfolio_templates` dibangun dari `TEMPLATES` di `src/lib/templates/registry.ts`, bukan daftar terpisah. Ini menutup drift lama (produksi hanya punya 2 dari 3 template jualan).

### 5. Cek ketersediaan slug real-time di form checkout

`CheckoutForm.tsx` memanggil `GET /api/billing/checkout?slug=...` (endpoint yang sudah ada) dengan debounce **600 ms** + `AbortController`, lalu menampilkan status `role="status" aria-live="polite"`:

| State | Pesan |
|---|---|
| `checking` | "Memeriksa ketersediaan alamat…" |
| `available` | "Alamat `<slug>.workers.dev` tersedia." |
| `unavailable` | `data.reason` dari server |

`handleSubmit` menolak submit saat status `unavailable`. Hasil lama tidak bisa nyangkut: status disimpan bersama `slug`-nya dan diturunkan lewat `slugCheck` (`slugStatus.slug === desiredSlug.trim()`), sehingga hasil untuk slug berbeda selalu dianggap `idle`. Efek tidak melakukan `setState` sinkron di body (patuh `react-hooks/set-state-in-effect`).

## Berkas yang Dimodifikasi

| Berkas | Perubahan |
|---|---|
| `src/app/checkout/CheckoutForm.tsx` | Teks klaim diganti; state `slugStatus`; efek debounce 600 ms; guard submit; UI status a11y |
| `src/app/orders/[orderId]/page.tsx` | `hasBankAccount`; blok bank kondisional; grid 1 kolom saat bank kosong |
| `src/lib/services/orderService.ts` | Guard `getTemplate()` di awal `createOrder` |
| `src/lib/services/orderService.test.ts` | Test baru: template tak dikenal ditolak tanpa menyentuh DB |
| `src/crud/shared/db/seed.ts` | Seed `portfolio_templates` dari `TEMPLATES` |
| `src/lib/constants.ts` | `APP_VERSION` → `1.3.84` |
| `CHANGELOG.md` | Entri 1.3.84 |

## Verifikasi

- `npx tsc --noEmit` → 0 error.
- `npm run lint` → bersih.
- `npx vitest run src/lib/services/orderService.test.ts` → **38/38 PASS**.
- Suite penuh `npx vitest run` → **153 file / 1290 test PASS** (termasuk `src/lib/constants.test.ts` yang mengunci `APP_VERSION` = entri teratas CHANGELOG).

## Belum Ditutup

- `platform_settings.owner_whatsapp` di produksi (butuh nomor WA owner).
- Belum di-commit / belum di-deploy saat log ini ditulis.
- Item audit lain yang belum dikerjakan: backup harian untuk klien R2-pending, alerting, lockout login per-IP saja, tidak ada batas sesi absolut, dan gladi deferred-R2 e2e (ditunda owner 2026-11-12).

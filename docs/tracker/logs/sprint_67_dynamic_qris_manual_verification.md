# Sprint 67 - Dynamic QRIS Nominal Manual Verification

## Status

Planned

## Tujuan

Meningkatkan billing semi-otomatis yang sudah ada agar halaman order bisa menampilkan QRIS dinamis dengan nominal unik per order. Sprint ini bukan payment gateway, bukan webhook bank, dan bukan auto-activation. Aktivasi tetap hanya dilakukan admin setelah mengecek mutasi masuk secara manual.

## Keputusan Scope

- Gunakan CRUD pembayaran Master Dashboard yang sudah ada sebagai sumber konfigurasi pembayaran.
- Jangan memakai live demo eksternal QRIS converter.
- Jangan menerima QRIS source dari buyer/public user.
- QRIS static merchant hanya dikelola Master Admin.
- Nominal tagihan order harus unik agar mudah dicocokkan di mutasi manual.
- Bukti bayar dari user tetap hanya sinyal bantuan, bukan bukti otoritatif.
- Tombol aktivasi Telegram/Admin tetap wajib didahului cek mutasi manual.

## Rencana Implementasi

### 1. Payment Config Hardening

- Tambahkan field konfigurasi internal:
  - `qrisStaticPayload`: string QRIS merchant asli hasil decode dari gambar/source resmi.
  - `qrisDynamicEnabled`: boolean.
  - `qrisUniqueAmountEnabled`: boolean.
  - `qrisUniqueAmountMaxOffset`: default kecil, misalnya `999`.
- Master Admin tetap boleh upload gambar QRIS statis untuk preview, tetapi generator dinamis harus memakai payload string yang tervalidasi.
- Validasi saat save:
  - payload QRIS wajib valid CRC jika dynamic QRIS aktif.
  - payload wajib static (`010211`) sebelum dikonversi.
  - currency wajib IDR (`5303360`).

### 2. QRIS Core Local Vendor

- Buat utility lokal kecil, tanpa CDN dan tanpa dependency baru jika cukup:
  - parse TLV minimum.
  - validate CRC16.
  - convert static to dynamic dengan tag amount `54`.
  - generate CRC baru.
- Hindari `innerHTML`, upload publik, dan kamera scanner.
- Sumber referensi hanya dari hasil audit eksternal, bukan import live demo.

### 3. Unique Amount Per Order

- Ubah `createOrder()` agar amount akhir bukan hanya harga plan dasar.
- Format:
  - `baseAmount`: harga plan/template.
  - `uniqueOffset`: angka kecil 1-999.
  - `amount`: `baseAmount + uniqueOffset`.
- Offset harus deterministic/collision-aware untuk order aktif:
  - cari offset yang belum dipakai pada order aktif hari itu/status belum final.
  - simpan amount final di tabel `orders.amount`.
- Tidak perlu kolom baru kalau cukup pakai `amount` final; tambahkan helper agar UI bisa menampilkan “harga dasar + kode unik” bila diperlukan.

### 4. Dynamic QRIS Endpoint

- Tambahkan endpoint publik token-protected atau gabungkan di detail order:
  - `GET /api/billing/orders/[orderId]/qris?token=...`
- Endpoint hanya mengembalikan QRIS dinamis untuk order valid dan belum activated.
- Jangan expose `qrisStaticPayload` ke client.
- Jika QRIS dynamic belum configured, fallback ke QRIS image static/bank transfer seperti sekarang.

### 5. Order Page UI

- Di `src/app/orders/[orderId]/page.tsx`:
  - tampilkan QR dinamis yang digenerate dari payload, bukan QRIS static image, jika config aktif.
  - tampilkan nominal final besar dan jelas.
  - tampilkan catatan “Bayar tepat sampai 3 digit terakhir untuk verifikasi manual.”
  - tetap tampilkan bank transfer dan WhatsApp admin sebagai fallback.
- Jangan menulis teks yang memberi kesan pembayaran otomatis.

### 6. Admin Verification Guard

- Perkuat copy Telegram/admin:
  - tampilkan `amount` final.
  - tampilkan instruksi cek mutasi manual.
  - jangan aktifkan berdasarkan screenshot.
- Pastikan `activateOrder()` tetap hanya admin/internal webhook terautentikasi.

### 7. Tests

- Unit test QRIS utility:
  - CRC valid/invalid.
  - static ke dynamic mengganti `010211` ke `010212`.
  - amount tag benar.
  - QRIS non-IDR atau sudah dynamic ditolak.
- Unit test order amount:
  - amount final selalu lebih besar/sama dari base.
  - offset tidak tabrakan untuk order aktif.
  - activated/canceled/expired tidak mengunci offset selamanya.
- Route test:
  - QRIS endpoint butuh token/admin.
  - tidak pernah mengembalikan payload static merchant.

## Target File

- `src/lib/services/paymentConfigService.ts`
- `src/app/admin/desktop/panels/PaymentConfigPanel.tsx`
- `src/app/api/admin/payment-config/route.ts`
- `src/lib/services/orderService.ts`
- `src/lib/services/orderService.test.ts`
- `src/lib/billing/qris.ts` atau `src/lib/services/qrisService.ts`
- `src/lib/billing/qris.test.ts` atau test setara
- `src/app/api/billing/orders/[orderId]/qris/route.ts`
- `src/app/orders/[orderId]/page.tsx`
- `docs/operations/billing-runbook.md` atau support playbook yang relevan

## Pass Criteria

- Admin bisa menyimpan QRIS static merchant yang tervalidasi.
- Order baru mendapat nominal unik yang tersimpan sebagai `orders.amount`.
- Halaman order menampilkan QRIS dinamis untuk nominal final jika config aktif.
- Buyer tidak bisa mengubah nominal/QRIS source dari client.
- Admin masih wajib cek mutasi manual sebelum aktivasi.
- Tidak ada dependency CDN untuk generator QRIS dinamis.
- Test QRIS utility dan order unique amount pass.

## Risiko yang Sengaja Tidak Diselesaikan Sprint Ini

- Tidak ada webhook payment gateway.
- Tidak ada rekonsiliasi mutasi bank otomatis.
- Tidak ada recurring subscription automation.
- Tidak ada auto-activation berdasarkan bukti upload user.

## Catatan Bugfix UI & R2 Allowed Keys (2026-07-30)

- **Bug 1 (Gambar Preview QRIS Broken):**
  - Path R2 `/r2/sites/...` atau `/r2/platform/...` sebelumnya ditolak oleh `isAllowedKey` di `src/app/api/r2/[...key]/route.ts` yang hanya membolehkan `assets/` dan `temp/`.
  - Telah diperbaiki dengan menambahkan awalan `sites/` dan `platform/` ke `isAllowedKey` serta menambahkan test case pada `route.test.ts`.
- **Bug 2 (Icon Tong Sampah Background Merah Bulat):**
  - Mengubah styling tombol hapus gambar pada `PaymentConfigPanel.tsx` dari `rounded-full bg-rose-500` menjadi tombol melayang bersih (`bg-white/90 text-gray-500 hover:bg-rose-50 hover:text-rose-600`).
- **Verifikasi Test:**
  - 117 test files, 814 unit tests PASS (`npm test`).


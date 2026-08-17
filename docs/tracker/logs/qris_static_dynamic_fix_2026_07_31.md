# QRIS Static Upload & Dynamic QRIS Fix Log (2026-07-31)

> **Status:** 🟢 Completed  
> **Tanggal:** 2026-07-31  

---

## 1. Masalah Utama

1. **Gambar QRIS Statis Preview Broken (`qris priview di crdnya image broken`):**
   - Variabel `CLOUDFLARE_R2_PUBLIC_BASE_URL` di `.env.local` sebelumnya menunjuk langsung ke endpoint S3 internal `https://69c1e830f42d8b2569637288110699c1.r2.cloudflarestorage.com`.
   - Browser yang memuat tag `<img src="https://...r2.cloudflarestorage.com/..." />` menerima error HTTP 401/403 XML dari R2, menyebabkan gambar QRIS terlihat patah / broken image.

2. **QRIS Dinamis Gagal Dideteksi / Ditebus (`qris dinamis gagal`):**
   - Di `src/lib/billing/qris.ts`, `convertStaticQRISToDynamic` menyisipkan tag 54 (Nominal), tetapi tidak mengurutkan ulang array elemen TLV berdasarkan Tag ID secara numerik.
   - Standar EMVCo & QRIS ASPI Indonesia mewajibkan seluruh tag TLV berada dalam urutan tag ID menaik (*ascending order*). Aplikasi m-Banking (BCA Mobile, Livin Mandiri, GoPay, OVO, ShopeePay, Dana) menolak QR Code jika urutan tag tidak sesuai spesifikasi.

3. **File QRIS Statis User (`qris MIB.jpg`):**
   - Berkas gambar `qris MIB.jpg` (milik merchant *Make it better*, ShopeePay QRIS statis IDR valid) terdeteksi di akar direktori proyek (`c:\Users\USER\Documents\portfolio-template\qris MIB.jpg`).
   - Berkas ini telah di-decode dan dipastikan menghasilkan payload QRIS EMVCo valid (`00020101021126610016ID.CO.SHOPEE.WWW...5914Make it better...`).

---

## 2. Perubahan & Perbaikan Kode

1. **`src/lib/billing/qris.ts` & `src/lib/billing/qris.test.ts`**:
   - Menambahkan pengurutan numerik `result.sort((a, b) => Number(a.tag) - Number(b.tag))` sebelum pembuatan string CRC16 dan payload akhir.
   - Menambahkan unit test spesifik di `qris.test.ts` untuk memastikan urutan tag TLV pada hasil QRIS dinamis selalu *strictly ascending*.

2. **`.env.local`**:
   - Memperbaiki `CLOUDFLARE_R2_PUBLIC_BASE_URL="/r2"` agar URL publik aset R2 melewati proxy route `/r2/...` (`src/app/r2/[...key]/route.ts` -> `src/app/api/r2/[...key]/route.ts`).
   - Menguji loading gambar via R2 proxy, memastikan browser mendapatkan gambar QRIS bersih tanpa error 401/403.

---

## 3. Hasil Pengujian & Verifikasi

- **Decoder Test (`qris MIB.jpg`):**
  - Payload berhasil diekstrak: `00020101021126610016ID.CO.SHOPEE.WWW01189360091800234309910208234309910303UMI51440014ID.CO.QRIS.WWW0215ID10265613085150303UMI5204597153033605802ID5914Make it better6013JAKARTA BARAT61051156062070703A01630433E4`
  - Merchant: `Make it better` (City: `JAKARTA BARAT`).
- **Dynamic QRIS Conversion Test:**
  - `convertStaticQRISToDynamic(payload, 149012)` menghasilkan: `00020101021226...530336054061490125802ID5914Make it better...6304A290`.
  - Tag 54 disisipkan tepat dengan urutan 00, 01, 26, 51, 52, 53, 54, 58, 59, 60, 61, 62, 63 dan CRC valid `A290`.
- **Unit Tests & Typecheck:**
  - `npx vitest run src/lib/billing/qris.test.ts` -> 5/5 PASS.
  - `npm test` -> 117 test files, 815 tests PASS.
  - `npx tsc --noEmit` -> 0 error.

---

## 4. Eksekusi Pengunggahan & Konfigurasi Otomatis

- Berkas `qris MIB.jpg` telah berhasil diunggah langsung ke Cloudflare R2 pada key `platform/payment/qris-mib.jpg` dengan URL publik `/r2/platform/payment/qris-mib.jpg`.
- Konfigurasi pembayaran platform di database Cloudflare D1 (`platform_settings.payment_config`) telah diperbarui:
  - `qrisImageUrl`: `/r2/platform/payment/qris-mib.jpg`
  - `qrisStaticPayload`: `00020101021126610016ID.CO.SHOPEE.WWW01189360091800234309910208234309910303UMI51440014ID.CO.QRIS.WWW0215ID10265613085150303UMI5204597153033605802ID5914Make it better6013JAKARTA BARAT61051156062070703A01630433E4`
  - `qrisAccounts`: Slot 1 `QRIS MIB (ShopeePay / Make it better)` (Aktif).
  - `qrisDynamicEnabled`: `true`
  - `qrisUniqueAmountEnabled`: `true`
  - `isActive`: `true`

---

## 5. Redesain UI/UX Halaman Pesanan (Struk Pembayaran / Invoice Receipt)

- Halaman detail pesanan `src/app/orders/[orderId]/page.tsx` di-redesain secara menyeluruh menjadi tampilan **Struk Pembayaran & Invoice Digital Resmi**:
  - Header nota resmi bertuliskan `PORTFOLIO OS — Invoice & Struk Pembayaran Resmi` beserta tombol `Cetak Struk` (`Printer` action).
  - Baris metadata struk (No. Order, Tanggal Order, Pemesan, Target Domain, Paket).
  - Tabel rincian tagihan itemized (*itemized bill breakdown*) dengan sekat garis *dashed/serrated*.
  - Modul pembayaran struk bersanding rapi: Kotak scan QRIS dinamis/statis di sisi kiri, dan kartu detail transfer bank berwarna gelap kontras dengan tombol `Salin No. Rekening` & `Salin Nominal` di sisi kanan.
  - Form upload bukti pembayaran dan footer verifikasi keamanan resmi.



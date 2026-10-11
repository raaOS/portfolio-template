# Sprint 155 - Spatial Gallery Onboarding, Smart Slug Suggestions & OS Render Guard

- **Status:** 🟢 Completed
- **Tanggal:** 2026-10-11
- **Versi:** 1.3.38

## Ringkasan Pekerjaan

1. **Pemasangan Template 3D Spatial Gallery ke Portal Onboarding (`PENGELOLA_KLIEN.bat`):**
   - Mendaftarkan `'spatial-gallery'` ke tipe `templateKey` di `scripts/onboarding/server.ts` dan `scripts/onboarding/cloud-manager.ts`.
   - Menambahkan kartu visual ke-3 (`Spatial Gallery`, badge `3D Spasial`) pada grid template di `scripts/onboarding/public/index.html`.
   - Menambahkan pesan WhatsApp serah terima update versi khusus template Spatial Gallery (`server.ts`).
   - Memperbaiki layout `.template-grid` menjadi `repeat(auto-fit, minmax(180px, 1fr))` agar ketiga kartu tersusun rapi.

2. **Pencegahan Bug Form Portal Menimpa Slug (`dataset.manual`):**
   - Mengetik nama klien di portal tidak lagi menimpa (`overwrite`) isi kotak slug yang sudah diisi manual atau dipilih dari daftar pesanan pembeli (`scripts/onboarding/public/index.html`).

3. **Saran Slug Pintar ala Gmail di Checkout (`/checkout`):**
   - Menampilkan kolom input eksplisit untuk Alamat Website yang Diinginkan (Slug URL).
   - Menghasilkan 3 saran slug cerdas otomatis berbasis nama pembeli (contoh: `budi`, `budi-portfolio`, `karya-budi`).
   - Tombol pil saran dapat diklik langsung untuk mengisi kotak slug.
   - Pratinjau langsung URL target: `https://[slug].workers.dev`.
   - Mengirimkan `desiredSlug` langsung dari form submit ke endpoint `/api/billing/checkout`.

4. **Visibilitas Template Pesanan di Telegram & Admin Panel:**
   - Menambahkan baris `Template: <b>${templateName}</b>` pada pesan notifikasi Telegram order baru dan saat bukti transfer diunggah (`src/lib/services/orderService.ts`).
   - Menampilkan label nama template di setiap kartu pesanan pada panel admin (`src/app/admin/desktop/panels/OrdersPanel.tsx`).

5. **Perbaikan Crash Render `useOSOverlays`:**
   - Menambahkan hook aman `useOSOverlaysOptional` di `src/components/os/context/OSSystemContext.tsx`.
   - Menggunakan hook tersebut di `src/components/home/HomeOSWrapper.tsx` sehingga tidak melempar error fatal jika di-render di luar `OSSystemProvider` (misal saat navigasi preview).

6. **Sapuan Darurat Kolam Kode Unik QRIS (lanjutan audit MEDIUM — keputusan owner "kerjakan sekarang"):**
   - `expireStalePendingOrders(nowIso, pendingCutoffIso?)` kini menerima cutoff opsional yang **hanya** menggeser ambang `expires_at` untuk `pending_payment` — sapuan aktivasi macet & batal-7-hari tetap memakai waktu sebenarnya.
   - `createOrder`: saat `resolveOrderAmount` gagal ("kolam penuh"), sekali saja ia menjalankan sapuan darurat (pending tua usia >6 jam, cutoff now+18h) lalu mengulang alokasi pada attempt berikutnya; error "Nominal unik sedang penuh" hanya muncul bila masih penuh.
   - Unit test baru: kolam disimulasikan penuh (maxOffset 2) → sapuan melepas 1 slot → order sukses memakai offset yang baru dibebaskan. **Keputusan owner: TANPA auto-suffix slug** (slug tabrakan tetap ditolak; pembeli memilih manual lewat kolom slug checkout yang sudah ada).

7. **Label Serah Terima Portal (cacat sisa CRITICAL #1):** baris "Template Dipilih" di surat serah terima kini menulis "3D Spatial Gallery" (sebelumnya jatuh ke cabang "Infinite Canvas").

8. **Info Alamat di Checkout (audit LOW):** kalimat "alamat `*.workers.dev` sudah aktif & gratis selamanya, bisa disambungkan ke domain pribadi kapan saja" ditambahkan di bawah pratinjau slug.

9. **SOP Tertulis (audit HIGH — keputusan owner "tulis sekarang"):** `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md` **§9** — SOP akun Cloudflare klien (owner membuatkan; email klien; incognito; jeda 1–2 akun/hari; jalur daftar-sendiri untuk skala besar; penyerahan akses saat diminta) + checklist anti struk palsu (wajib cocokkan mutasi bank asli).

## Verifikasi & Pengujian

- `npx tsc --noEmit`: 0 error
- `npm run lint`: 0 error
- `npm test`: 129 test files passed, **1018 tests passed** (termasuk test baru sapuan darurat QRIS)
- `npx vitest run src/lib/constants.test.ts`: 6/6 passed (sinkron dengan `CHANGELOG.md` 1.3.38)

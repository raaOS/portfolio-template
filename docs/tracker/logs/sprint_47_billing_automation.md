# Sprint 47 - Billing Automation & Self-Service Checkout

## Status

Completed (semi-otomatis)

## Catatan Scope 2026-07-21

Sprint 47 mengimplementasikan alur billing **semi-otomatis**, bukan billing automation penuh:

- **Yang sudah ada:** Checkout form, instruksi bayar QRIS/Transfer, upload bukti bayar, Telegram Bot 1-click activation (admin klik tombol di Telegram → site otomatis aktif), Zero Slug Collision engine, Slug Switcher.
- **Yang belum ada:** Payment gateway integrasi (Midtrans/Xendit), webhook otomatis, invoice PDF generation, subscription recurring, billing dashboard admin penuh.

Status di INDEX_TRACKER.md diperjelas agar tidak menimbulkan kesalahpahaman.

## Bugfix Verification 2026-07-18

- Memperbaiki lint React pada checkout dan halaman status order tanpa mengubah alur transaksi.
- Menyesuaikan unit test AI voice/translate agar mengaktifkan feature gate yang memang diwajibkan runtime.
- Menyesuaikan test upload presign dan wallpaper poster backfill dengan auth/site-scoping serta revalidation contract terbaru.
- Menyesuaikan test optimistic like dengan key localStorage site-scoped.
- Menghapus import API dan ikon UI yang tidak digunakan.
- Verifikasi lokal: TypeScript pass, ESLint bersih (0 error, 0 warning), dan Vitest 105 file / 776 test pass.
- Membersihkan 9 warning tersisa dengan narrowing `unknown`, tipe payload Telegram, serta koreksi dependency hook site-scoped tanpa refaktor struktur OS.

### File yang dimodifikasi

- `src/app/checkout/page.tsx`
- `src/app/orders/[orderId]/page.tsx`
- `src/app/api/chat/voice/route.ts`
- `src/app/api/chat/voice/route.test.ts`
- `src/app/api/translate/route.ts`
- `src/app/api/translate/route.test.ts`
- `src/app/api/admin/upload/presign/route.test.ts`
- `src/app/api/admin/wallpaper-poster-backfill/__tests__/route.test.ts`
- `src/components/projects/project-detail/hooks/useProjectDetail.test.tsx`
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/orders/[orderId]/route.ts`
- `src/app/api/client/slug/route.ts`
- `src/app/api/telegram/webhook/route.ts`
- `src/lib/services/orderService.ts`
- `src/components/os/core/DesktopEnvironment.tsx`
- `src/components/os/hooks/useStickyNotes.ts`
- `src/lib/d1-schema.ts` (DDL `platform_settings`)
- `src/lib/services/paymentConfigService.ts` (CRUD service)
- `src/app/api/admin/payment-config/route.ts` (Admin API)
- `src/app/api/billing/payment-info/route.ts` (Public API)
- `src/app/admin/desktop/panels/PaymentConfigPanel.tsx` (Admin UI Panel)
- `src/app/admin/desktop/registry.ts` (App registration)
- `src/app/admin/desktop/WindowContentRenderer.tsx` (Panel wiring)
- `src/lib/billing/qris.ts` (EMVCo TLV parser & dynamic QRIS converter with CRC16-CCITT)
- `src/lib/billing/qris.test.ts` (Unit tests for QRIS utility)
- `src/lib/billing/qrisImageDecoder.ts` (Auto-decode QRIS string from uploaded image using jsQR)
- `src/app/api/billing/orders/[orderId]/qris/route.ts` (Dynamic QRIS order payload API)

## Audit Ulang 2026-07-18

Status dikonfirmasi dari filesystem & hasil keputusan produk:
- `src/lib/billing/`: belum ada.
- `src/app/api/billing/orders/`: belum ada.
- `src/app/api/telegram/webhook/`: belum ada.
- `docs/operations/billing-runbook.md`: belum ada.

Metadata billing manual dari Sprint 18 (`site_subscriptions` dan field billing di Master Site) sudah terpasang. Sprint 47 mengimplementasikan alur pembayaran semi-otomatis (Manual QRIS/Transfer + Telegram Admin Activation Bot) serta manajemen unik Slug & Ganti Slug.

## Tujuan

1. Mengubah transaksi Lite/Pro dari komunikasi WhatsApp manual tanpa tracker menjadi alur pesanan terstruktur dengan `ORDER_ID` sebagai *source of truth*.
2. Memfasilitasi konfirmasi pembayaran manual via QRIS/Transfer dengan aktivasi 1-klik via Bot Telegram Admin.
3. Menjamin keunikan `slug` pembeli baru dan pembeli lama (*Zero Slug Collision*) serta menyediakan fitur **Ganti Slug ID**.

## Alur Transaksi & Aktivasi (Flow Spec)

```text
Buyer submit form order
 └─► Buat ORDER_ID unik (misal: ORD-20260718-8F3K) & Kunci Desired Slug (TTL 24 Jam)
 └─► Simpan order ke DB: status 'pending_payment'
 └─► Tampilkan Halaman Instruksi Bayar + Upload Bukti Bayar
 └─► Kirim Telegram Ke Admin: "[INFO] Order Baru (Belum Bayar)"

Buyer upload bukti bayar / konfirmasi
 └─► Ubah status order ke 'waiting_verification'
 └─► Kirim Telegram Ke Admin: "[BUKTI BAYAR] Cek Mutasi -> Tombol [Verifikasi & Aktifkan]"

Admin Klik [Verifikasi & Aktifkan] di Telegram
 └─► Bot panggil API internal (dengan Enkripsi Header Secret)
 └─► Atomic Lock: UPDATE orders SET status = 'activating' WHERE id = ? AND status IN ('pending_payment', 'waiting_verification')
 └─► Cek Email Buyer:
      ├─► Pembeli Baru: Buat Site baru + Credentials Client Access
      └─► Pembeli Lama: Upgrade Existing Site Quota & Tier ke Pro
 └─► Ubah status order ke 'activated'
 └─► Auto-send Email / WA ke Buyer & Balas konfirmasi status ke Telegram Admin
```

## Arsitektur Keunikan Slug & Fitur Ganti Slug ID

### 1. Zero Slug Collision Engine (Dual-Check Engine)
Sebuah `slug` dinyatakan **Tersedia (Available)** jika dan hanya jika:
1. Tidak ada di reserved system routes (`admin`, `api`, `client`, `about`, `lab`, `public`, `login`, `projects`, `checkout`, `orders`, `support`, `default-site`, `demo-designer`).
2. Tidak ada di tabel `sites` (`SELECT 1 FROM sites WHERE slug = LOWER(?)`).
3. Tidak ada di tabel `orders` yang masih aktif (`SELECT 1 FROM orders WHERE desired_slug = LOWER(?) AND status IN ('pending_payment', 'waiting_verification', 'activating') AND expires_at > datetime('now')`).

### 2. Fitur Ganti Slug ID (Slug Switcher)
- Karena `site_id` (UUID) adalah primary key/foreign key di seluruh tabel D1 (`projects`, `media_assets`, `client_access`) dan prefix R2 (`sites/{siteId}/...`), perubahan `slug` bersifat **O(1) safe operation** (hanya memperbarui `sites.slug`).
- **Endpoint:** `PATCH /api/client/slug` (Client Self-Service) atau `PATCH /api/admin/sites/[id]/slug` (Master Admin).
- **Aturan Quota:**
  - Lite: 1x perubahan slug atau melalui admin.
  - Pro: Self-service ganti slug kapan saja (dengan cooldown 7 hari agar link publik stabil).
- **Alur Ganti Slug:**
  1. Validasi format regex `^[a-z0-9-]+$`, panjang 3-30 karakter.
  2. Jalankan Dual-Check Slug Availability (mengabaikan `site_id` milik site itu sendiri).
  3. Lakukan `UPDATE sites SET slug = LOWER(?), updated_at = datetime('now') WHERE id = ?`.
  4. Catat riwayat perubahan ke `audit_logs` (`SITE_SLUG_CHANGED`).

## Skema Database D1 Tambahan

```sql
-- Tabel Orders untuk Billing & Checkout
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,               -- e.g. ORD-20260718-8F3K
  site_id TEXT,                      -- NULL jika pembeli baru, populated setelah activate / jika upgrade
  desired_slug TEXT NOT NULL,       -- Slug yang dipesan
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_whatsapp TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro',  -- 'lite' atau 'pro'
  amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'manual_qris',
  payment_proof_url TEXT,            -- R2 public URL bukti transfer
  status TEXT NOT NULL DEFAULT 'pending_payment', -- pending_payment, waiting_verification, activating, activated, failed, expired, canceled
  expires_at TEXT NOT NULL,          -- TTL 24 Jam untuk reservasi slug
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_orders_desired_slug ON orders(desired_slug);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
```

## Target File Implementation

- `src/lib/d1-schema.ts` (tambah DDL tabel `orders` & index)
- `src/lib/services/slugService.ts` (helper Dual-Check availability & reserved routes)
- `src/lib/services/orderService.ts` (atomic state machine & order creation)
- `src/app/api/billing/checkout/route.ts` (POST submit order baru)
- `src/app/api/billing/orders/[orderId]/route.ts` (GET status order & POST upload bukti bayar)
- `src/app/api/telegram/webhook/route.ts` (Webhook callback Telegram bot)
- `src/app/api/client/slug/route.ts` (PATCH ganti slug client)
- `src/app/checkout/page.tsx` & `src/app/orders/[orderId]/page.tsx` (UI Checkout & Instruksi Bayar)
- `docs/operations/billing-runbook.md` (Runbook operasional admin)

## Pass Criteria

- Transaksi order menghasilkan `ORDER_ID` unik dan reservasi slug 24 jam.
- Tidak ada 2 pembeli (baru maupun lama) yang memiliki atau membooking `slug` sama (*Zero Collision*).
- Admin bisa klik `[Verifikasi & Aktifkan]` di Telegram dan site otomatis dibuat/di-upgrade tanpa race condition.
- Client / Admin bisa mengganti `slug` ID site yang ada secara aman tanpa merusak media R2 atau data project.

## Update UI Struk Printer (2026-08-01)

- Mengubah halaman detail order menjadi visual mesin printer struk: kepala printer metal, slot hitam, kertas thermal, dan tepi sobek.
- Menambahkan animasi struk terbuka dari slot ke bawah memakai `clip-path` Motion tanpa dependency atau aset baru.
- Menghormati preferensi `prefers-reduced-motion` dan mempertahankan mode cetak tanpa kepala printer/dekorasi layar.
- Merapikan responsivitas metadata, detail pemesan, dan pemilih multi-QRIS pada layar sempit.
- Alur QRIS dinamis, transfer bank, status order, upload bukti, dan verifikasi manual tidak diubah.

### File yang dimodifikasi

- `src/app/orders/[orderId]/page.tsx`
- `docs/tracker/logs/sprint_47_billing_automation.md`

### Verifikasi

- `npx eslint "src/app/orders/[orderId]/page.tsx"` — pass.
- `npx tsc --noEmit` — pass.
- Dev server route `/orders/visual-test?token=test` — HTTP 200 dan tanpa output error awal.
- Pemeriksaan visual browser belum dilakukan karena browser internal tidak tersedia pada sesi ini.

### Penyempurnaan Animasi Cetak (2026-08-01)

- Mengganti reveal `clip-path` 1,55 detik yang kurang terlihat dengan pertumbuhan tinggi kertas dari slot selama 5,8 detik setelah jeda 0,65 detik.
- Animasi tidak lagi dinonaktifkan otomatis oleh preferensi reduced-motion karena user meminta presentasi animasi maksimal.
- Menambahkan getaran ringan printer, denyut roller/slot hitam, dan pergeseran mikro kertas selama proses cetak.
- Menambahkan tombol `Ulangi Animasi` agar efek cetak dapat diputar kembali tanpa reload halaman.
- Verifikasi ulang ESLint file dan TypeScript — pass.

### Perbaikan Posisi Slot Printer (2026-08-01)

- Memindahkan slot hitam dari bagian tengah-bawah badan printer ke tepat pada tepi keluaran printer.
- Slot sekarang menumpuk di atas pangkal kertas sehingga struk terlihat keluar langsung dari lubang hitam panjang, tanpa bibir metal kosong di antaranya.
- Penyempurnaan visual: slot dinaikkan 4 px ke dalam bodi agar tampak sebagai lubang, kertas desktop dipersempit dari 88% menjadi 80% agar berada di dalam lebar slot, dan mojibake `â€¢` diganti dengan karakter bullet `•`.
- Verifikasi ESLint dan TypeScript — pass.

### Minimalisasi Isi Struk Pembayaran (2026-08-02)

- Memadatkan isi struk order agar tidak terlalu panjang: banner batal/aktif diperkecil, label QRIS disingkat, catatan transfer dibuat satu baris nominal, form upload bukti dipadatkan, dan footer struk disederhanakan.
- Alur pembayaran tidak diubah: QRIS dinamis/statis, transfer bank, salin nominal/rekening, upload bukti, status order, dan verifikasi admin tetap memakai logika yang sama.

### File yang dimodifikasi

- `src/app/orders/[orderId]/page.tsx`
- `docs/tracker/logs/sprint_47_billing_automation.md`

### Verifikasi

- `npx eslint "src/app/orders/[orderId]/page.tsx"` - pass.
- `npx tsc --noEmit` - pass.
- Pemeriksaan visual browser belum dilakukan pada sesi ini.

### Perbaikan Nominal Unik Checkout Penuh (2026-08-02)

- Memperbaiki bug checkout yang dapat menampilkan `Nominal unik sedang penuh. Silakan coba lagi.` walau range nominal belum benar-benar habis.
- Penyebab: order `pending_payment` yang sudah lewat 24 jam belum otomatis diubah menjadi `expired`, sementara unique index `orders.amount` tetap mengunci nominalnya. Resolver nominal juga hanya mengecek order hari ini, tidak sepenuhnya selaras dengan unique index aktif.
- Fix: sebelum membuat order baru, service menandai order pending yang sudah kedaluwarsa sebagai `expired`; resolver nominal sekarang mengecek semua order dengan status pembayaran aktif; jika nominal dasar bentrok saat kode unik dimatikan, service fallback ke offset unik kecil.

### File yang dimodifikasi

- `src/lib/services/orderService.ts`
- `src/lib/services/orderService.test.ts`
- `docs/tracker/logs/sprint_47_billing_automation.md`

### Verifikasi

- `npx vitest run src/lib/services/orderService.test.ts` - pass, 10 tests.
- `npx eslint "src/lib/services/orderService.ts" "src/lib/services/orderService.test.ts"` - pass.
- `npx tsc --noEmit` - pass.

### Audit Konflik Logika Pembayaran (2026-08-02)

- Mengencangkan guard checkout/order setelah audit konflik pembayaran:
  - Checkout sekarang menolak order baru jika konfigurasi pembayaran admin sedang nonaktif, dan UI checkout ikut disable tombol bayar.
  - Aktivasi admin hanya bisa dilakukan untuk order `waiting_verification` yang sudah punya `payment_proof_url`; tidak lagi bisa mengaktifkan order yang masih `pending_payment` tanpa bukti.
  - Lock aktivasi diganti ke `UPDATE ... RETURNING` agar dua klik/verifikasi bersamaan tidak sama-sama lanjut provisioning.
  - Order `activated` atau `activating` tidak bisa dibatalkan lewat flow refund sederhana agar status order tidak bertabrakan dengan site yang sudah aktif.
  - QRIS dinamis tidak digenerate untuk order yang sudah bukan status pembayaran.
  - Upload bukti telat dari order `expired` tetap boleh hanya jika nominalnya belum dipakai ulang oleh order aktif lain; jika sudah bentrok, user diminta verifikasi manual via admin.
  - Query `template` dari marketplace checkout sekarang diteruskan ke `orders.template_id`, sehingga aktivasi dapat auto-grant entitlement template.

### File yang dimodifikasi

- `src/lib/services/orderService.ts`
- `src/lib/services/orderService.test.ts`
- `src/app/admin/desktop/panels/OrdersPanel.tsx`
- `src/app/api/billing/orders/[orderId]/qris/route.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/app/checkout/page.tsx`
- `docs/tracker/logs/sprint_47_billing_automation.md`

### Verifikasi

- `npx vitest run src/lib/services/orderService.test.ts src/lib/billing/qris.test.ts` - pass, 19 tests.
- `npx eslint "src/lib/services/orderService.ts" "src/lib/services/orderService.test.ts" "src/app/admin/desktop/panels/OrdersPanel.tsx" "src/app/api/billing/orders/[orderId]/qris/route.ts" "src/app/api/billing/checkout/route.ts" "src/app/checkout/page.tsx"` - pass.
- `npx tsc --noEmit` - pass.

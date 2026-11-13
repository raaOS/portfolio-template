# Alamat Situs Jujur: `activated` ≠ Online + Bukti Serah Terima Otomatis (v1.3.85, 2026-11-13)

## Latar Belakang

Lanjutan audit alur pembeli 2026-11-13 (`buyer-journey-audit-2026-11-13`): temuan terburuk adalah **janji alamat palsu** — semua titik jualan menulis `https://<slug>.workers.dev`, padahal alamat riil Cloudflare Workers selalu menyertakan subdomain akun klien (`https://<slug>.<subdomain-akun>.workers.dev`; gladi = `anaak-setaan`). Setiap link yang pernah dijanjikan salah. Tambahan temuan dari handoff sesi `sess_0691bb1d`: `notify-online.ts` mengklaim "pencatatan tetap dijalankan walau email tidak dikonfigurasi" tapi **tidak pernah menulis apa pun ke D1**, dan subject email masih memakai format alamat palsu.

Prinsip baru (keputusan sesi handoff): `status='activated'` = pembayaran terverifikasi saja, **belum** situs online. Alamat resmi dicatat ke order SETELAH deploy sukses.

## Yang Dikerjakan

### 1. Kolom bukti serah terima `orders.site_url` + `orders.provisioned_at`

- `src/lib/d1-schema.ts` — DDL orders baru menyertakan kedua kolom (fresh install).
- `src/lib/cloudflareD1.ts` — self-heal `ALTER TABLE` guarded untuk database existing; komentar partial index `idx_orders_desired_slug_active` dijelaskan ulang (sengaja TIDAK mengikutkan `activated` — self-heal DROP+CREATE index tiap boot bisa gagal diam-diam kalau data lama punya slug activated ganda; proteksi jual-ulang ada di lapisan aplikasi).
- `src/lib/services/orderService.ts` — `OrderRecord` + `site_url?`/`provisioned_at?`; `activateOrder()` TIDAK lagi menebak alamat (baris `https://${actualSlug}.workers.dev` dihapus).

### 2. Pencatatan otomatis dari portal (bagian yang menyebabkan klaim bohong)

- `scripts/onboarding/notify-online.ts` — fungsi baru `recordProvisionedSite(slug, websiteUrl)`: `UPDATE orders SET site_url=?, provisioned_at=?, updated_at=? WHERE desired_slug=? AND status='activated'` lewat `queryD1ForDatabase` (D1 owner). Dipanggil di awal `sendWebsiteOnlineEmail()` **sebelum** gerbang email → pencatatan tetap jalan walau provider email belum dikonfigurasi (janji lama yang kini benar). Subject email tidak lagi memuat `<slug>.workers.dev` palsu.
- Call site `cloud-manager.ts` (deploy onboarding baru) tidak perlu berubah — sudah memanggil `sendWebsiteOnlineEmail` tepat setelah deploy sukses.
- **Sumber alamat palsu dibersihkan** (sebelum bisa meracuki `site_url`):
  - `client-deploy.ts` `deployClient()` — URL provisional menghormati `WORKERS_SUBDOMAIN` (via `workersDevUrl`), tidak lagi `https://${slug}.workers.dev` polos.
  - `server.ts` retry-deploy kartu sukses — fallback palsu diganti `outcome.websiteUrl || env.WEBSITE_URL`; kalau keduanya kosong → email/pencatatan DILEWATI dengan catatan jujur (alamat kosong tidak boleh dicatat).
  - `cloud-manager.ts` batch update — `outcome.websiteUrl` kosong → tampil `(alamat belum terbaca — cek config.env klien)`, bukan alamat karangan.
  - `server.ts` surat serah terima custom domain — "(bawaan: …workers.dev)" palsu dihapus.

### 3. Slug yang sudah dibayar tidak bisa dijual ulang

- `src/lib/services/slugService.ts` `isSlugAvailable()` — cek baru #3: slug milik order `activated` → tidak tersedia (dulu bebas dijual lagi selama situs belum di-deploy, karena D1 owner tidak pernah berisi baris `sites` milik klien).
- `src/lib/services/orderService.ts` `reopenOrder()` — guard slug sebelum UPDATE: kalau slug kini dipakai order aktif lain (termasuk `activated`), reopen ditolak dengan pesan jelas. Alasan: partial index hanya menjaga INSERT baru, bukan UPDATE status.

### 4. Telegram webhook dua langkah (aktivasi/pembatalan)

`src/app/api/telegram/webhook/route.ts` — tap pertama `activate_`/`cancel_` TIDAK langsung eksekusi; kirim pesan konfirmasi dengan tombol `confirm_activate_*`/`confirm_cancel_*` + tombol `noop`. Eksekusi hanya lewat tombol konfirmasi. `reopen_` sengaja tetap satu tap (dampak rendah). Salah tap tidak lagi langsung mengubah status order.

### 5. Alert Telegram saat email struk gagal

- `sendOrderEmail` kini mengembalikan `{ sent, reason }` yang membedakan "provider belum dikonfigurasi" vs gagal kirim (HTTP/exception).
- Caller `createOrder()`: kalau struk tidak terkirim → alert Telegram berisi alasan + link order (`/orders/<id>?token=…`) supaya owner bisa mengirim link manual ke pembeli (audit: email struk yang gagal sebelumnya hilang diam).

### 6. Status deploy di panel Pesanan

`src/app/admin/desktop/panels/OrdersPanel.tsx` — interface `OrderItem` + `site_url`/`provisioned_at`; order `activated` menampilkan link hijau "online sejak …" bila `site_url` terisi, atau peringatan kuning "menunggu deploy lewat portal" bila belum (selaras dengan prinsip `activated` ≠ online). `getAdminOrders` memakai `SELECT *` jadi kolom baru otomatis ikut.

## Verifikasi

- `npx tsc --noEmit` → 0 error (termasuk perbaikan bug: komentar SQL di `d1-schema.ts` memakai backtick di dalam template literal → merusak string, ketahuan tsc).
- `npm run lint` → bersih.
- `npm test` → **153 file / 1294 test PASS**. Test disesuaikan/ditambah:
  - `slugService.test.ts` — slug `activated` ditolak (no double-sell) + mock query ke-3.
  - `orderService.test.ts` — tiket bengkel TIDAK memuat alamat fiktif.
  - `notify-online.test.ts` — pencatatan tetap jalan tanpa konfigurasi email, `recordProvisionedSite` menulis `site_url`+`provisioned_at` pada order `activated`, subject tanpa alamat karangan.

## File Dimodifikasi

- `src/lib/d1-schema.ts`, `src/lib/cloudflareD1.ts`, `src/lib/constants.ts` (APP_VERSION 1.3.85)
- `src/lib/services/orderService.ts`, `src/lib/services/slugService.ts`
- `src/app/api/telegram/webhook/route.ts`
- `src/app/admin/desktop/panels/OrdersPanel.tsx`
- `src/app/checkout/CheckoutForm.tsx`, `src/app/orders/[orderId]/page.tsx`, `src/app/(storefront)/harga/page.tsx`, `src/app/page.tsx` (bagian jujur alamat — dari sesi handoff)
- `src/app/api/billing/orders/[orderId]/route.ts` (SELECT ikut ambil kolom baru)
- `scripts/onboarding/notify-online.ts`, `scripts/onboarding/client-deploy.ts`, `scripts/onboarding/server.ts`, `scripts/onboarding/cloud-manager.ts`
- Test: `src/lib/services/slugService.test.ts`, `src/lib/services/orderService.test.ts`, `scripts/onboarding/notify-online.test.ts`
- `CHANGELOG.md` (entri 1.3.85), `docs/tracker/INDEX_TRACKER.md`

## Bug yang Diperbaiki

1. Klaim "pencatatan serah terima tetap jalan walau email tidak dikonfigurasi" — klaim tanpa kode; kini `recordProvisionedSite` benar-benar menulis ke D1.
2. Subject email "Sudah Online" memakai alamat palsu `<slug>.workers.dev`.
3. Fallback alamat palsu di `deployClient`/retry-deploy portal/batch update/surat custom domain (potensi mencatat alamat karangan ke `orders.site_url`).
4. Slug `activated` bisa dijual ulang; `reopenOrder` bisa membuat dua order aktif memegang slug sama.
5. Aktivasi/pembatalan Telegram satu tap (rawan salah tap).
6. Email struk gagal tidak terdeteksi owner.
7. Komentar SQL backtick di `d1-schema.ts` merusak template literal (ketahuan `tsc`).

## Belum Ditutup

- `platform_settings.owner_whatsapp` produksi masih kosong (butuh nomor WA owner — blocker dari sesi sebelumnya).
- Backfill order `activated` lama: produksi belum punya `site_url` riil; kolom terisi otomatis mulai deploy berikutnya setelah portal deploy klien.

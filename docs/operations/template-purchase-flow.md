# Alur Bisnis: Pembelian & Aktivasi Template

**Status:** Berlaku sejak v1.3.92 (2026-11-18)
**Pemilik keputusan:** owner (jangan diubah tanpa izin eksplisit)
**Kode utama:** `scripts/onboarding/template-purchase.ts`, `scripts/onboarding/server.ts` (`/api/client-template`), `scripts/cloudflare/backfill-template-entitlements.ts`, `scripts/cloudflare/set-client-template.ts`

---

## 1. Aturan bisnis yang terkunci

| Aturan | Konsekuensi teknis |
|---|---|
| Setiap template dijual **terpisah** Rp199.000 (harga default = panel Harga Jual) | Satu pembelian = satu baris `orders` di D1 owner |
| Klien hanya memiliki template yang **sudah dibayar** | Satu baris `site_template_entitlements` per template di D1 klien |
| Pindah ke template yang **sudah dibeli = gratis** | Tidak ada order baru; cukup update `sites.active_template_key` |
| Klien **tidak boleh** mengganti template sendiri | Tidak ada tombol/API di panel admin klien; aktivasi hanya dari portal lokal owner |
| Aktivasi lewat **portal lokal** (`PENGELOLA_KLIEN.bat`) | Portal punya kredensial D1 klien + akses D1 owner untuk mencatat order |
| Membeli template B **tidak** mengulang onboarding | Tidak ada provisioning/deploy baru; ketiga template sudah ikut ter-build |
| Template yang tampil = `sites.active_template_key` | Situs berganti ≤60 detik (ISR), admin menyesuaikan setelah refresh |

Harga semua template sama. Tidak ada paket Lite/Pro, tidak ada langganan.

---

## 2. Sumber kebenaran (jangan dicampur)

| Data | Lokasi | Siapa yang menulis |
|---|---|---|
| Template yang tampil | D1 **klien** → `sites.active_template_key` | Portal (`POST /api/client-template`), CLI owner (dengan guard) |
| Template yang dimiliki | D1 **klien** → `site_template_entitlements` (UNIQUE `site_id + template_id`) | Portal saat pembelian; onboarding saat site baru; backfill untuk klien lama |
| Bukti pendapatan | D1 **owner** → `orders` (tampil di panel **Order & Pembayaran**) | Portal (`payment_method='template_tambahan'`), backfill (`'migrasi_historis'`) |
| Katalog template | D1 **klien** → `portfolio_templates` | Di-upsert dari `src/lib/templates/registry.ts` |
| Cermin arsip | `arsip-klien/<folder>/config.env` → `ACTIVE_TEMPLATE_KEY` | Portal/CLI setelah aktivasi (agar re-provision tidak mengembalikan template lama) |

Tautan dua arah tanpa kolom baru: entitlement menyimpan `granted_by = "portal:<orderId>"`.

**D1 owner hanya menyimpan order** (`site_id`, slug, nominal, status) — bukan konten, bukan
entitlement, bukan `active_template_key` klien. Panel admin owner juga tidak memegang kredensial
D1 klien sehingga tidak bisa membaca kepemilikan template. Karena itu pembelian wajib dicatat
oleh portal (satu-satunya proses yang memegang dua set kredensial sekaligus).

**Bukti invarian "klien tidak bisa ganti sendiri" (diperiksa 2026-11-18, `src/`):**

- Tidak ada satu pun route di `src/app/api/` yang menulis `sites.active_template_key`. Yang ada
  hanya pembacaan: `src/app/api/admin/site-template/route.ts` (dipakai filter menu admin).
- Penulis entitlement di dalam app semuanya digerbangi `requireOwnerMode()`
  (`src/app/api/admin/sites/[siteId]/entitlements/route.ts`,
  `src/app/api/admin/sites/route.ts`) → di deployment klien `OWNER_MODE=false` (dipaksa
  `deployClient`) sehingga route dibalas **404** sebelum auth.
- `src/crud/shared/db/seed.ts` hanya memberi `os-desktop` (price 0, `granted_by='system'`) pada
  jalur `/setup` lama yang sudah mati di deployment hasil portal.

---

## 3. Alur A — klien membeli template baru (mis. dari macOS ke Infinite Canvas)

1. Klien menghubungi owner (WhatsApp) dan membayar Rp199.000.
2. Owner buka `PENGELOLA_KLIEN.bat` → **Status Board** → **Detail Klien** → seksi
   **Template & Pembelian**.
3. Pilih template yang belum dimiliki, isi harga (default Harga Jual, boleh diskon
   Rp50.000–Rp50.000.000), WhatsApp pembeli, catatan → **Catat Pembelian + Aktifkan**.
4. Server melakukan (berurutan):
   1. validasi folder, template key, dan invarian D1 (tepat 1 baris `sites`, `CUSTOMER_SITE_ID` cocok);
   2. cek versi deployment (lihat §7);
   3. `INSERT orders` di D1 owner (status `activated`, `payment_method='template_tambahan'`) + verifikasi;
   4. `INSERT site_template_entitlements` di D1 klien (`granted_by="portal:<orderId>"`) + verifikasi;
   5. `UPDATE sites.active_template_key` + verifikasi baca balik;
   6. `INSERT audit_logs` klien (`template_purchased`);
   7. sinkron `ACTIVE_TEMPLATE_KEY` di arsip.
5. Tidak ada build/deploy. Situs berganti ≤60 detik.

Jika langkah 4–7 gagal **setelah** entitlement tersimpan, order **dipertahankan** dan UI
menampilkan pesan `PARTIAL_OWNERSHIP_WRITTEN`: klien memang sudah membeli, aktivasi cukup
diulang (gratis). Jika entitlement belum tersimpan, order yang baru dibuat dihapus kembali
(tidak ada pendapatan palsu di panel).

---

## 4. Alur B — klien kembali ke template yang sudah dibeli (gratis)

1. Detail Klien → seksi Template & Pembelian → tombol **Aktifkan (gratis)** pada template berbadge **DIMILIKI**.
2. Server hanya mengubah `active_template_key` + audit (`template_activated`). **Tidak ada order baru.**
3. Kalau template itu sudah aktif → server membalas “sudah aktif”, tanpa menulis apa pun.

---

## 5. Alur C — onboarding klien baru

Saat portal melakukan provisioning (`scripts/onboarding/server.ts`, STEP 4):

- Katalog `portfolio_templates` di-upsert dari registry (idempoten).
- Site **baru** mendapat entitlement untuk template yang dipilih, `granted_by='onboarding'`,
  harga acuan Rp199.000.
- Re-provision **tidak** menimpa `active_template_key` (dulu ditimpa; sekarang
  `COALESCE(active_template_key, excluded.active_template_key)`) dan **tidak** memberi
  entitlement baru — supaya template lain tidak pernah diberikan gratis lewat form onboarding.

---

## 6. Alur D — klien lama (sebelum v1.3.92)

Klien yang sudah onboard sebelum fitur ini belum punya katalog/entitlement. Jalankan:

```bash
# 1. Lihat rencana (tidak menulis)
npx tsx scripts/cloudflare/backfill-template-entitlements.ts

# 2. Terapkan (katalog + entitlement + order historis di D1 owner)
npx tsx scripts/cloudflare/backfill-template-entitlements.ts --apply

# Opsi:
#   --no-orders        hanya entitlement (tanpa order historis)
#   --folder <nama>    satu klien saja
```

Aturan backfill:

- Hanya mengisi template yang **sedang aktif** di `sites.active_template_key` (klien sudah membayarnya).
- `purchased_at` = `sites.created_at`; `price` = 199.000; `granted_by='migrasi-1.3.92'`.
- Order historis didedupe: kalau sudah ada order untuk site/template itu (atau order lama tanpa
  `template_id`), tidak dibuat lagi.
- **Tidak** mengubah `active_template_key`, **tidak** mengubah arsip, **tidak** menyentuh konten.
- Idempoten: aman dijalankan berulang.

Folder tanpa kredensial D1 klien (mis. `00_site-owner`) dilewati dengan status `[SKIP]`,
bukan dianggap gagal.

---

## 7. Gate versi deployment

| Versi deployment | Perilaku |
|---|---|
| < v1.3.88 | Aktivasi ke `infinite-canvas`/`spatial-gallery` **diblokir** (konten canvas/spatial belum lengkap) |
| v1.3.88–v1.3.89 | Diizinkan dengan **peringatan** (menu admin belum disaring per template) |
| ≥ v1.3.90 | Tanpa peringatan |

Versi dibaca dari `/api/health` klien. Template `os-desktop` tidak diblokir (default semua build).

---

## 8. Jalur CLI owner (bukan jalur penjualan)

`npm run client:template -- <folder-arsip> <template-key>`

- **Menolak** aktivasi template yang tidak punya entitlement.
- `--force` = darurat: template tetap diaktifkan, **tetapi tidak membuat order**.
- Pembelian template baru **wajib** lewat portal supaya tercatat di panel owner.
- Selalu menyinkronkan `ACTIVE_TEMPLATE_KEY` arsip dan memverifikasi baca balik.

---

## 9. Yang DILARANG (agar tidak salah kaprah)

1. **Jangan** menambahkan pemilih template di panel admin klien. Klien bisa mengganti sendiri = pendapatan hilang.
2. **Jangan** mengaktifkan template tanpa entitlement (kecuali `--force` darurat yang dicatat).
3. **Jangan** membuat order pembelian template dari sisi klien/Worker klien — panel owner tidak bisa membacanya.
4. **Jangan** menghapus order yang dibuat saat kepemilikan sudah tercatat (`PARTIAL_OWNERSHIP_WRITTEN`) — itu bukti pendapatan.
5. **Jangan** memberi entitlement “semua template” saat onboarding/re-provision. Hanya template yang dibayar.
6. **Jangan** memakai SQL manual untuk mengubah `active_template_key`; pakai portal/CLI agar arsip & audit ikut sinkron.
7. **Jangan** mengubah harga template per template tanpa keputusan owner: satu harga berlaku untuk semua template.

---

## 10. Bukti verifikasi (v1.3.92)

- `scripts/onboarding/template-purchase.test.ts`: 22 test (validasi harga, gate versi, keputusan aksi,
  baca state, katalog, pembelian/aktivasi/noop, partial error, audit gagal tidak membatalkan aktivasi).
- Backfill dry-run nyata terhadap D1 gladi: rencana `entitlement BARU + order ORD-MIG-…`; folder
  `00_site-owner` `[SKIP]` karena bukan klien portal.
- Endpoint portal diuji langsung (GET state, tolak aktivasi tanpa pembelian, noop, dan pembelian
  penuh dengan rollback) — lihat `docs/tracker/logs/fitur_pembelian_template_portal_2026_11_18.md`.
- Setelah perubahan: gladi kembali ke `os-desktop`, tanpa entitlement/order/audit sisa uji.

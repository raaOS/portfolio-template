# Fitur: Checkout Multi-Template + Kupon Diskon (v1.3.93)

**Tanggal:** 2026-11-19
**Status:** Selesai — kode + test hijau. Belum di-deploy (menunggu keputusan owner).
**Versi:** 1.3.93

## Tujuan

Memungkinkan pembeli membeli **lebih dari satu template dalam satu checkout** (satu order,
satu pembayaran QRIS) dengan **kode kupon opsional** dan **diskon bundel otomatis**, plus
CRUD kupon owner-only.

## Keputusan bisnis (dikunci owner, "pakai default")

| Topik | Keputusan |
|---|---|
| Struktur order | 1 checkout = 1 order = 1 QRIS; rincian per template di `order_items` |
| Harga | Rp199.000 per template (panel Harga Jual), sama untuk semua template |
| Diskon bundel | 2 template 10%, 3+ 15% (bisa diubah owner) |
| Kupon vs bundel | Best-of (tidak ditumpuk); seri → bundel |
| Batas bawah | Total ≥ Rp1.000; gratis penuh hanya lewat portal |
| Kupon | Satu kupon per order; persen/nominal; kuota total + batas email best-effort |
| Kupon owner-only | Ya — 404 di situs klien |
| Checkout publik | Hanya pembeli situs baru; klien lama lewat portal |
| Entitlement | Tetap hanya ditulis portal onboarding |

## File yang ditambahkan

- `src/lib/services/checkoutPricing.ts` — mesin harga murni (bundel, kupon, best-of,
  alokasi diskon per item, batas bawah, normalisasi/validasi kode, generator kode).
- `src/lib/services/checkoutPricing.test.ts` — 26 test.
- `src/lib/services/couponService.ts` — baca/validasi/evaluasi kupon, reservasi kuota
  atomik, pelepasan reservasi, CRUD + arsip, validasi input admin.
- `src/lib/services/couponService.test.ts` — 15 test.
- `src/app/api/billing/quote/route.ts` — pratinjau harga publik (read-only, rate limit).
- `src/app/api/admin/coupons/route.ts` — GET/POST CRUD owner-only (auth + CSRF + audit).
- `src/app/admin/system/coupons/page.tsx` + `src/app/admin/desktop/panels/CouponsPanel.tsx`.
- `scripts/cloudflare/backfill-order-items.ts` — backfill order lama (dry-run default).

## File yang diubah

- `src/lib/d1-schema.ts` — tabel `order_items`, `coupons`, `coupon_redemptions`; kolom
  rincian di `orders`; index baru.
- `src/lib/cloudflareD1.ts` — self-heal `orders.subtotal`, `orders.discount_total`,
  `orders.coupon_code`.
- `src/lib/services/pricingConfigService.ts` — `getBundleTiers()` / `updateBundleTiers()`
  (cache 60 detik, fallback default).
- `src/lib/services/orderService.ts` — `createOrder` menerima `templateIds[]` + `couponCode`,
  menulis `order_items`, reservasi kupon, melepas kupon pada expire/cancel, `getOrderItems`,
  breakdown di pesan Telegram; jalur satu-template lama tetap utuh.
- `src/lib/services/orderService.test.ts` — 2 test wiring baru (bundel 2 template, kupon habis
  → order dihapus) + mock sweep kupon yang dilepas (sebelumnya flaky 50%).
- `src/app/admin/desktop/panels/OrdersPanel.tsx` — form "Buat Pesanan" multi-template + kupon,
  nominal tagihan di kotak link, breakdown subtotal/diskon di kartu order.
- `src/app/admin/desktop/WindowContentRenderer.tsx` — `coupons: CouponsPanel` di `PANEL_MAP`.
- `src/app/api/billing/checkout/route.ts` — meneruskan `templateIds`/`couponCode`.
- `src/app/api/billing/orders/[orderId]/route.ts` — GET mengembalikan `items`, subtotal,
  diskon, kupon.
- `src/middleware/csrf.ts` — `/api/billing/quote` masuk same-origin allowlist.
- `src/app/api/admin/orders/route.ts` — pembuatan order owner menerima multi-template + kupon.
- `src/app/api/admin/pricing/route.ts` — GET/PUT diskon bundel.
- `src/app/checkout/CheckoutForm.tsx` — multi-pilih template dari registry, kupon,
  ringkasan harga.
- `src/app/orders/[orderId]/page.tsx` — rincian item, subtotal, diskon, kode unik QRIS.
- `src/app/admin/desktop/registry.ts` — app `coupons` (`ownerOnly`) + route map.
- `src/app/admin/desktop/panels/HargaPanel.tsx` — editor tier diskon bundel.
- `scripts/onboarding/notify-online.ts` — `listPurchasedTemplates(slug)` (gabungan
  semua order lunas + harga efektif per template).
- `scripts/onboarding/server.ts` — onboarding memberi entitlement untuk semua template
  pada order slug tersebut, `price` = harga efektif per item.
- `AGENTS.md` §8/§12, `docs/operations/template-purchase-flow.md` §11,
  `docs/operations/support-playbook.md`, `CHANGELOG.md`, `src/lib/constants.ts`.

## Perilaku penting (jangan diregresi)

1. **Jangan** membuat satu order per template: `idx_orders_amount_active` + nominal QRIS
   unik membuatnya gagal.
2. **Jangan** menumpuk kupon + bundel.
3. **Jangan** mempercayai total dari body klien — `createOrder` menghitung ulang.
4. **Jangan** menghapus kupon/redemption; arsipkan.
5. **Jangan** menulis entitlement dari Worker/D1 klien.
6. Kupon yang sama dipakai ulang setelah order batal: reservasi dilepas pada sweep
   expired/cancel.

## Bukti

- `npx vitest run checkoutPricing.test.ts couponService.test.ts orderService.test.ts
  pricingConfigService.test.ts` → 92 test PASS (26 + 15 + 41 + 10).
- `npx vitest run` → **158 file / 1.377 test PASS** (termasuk 92 test fitur ini).
- `npx tsc --noEmit` → 0 error (config repo mengecualikan `scripts/`, jadi
  `scripts/onboarding/*` + `backfill-order-items.ts` diperiksa terpisah dengan tsconfig
  sementara yang meng-include ketiganya → 0 error).
- `npx eslint` pada file yang berubah → bersih (script onboarding di-ignore konfigurasi).

## Audit pasca-implementasi (2026-11-20)

Temuan + tindakan, berurutan:

1. **Skema D1 tidak dipasang oleh deploy** (kolom `orders.subtotal/discount_total/
   coupon_code` + tabel `order_items/coupons/coupon_redemptions` hanya dibuat
   `bootstrapD1Schema`, yang tidak dipanggil `npm run deploy`). → `bootstrapD1Schema()`
   dipanggil di `POST /api/billing/checkout` dan `/api/admin/coupons` (GET+POST).
   Tetap disarankan `npm run cf:bootstrap` sekali setelah deploy.
2. **Reopen order tidak me-reserve ulang kupon** (cancel menghapus reservasi) → reopen
   kini reservasi ulang bila `orders.coupon_code` ada; reservasi dibuat idempoten
   (`INSERT OR IGNORE`) supaya reopen order `failed` tidak menabrak `UNIQUE(order_id)`.
   Gagal reserve (kuota penuh) tidak menggagalkan reopen — hanya warning.
3. **`listPurchasedTemplateIds` hanya membaca 1 order terakhir** → diganti
   `listPurchasedTemplates` yang menggabungkan semua order `activated`/
   `waiting_verification` untuk slug tersebut.
4. **Harga entitlement selalu harga default** → sekarang memakai
   `order_items.final_price` (harga efektif setelah diskon); fallback default hanya
   untuk order lama tanpa rincian item.
5. **Kupon diketik tapi belum ditekan "Terapkan"** → submit checkout diblokir dengan
   pesan (dulu pembeli tertagih harga penuh tanpa kupon).
6. **Angka potongan kupon di notifikasi vs ringkasan** → keduanya memakai
   `appliedDiscount` (versi setelah batas bawah Rp1.000).

Sengaja **tidak** diubah:

- Backfill memakai `amount` (sudah termasuk kode unik QRIS) sebagai `list_price` order
  lama — kosmetik, dan mengubahnya berisiko mengarang harga historis.
- Kupon kedaluwarsa **tidak** auto-fallback ke bundel: lebih aman menolak order daripada
  menagih harga lebih tinggi dari yang dilihat pembeli.
- `/checkout` + `/api/billing/*` masih hidup di situs klien (perilaku lama). Menutupnya
  dengan `requireOwnerMode()` adalah keputusan produk owner — belum diubah.
- Sumber diskon diputuskan sebelum clamp Rp1.000 (`checkoutPricing.ts:343-359`): praktis
  tidak terjadi karena kupon persen maks 90% dan harga Rp199.000.

## Belum dikerjakan / catatan

- Belum deploy. Setelah deploy: jalankan `npm run cf:bootstrap` (opsional berkat guard
  bootstrap di route), lalu `POST /api/admin/coupons` perlu dicoba sekali di produksi
  (buat → ubah → arsip) dan `POST /api/billing/quote` dengan dua template.
- Backfill `backfill-order-items.ts` belum dijalankan ke D1 owner produksi (dry-run dulu).

## Handoff (2026-11-20)

Serah terima lengkap untuk AI/operator berikutnya ada di
[`handoff_checkout_multitemplate_kupon_2026_11_20.md`](./handoff_checkout_multitemplate_kupon_2026_11_20.md):
checklist deploy berurutan (`commit → npm run deploy → npm run cf:bootstrap →
/api/health = 1.3.93`), 8 langkah uji asap produksi, temuan yang sengaja tidak diubah,
dan 10 jebakan teknis. Pekerjaan ini **belum di-commit** (25 modified + 10 untracked di
worktree detached HEAD `0bc2561`).

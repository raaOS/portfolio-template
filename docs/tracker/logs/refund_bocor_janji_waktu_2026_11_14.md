# Dua Cacat Audit Terakhir: Refund Bocor Diam-Diam (#8) + Janji Waktu & Jendela Refund (#9) (v1.3.87, 2026-11-14)

## Latar Belakang

Sisa cacat audit alur pembeli 2026-11-13 (buyer-journey-audit). Setelah versi ini **seluruh 10 temuan audit sudah diproses** (#1–#7 di v1.3.84–1.3.86, #5 diselesaikan lewat keputusan model akun owner di v1.3.86).

- **#8:** bukti bayar order `expired` yang slug/nominalnya sudah dipakai order lain memang sudah ditolak dini (proteksi lama), TAPI penolakan itu tidak pernah memberi tahu owner — pembeli yang punya bukti bayar kemungkinan besar **sudah transfer**, dan refund hanya bergantung pada pembeli berinisiatif. Uang masuk bisa "hilang" tanpa sinyal apa pun ke owner.
- **#9:** janji waktu tersebar 4 varian ("1×24 jam kerja" di checkout, "1×24 jam" di T&C/email, "1×24 jam pada hari kerja" di FAQ/cara-pesan/halaman order) — celah "T&C bilang X halaman bilang Y". Dan refund 7 hari T&C dihitung "dari aktivasi", padahal sejak v1.3.85 `activated` ≠ online — jendela refund pembeli bisa terbuang menunggu situs.

## Yang Dikerjakan

### 1. Alert Telegram "BUTUH REFUND MANUAL" (#8)

`src/lib/services/orderService.ts`:

- Helper baru `alertLateProofConflict(env, order, reason)` — alert Telegram best-effort berisi alasan penolakan, order ID, slug, pembeli, email, dan link `wa.me` pembeli, ditutup instruksi eksplisit "hubungi pembeli dan atur pengembalian dana".
- Dipanggil di 4 titik penolakan bukti bayar late-payment (`expired`): konflik nominal (cek awal), konflik slug (cek awal), dan kedua cabang balapan bentrok unique index saat UPDATE (dikondisikan `isLatePayment` — order biasa tidak ikut ber-alert karena belum tentu sudah bayar).
- Pesan error ke pembeli diperjelas: "Hubungi admin lewat tombol Bantuan WhatsApp di halaman ini — dana Anda akan dikembalikan." (tombol Bantuan WA memakai `owner_whatsapp` yang sudah terisi sejak v1.3.86).

### 2. Janji waktu disatukan: "paling lambat 1×24 jam kerja" (#9a)

Satu frasa identik di 6 titik:

- `src/app/syarat-ketentuan/page.tsx` §3 ("1×24 jam" → "1×24 jam kerja")
- `src/app/(storefront)/harga/page.tsx` FAQ ("1×24 jam pada hari kerja" → "1×24 jam kerja")
- `src/app/(storefront)/cara-pesan/page.tsx` langkah verifikasi (idem)
- `src/app/orders/[orderId]/page.tsx` status aktivasi (idem)
- `src/lib/services/orderService.ts` email aktivasi text + HTML (2 titik)
- `src/app/checkout/CheckoutForm.tsx` sudah benar sejak 1.3.84 ("1×24 jam kerja") — tidak diubah.

Tidak disentuh (beda konteks, bukan janji provisioning): `paymentConfigService.verificationHours` (jam verifikasi bayar admin) dan label bizMap admin internal (ekspektasi finalisasi R2).

### 3. Jendela refund digeser ke "sejak website online" (#9b)

`src/app/syarat-ketentuan/page.tsx` §4:

- "Dalam 7 hari setelah aktivasi" → "**Dalam 7 hari sejak website online**" + penjelasan: jendela dihitung sejak email "Website Anda Sudah Online" terkirim (alamat resmi tercatat di halaman pesanan), dan **pembayaran terverifikasi tapi website belum online tidak mengurangi jendela refund**.
- "Lewat 7 hari setelah aktivasi" → "Lewat 7 hari sejak website online".

Selaras dengan prinsip v1.3.85 (`activated` ≠ online) dan bukti `orders.provisioned_at`/email online. Tidak ada logika kode yang menghitung tanggal refund (refund tetap manual), jadi perubahan murni T&C.

## Verifikasi

- `npx tsc --noEmit` 0 error; `npm run lint` bersih; suite penuh **153 file / 1294 test PASS**.
- Dua test late-payment diperluas: penolakan slug/nominal kini wajib memicu fetch Telegram dengan payload "BUTUH REFUND MANUAL" + `wa.me/<pembeli>` (orderService.test.ts).

## File Dimodifikasi

- `src/lib/services/orderService.ts` (helper alert + 4 titik pemanggilan + teks error pembeli + email aktivasi "jam kerja")
- `src/app/syarat-ketentuan/page.tsx`, `src/app/(storefront)/harga/page.tsx`, `src/app/(storefront)/cara-pesan/page.tsx`, `src/app/orders/[orderId]/page.tsx`
- `src/lib/services/orderService.test.ts`, `src/lib/constants.ts` (APP_VERSION 1.3.87), `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md`

## Bug yang Diperbaiki

1. Uang masuk order expired yang tak bisa diproses tidak pernah terlihat owner (#8) — kini alert Telegram di 4 titik penolakan.
2. 4 varian janji waktu yang bisa dikutip silang pembeli (#9a).
3. Jendela refund dihitung dari titik yang salah (#9b).

## Belum Ditutup

- Nomor WA sementara — owner ganti suatu saat via `set-owner-whatsapp.ts`.
- Semua cacat audit 2026-11-13 kini sudah diproses; tidak ada item audit terbuka selain yang butuh data owner.

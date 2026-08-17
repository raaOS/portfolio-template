# 09. Product Boundary Context

## Keputusan Sprint 1

Repo ini adalah repo khusus jual/template. Repo portfolio tunggal pribadi sudah aman di repo lain, sehingga personal legacy tidak perlu dipertahankan sebagai fitur default.

## Yang Tidak Boleh Menjadi Core Template

- Integrasi chat/notifikasi pribadi lama.
- Automasi pencarian kerja pribadi lama.
- Contact email pribadi.
- AI key pribadi.
- Data portfolio pribadi.
- Cloudflare D1/R2 lama dari portfolio pribadi.
- Domain atau URL produksi portfolio pribadi.

## Env Contract

Gunakan `.env.example` dan `docs/product-boundary/env-inventory.md` sebagai sumber kontrak env produk baru.

Jangan membaca atau menyalin nilai `.env.local` ke dokumentasi, log, atau jawaban. `.env.local` boleh berisi secret lama selama migrasi, tetapi hanya nama variable yang boleh dibahas.

## Integrasi Optional

AI dan notifikasi boleh dibangun kembali sebagai integrasi produk generic:

- Lite: default tanpa AI dan notifikasi eksternal.
- Pro: AI/notifikasi bisa aktif berdasarkan `FEATURE_AI`, `FEATURE_NOTIFICATIONS`, quota, dan `site.plan`.

Jangan memakai env pribadi lama sebagai kontrak produk baru. Jika provider lama masih dipakai sementara di kode, tandai sebagai migration debt.

## Batas Endpoint Client vs Platform

Client/pembeli tidak membutuhkan endpoint platform/global secara langsung.

- Endpoint client dan data tenant wajib site-scoped.
- Endpoint master/platform tetap global dan hanya untuk operator: admin login, reset password/PIN admin, clear-cache, health, settings platform, metrics internal, revalidate, dan utility admin.
- Jangan mengubah endpoint platform menjadi `siteId` hanya demi "100% siteId"; itu bisa merusak boundary produk dan membuka risiko security.
- Yang harus dijaga adalah aksesnya: client tidak boleh bisa memakai endpoint master, dan endpoint client harus selalu memvalidasi membership site.

## Urutan Aman Setelah Sprint 1

1. Hapus atau isolasi route personal lama, script personal lama, dan chat-to-personal-channel.
2. Ganti contact menjadi `site_settings` / `sites.contact_*` scoped `site_id`.
3. Ganti notification menjadi provider generic atau simpan leads ke D1 dulu.
4. Ganti AI menjadi provider generic dengan feature flag dan quota per site.

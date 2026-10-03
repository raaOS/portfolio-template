# 03. R2 Media Context

## Prinsip Object Storage
- Cloudflare R2 hanya menyimpan file/objek fisik. R2 bukan database relasional.
- Seluruh metadata (nama file, tipe, size, alt text) harus disimpan di D1 (`media_assets`).

## Konvensi Path R2
`sites/{siteId}/projects/{projectId}/{mediaId}-{variant}.{ext}`

## Alur Upload
1. **Upload Admin Master:** Admin dapat upload/override media semua site via Worker endpoint atau *signed URL* untuk kebutuhan support.
2. **Upload Client:** Client boleh upload/ganti media project sendiri dengan batas quota site, ukuran file terbatas, dan path selalu scoped ke `siteId`.
3. **Opsi lanjutan:** Submission/approval workflow dan fitur tambahan lain aktif jika feature flag terkait diaktifkan.

## Optimasi & Quota
- Lakukan kompresi (WASM FFmpeg / Sharp) sebelum atau saat upload.
- Batasi total storage per site, jumlah media per project, dan ukuran per file.
- Setiap upload video background akan memproduksi 3 file (*side-car*): `video.mp4`, `preview.mp4`, `poster.jpg`.

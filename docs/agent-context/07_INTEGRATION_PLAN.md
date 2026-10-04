# 07. Integration Plan (MVP)

Tujuan MVP bukan membangun SaaS besar otomatis, melainkan membuktikan bahwa sistem full Cloudflare (Pages/Workers + D1 + R2) bisa menyuplai data satu site milik satu klien (1 klien = 1 akun Cloudflare = 1 deployment) ke OS UI dan panel `/admin` dengan baik.

## Skenario End-to-End Test (Demo)
1. **Seed Data:** Buat 1 *site* bernama `demo-designer` di database (bisa hardcode/seed dari script).
2. **Seed Project:** Buat 2 *project* berstatus `published` dan 1 `draft`.
3. **Seed Media:** Pastikan ada minimal 1-2 gambar yang merujuk ke Cloudflare R2 (metadata di D1).
4. **Validasi Template:** 
   - Buka path `localhost:3000/demo-designer`.
   - Pastikan profil OS UI berubah sesuai data site.
   - Pastikan hanya 2 project `published` yang tampil di Window Explorer.
   - Buka project, pastikan narasi dan media termuat sempurna.
5. **Validasi Client Self-Service:**
   - Login sebagai user client.
   - Edit profil/site miliknya.
   - Tambah/edit/hapus project dalam batas quota.
   - Upload/ganti media scoped ke R2 path `sites/{siteId}/...`.
   - Pastikan client tidak bisa menyentuh `site_id` lain.
6. **Cross-Tenant Validation:** 
   - Coba akses slug project milik `site_B` saat membuka `/demo-designer`. Pastikan gagal/not found (membuktikan proteksi *multi-tenant*).
7. **Cloudflare Target Validation:**
   - Pastikan desain API/runtime tidak bergantung pada Vercel project, Vercel Functions, atau quota Vercel.

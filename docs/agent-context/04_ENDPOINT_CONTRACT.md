# 04. Endpoint Contract

Endpoint adalah kontrak baku. Frontend tidak boleh "menebak" shape data.

## Public API (Read-only)
- `GET /public/sites/:siteSlug` -> Ambil profil site, tema, config.
- `GET /public/sites/:siteSlug/projects` -> Ambil daftar project (`status='published'`).
- `GET /public/sites/:siteSlug/projects/:projectSlug` -> Ambil detail project + narasi + galeri.
- `GET /public/sites/:siteSlug/config` -> Ambil feature flags.

## Admin API (Auth Required)
- `POST /admin/sites` -> Buat site baru (Master only).
- `PUT /admin/sites/:id` -> Edit data site, status, dan custom quota add-on.
- `PUT /admin/sites/:id/quota` -> Legacy contract; quota custom sekarang masuk payload `PUT /admin/sites` sebagai `quotaOverride`.
- `POST /admin/projects` -> Buat project scoped `site_id` sebagai admin/master override.
- `PUT /admin/projects/:id` -> Edit project scoped `site_id`.
- `DELETE /admin/projects/:id` -> Soft delete project.
- `POST /admin/projects/reorder` -> Ubah `order_index`.
- `POST /admin/upload` -> Upload/override media R2.

## Client API (Auth Required, Scoped by Site Membership)
- Tidak ada lagi endpoint `/client/*`. Sistem login client dihapus; pembeli memakai panel `/admin` (session `site_user_token` dari `POST /api/auth/login`).
- `GET /projects?siteId=...` -> Daftar project (termasuk draft untuk site yang dituju).
- `POST /projects` -> Buat project (wajib `validateSiteMutationRequest`, cek quota).
- `PUT /projects/:projectId` -> Edit project.
- `DELETE /projects/:projectId` -> Soft delete project.
- `POST /admin/sites/:siteId/project-cover` -> Upload cover (multipart `file`).
- `POST /admin/sites/:siteId/project-media` -> Upload gallery image (multipart `file`).
- `POST /admin/sites/:siteId/project-video/presign` -> Presign upload video.
- Reset password: tidak ada endpoint; owner-assisted lewat `scripts/cloudflare/reset-customer-password.ts`.

## Site Scope Boundary
- Tidak semua endpoint harus diberi `siteId`.
- Endpoint yang menyimpan/membaca konten tenant wajib site-scoped: about/profile, contact, experience, labels, hard skills, testimonial, sticky notes, gallery featured, projects, project media, wallpaper/site media, public site config, dan client dashboard data.
- Endpoint platform/global tidak boleh dipaksa menjadi tenant-scoped tanpa alasan produk yang jelas: admin login, admin password/PIN, admin logout/check-auth, health, clear-cache, revalidate, settings platform, metrics internal, storage stats agregat, dan utilitas build/admin.
- Client tidak boleh memakai endpoint master/global untuk mengubah data. Client harus lewat endpoint client/site-scoped atau endpoint content yang memvalidasi membership lewat `validateSiteMutationRequest`.
- Jika endpoint mutasi bisa dipakai admin dan client, wajib resolve `siteId`, validasi actor terhadap site, cek plan/quota/feature flag bila relevan, dan revalidate path tenant.
- Jangan menjadikan `default-site` sebagai fallback data untuk tenant non-default. Tenant non-default harus membaca data sendiri atau fallback template statis yang aman.

## Quota Rules
- Semua endpoint mutasi wajib memvalidasi `site_id`, membership, dan quota.
- Setiap pembeli mengelola site miliknya sendiri lewat panel `/admin` (satu akun `site_users` per deployment).
- Default quota berasal dari env `PROJECT_LIMIT`, `STORAGE_MB`, `MEDIA_PER_PROJECT`; custom quota per site disimpan di D1 `site_quota_overrides` dan hanya menaikkan limit di atas default.
- Jangan membuat endpoint baru yang mengasumsikan Vercel atau 1 deployment per client.

## Standar Response Sukses
```json
{
  "site": { "id": "...", "slug": "...", "status": "active" },
  "projects": [
    { "id": "...", "title": "...", "status": "published", "narrative": {...}, "galleryItems": [...] }
  ]
}
```

## Standar Response Error
```json
{
  "ok": false,
  "error": { "code": "PROJECT_NOT_FOUND", "message": "..." }
}
```

# 04. Endpoint Contract

Endpoint adalah kontrak baku. Frontend tidak boleh "menebak" shape data.

## Public API (Read-only)
- `GET /public/sites/:siteSlug` -> Ambil profil site, tema, config.
- `GET /public/sites/:siteSlug/projects` -> Ambil daftar project (`status='published'`).
- `GET /public/sites/:siteSlug/projects/:projectSlug` -> Ambil detail project + narasi + galeri.
- `GET /public/sites/:siteSlug/config` -> Ambil feature flags.

## Admin API (Auth Required)
- `POST /admin/sites` -> Buat site baru (Master only).
- `PUT /admin/sites/:id` -> Edit data site, plan, billing metadata, dan custom quota add-on.
- `PUT /admin/sites/:id/quota` -> Legacy contract; quota custom sekarang masuk payload `PUT /admin/sites` sebagai `quotaOverride`.
- `PUT /admin/sites/:id/features` -> Atur feature flags Lite/Pro.
- `POST /admin/projects` -> Buat project scoped `site_id` sebagai admin/master override.
- `PUT /admin/projects/:id` -> Edit project scoped `site_id`.
- `DELETE /admin/projects/:id` -> Soft delete project.
- `POST /admin/projects/reorder` -> Ubah `order_index`.
- `POST /admin/upload` -> Upload/override media R2.

## Client API (Auth Required, Scoped by Site Membership)
- `GET /client/me/site` -> Ambil site milik client login.
- `PUT /client/sites/:siteId/profile` -> Client edit profil/site miliknya.
- `GET /client/sites/:siteId/projects` -> Client melihat project miliknya termasuk draft.
- `POST /client/sites/:siteId/projects` -> Client membuat project sesuai quota plan.
- `PUT /client/sites/:siteId/projects/:projectId` -> Client edit project miliknya.
- `DELETE /client/sites/:siteId/projects/:projectId` -> Client soft delete project miliknya.
- `POST /client/sites/:siteId/projects/reorder` -> Client reorder project miliknya.
- `POST /client/sites/:siteId/upload` -> Upload media scoped ke `sites/{siteId}/...` sesuai quota.

## Client Password Reset API (Public, Account-Safe)
- `POST /client/password-reset/request` -> Minta link reset untuk `siteSlug + email`. Wajib CSRF, rate limit, dan response generic agar tidak membocorkan akun.
- `POST /client/password-reset/confirm` -> Ganti password dengan reset token sekali pakai. Token disimpan sebagai hash di D1 dan scoped ke `site_id`.
- Reset self-service produksi wajib punya provider email generic, saat ini `NOTIFICATION_PROVIDER="resend"` dengan `NOTIFICATION_API_KEY` dan `NOTIFICATION_DEFAULT_FROM`.
- Jangan mengirim token reset lewat response API production dan jangan memakai endpoint master untuk reset self-service client.

## Site Scope Boundary
- Tidak semua endpoint harus diberi `siteId`.
- Endpoint yang menyimpan/membaca konten tenant wajib site-scoped: about/profile, contact, experience, labels, hard skills, testimonial, sticky notes, gallery featured, projects, project media, wallpaper/site media, public site config, dan client dashboard data.
- Endpoint platform/global tidak boleh dipaksa menjadi tenant-scoped tanpa alasan produk yang jelas: admin login, admin password/PIN, admin logout/check-auth, health, clear-cache, revalidate, settings platform, metrics internal, storage stats agregat, dan utilitas build/admin.
- Client tidak boleh memakai endpoint master/global untuk mengubah data. Client harus lewat endpoint client/site-scoped atau endpoint content yang memvalidasi membership lewat `validateSiteMutationRequest`.
- Jika endpoint mutasi bisa dipakai admin dan client, wajib resolve `siteId`, validasi actor terhadap site, cek plan/quota/feature flag bila relevan, dan revalidate path tenant.
- Jangan menjadikan `default-site` sebagai fallback data untuk tenant non-default. Tenant non-default harus membaca data sendiri atau fallback template statis yang aman.

## Plan Rules
- Semua endpoint mutasi wajib memvalidasi `site_id`, membership, quota, dan feature flags.
- Lite dan Pro sama-sama self-service. Lite dibatasi quota dan fitur; Pro membuka fitur lanjutan.
- Default quota berasal dari env `PLAN_*`; custom quota per site disimpan di D1 `site_quota_overrides` dan hanya menaikkan limit di atas default plan.
- Jangan membuat endpoint baru yang mengasumsikan Vercel atau 1 deployment per client.

## Standar Response Sukses
```json
{
  "site": { "id": "...", "slug": "...", "plan": "lite" },
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

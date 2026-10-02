# 02. Backend D1 Context

## Prinsip Database (Source of Truth)
- Cloudflare D1 adalah *source of truth* untuk seluruh data terstruktur.
- Sistem ini *multi-tenant*. Semua tabel milik client WAJIB memiliki `site_id`.
- `slug` pada project adalah `UNIQUE(site_id, slug)` (bukan global unique).
- *D1 bukan realtime database.*

## Skema Inti D1
1. **sites:** `id`, `slug`, `name`, `status`.
2. **client_access:** `id`, `site_id`, `email`, `password_hash`, `status`, `last_login_at`.
3. **client_password_resets:** `id`, `site_id`, `access_id`, `email`, `token_hash`, `status`, `expires_at`, `used_at`.
4. **site_quota_overrides:** `id`, `site_id`, `project_limit`, `storage_mb`, `media_per_project`.
5. **projects:** `id`, `site_id`, `slug`, `title`, `cover_media_id`, `status` (draft/published), `order_index`.
6. **project_narratives:** `id`, `project_id`, `site_id`, `challenge`, `solution`, `impact`.
7. **media_assets:** `id`, `site_id`, `project_id`, `r2_key`, `public_url`, `alt_text`.
8. **submissions:** `id`, `site_id`, `project_id`, `status`.
9. **ai_generations:** `id`, `site_id`, `input_json`, `output_json`.
10. **audit_logs:** `id`, `site_id`, `action`, `entity_type`.

## Quota Rules
- Default quota berasal dari env `PROJECT_LIMIT`, `STORAGE_MB`, dan `MEDIA_PER_PROJECT`.
- Custom quota per client/site disimpan di `site_quota_overrides`.
- Effective quota adalah default atau nilai custom yang lebih tinggi dari default.
- Nilai custom yang lebih rendah dari default dianggap reset ke default, bukan downgrade.
- Update quota wajib memblokir perubahan jika usage project, storage, atau media/project sudah melebihi next effective quota.

## Index Wajib (Optimasi D1)
- `idx_sites_slug` pada `sites(slug)`
- `idx_client_password_resets_token` pada `client_password_resets(token_hash)`
- `idx_client_password_resets_access_status` pada `client_password_resets(access_id, status)`
- `idx_projects_site_status_order` pada `projects(site_id, status, order_index)`
- `idx_projects_site_slug` pada `projects(site_id, slug)`
- `idx_media_site_project_order` pada `media_assets(site_id, project_id, sort_order)`
- `idx_site_quota_overrides_site` pada `site_quota_overrides(site_id)`

# 02. Backend D1 Context

## Prinsip Database (Source of Truth)
- Cloudflare D1 adalah *source of truth* untuk seluruh data terstruktur.
- Setiap deployment hanya berisi data **satu klien** (1 klien = 1 akun Cloudflare = 1 D1); semua tabel milik client WAJIB tetap memiliki `site_id` sebagai penanda scope data.
- `slug` pada project adalah `UNIQUE(site_id, slug)` (bukan global unique).
- *D1 bukan realtime database.*

## Skema Inti D1
> Daftar ringkas di bawah ini sketsa lama. Daftar tabel yang **sebenarnya** dibaca langsung dari `src/crud/shared/db/schema.ts` (`SHARED_SCHEMA_QUERIES`, 10 tabel — dipasang portal onboarding ke D1 klien) dan `src/lib/d1-schema.ts` (`D1_SCHEMA_QUERIES`, 12 tabel — dipakai `npm run cf:bootstrap`). Rincinya ada di `AGENTS.md` bagian "D1 Schema".

1. **sites:** `id`, `slug`, `name`, `status`.
2. **client_access:** sudah `DROP TABLE` dari database produksi — sisa sistem login client yang dihapus; tidak ada kode yang membacanya lagi.
3. **site_quota_overrides:** `id`, `site_id`, `project_limit`, `storage_mb`, `media_per_project`.
4. **projects:** `id`, `site_id`, `slug`, `title`, `cover_media_id`, `status` (draft/published), `order_index`.
5. **project_narratives:** `id`, `project_id`, `site_id`, `challenge`, `solution`, `impact`.
6. **media_assets:** `id`, `site_id`, `project_id`, `r2_key`, `public_url`, `alt_text`.
7. **submissions:** `id`, `site_id`, `project_id`, `status`.
8. **ai_generations:** `id`, `site_id`, `input_json`, `output_json`.
9. **audit_logs:** `id`, `site_id`, `action`, `entity_type`.

## Quota Rules
- Default quota berasal dari env `PROJECT_LIMIT`, `STORAGE_MB`, dan `MEDIA_PER_PROJECT`.
- Custom quota per client/site disimpan di `site_quota_overrides`.
- Effective quota adalah default atau nilai custom yang lebih tinggi dari default.
- Nilai custom yang lebih rendah dari default dianggap reset ke default, bukan downgrade.
- Update quota wajib memblokir perubahan jika usage project, storage, atau media/project sudah melebihi next effective quota.

## Index Wajib (Optimasi D1)
- `idx_sites_slug` pada `sites(slug)`
- `idx_projects_site_status_order` pada `projects(site_id, status, order_index)`
- `idx_projects_site_slug` pada `projects(site_id, slug)`
- `idx_media_site_project_order` pada `media_assets(site_id, project_id, sort_order)`
- `idx_site_quota_overrides_site` pada `site_quota_overrides(site_id)`

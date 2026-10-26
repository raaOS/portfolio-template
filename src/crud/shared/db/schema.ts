/**
 * Shared Core DDL Schema
 * Schema untuk single-site deployment (1 customer = 1 Cloudflare account).
 *
 * @module
 */

export const SHARED_SCHEMA_QUERIES = [
  // ──────────────────────────────────────────────
  // 1. Sites — informasi site
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    active_template_key TEXT DEFAULT 'os-desktop',
    client_slug_change_count INTEGER NOT NULL DEFAULT 0,
    client_slug_changed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  ) STRICT`,

  // ──────────────────────────────────────────────
  // 2. Site Users — login credentials per site
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS site_users (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT,
    password_algorithm TEXT DEFAULT 'scrypt',
    role TEXT NOT NULL DEFAULT 'admin',
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (site_id) REFERENCES sites(id)
  ) STRICT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_site_users_email ON site_users(site_id, email)`,

  // ──────────────────────────────────────────────
  // 3. Projects — data project portfolio
  // ──────────────────────────────────────────────
  // Kolom `cover_media_id` + `order_index` wajib ADA DI SINI: pembaca runtime
  // (projectSqlService) memakai `ORDER BY order_index`, `INSERT ... order_index`,
  // dan `UPDATE cover_media_id`. Tanpa kolom ini, query project meledak
  // "no such column" di database hasil onboarding portal (audit 2026-10-08,
  // temuan #1). Jangan dihapus tanpa menyesuaikan src/lib/d1-schema.ts.
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    cover_media_id TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    gallery TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    year TEXT DEFAULT '',
    client TEXT DEFAULT '',
    category TEXT DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (site_id) REFERENCES sites(id)
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_projects_site ON projects(site_id)`,
  // Selaras dengan `src/lib/d1-schema.ts` (UNIQUE(site_id, slug)). Tanpa ini,
  // database hasil onboarding portal mengizinkan dua project dengan slug sama
  // → URL publik bentrok (audit 2026-10-24). CREATE IF NOT EXISTS aman diulang;
  // pada data lama yang sudah duplikat, statement ini gagal dan dilewati oleh
  // bootstrap (tidak mengubah data).
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_site_slug ON projects(site_id, slug)`,

  // ──────────────────────────────────────────────
  // 3b. Project Narratives — studi kasus per project
  // (dibaca/ditulis projectSqlService; juga ada di d1-schema.ts)
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS project_narratives (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    challenge TEXT,
    solution TEXT,
    impact TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id)
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_project_narratives_project ON project_narratives(project_id)`,

  // ──────────────────────────────────────────────
  // 4. Media Assets — referensi file di R2
  // `alt_text`/`sort_order`/`updated_at` wajib ada: INSERT pembaca runtime
  // (projectSqlService) menulis ketiganya dan ORDER BY sort_order (audit #1).
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    project_id TEXT,
    r2_key TEXT NOT NULL,
    public_url TEXT NOT NULL DEFAULT '',
    content_type TEXT DEFAULT '',
    size INTEGER DEFAULT 0,
    entity_type TEXT DEFAULT 'project_gallery',
    alt_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (site_id) REFERENCES sites(id)
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_media_assets_site ON media_assets(site_id)`,

  // ──────────────────────────────────────────────
  // 5. Site Settings — pengaturan site (key-value)
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS site_settings (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (site_id) REFERENCES sites(id)
  ) STRICT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(site_id, setting_key)`,

  // ──────────────────────────────────────────────
  // 6. Audit Logs — jejak aktivitas
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT DEFAULT 'site',
    entity_id TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (site_id) REFERENCES sites(id)
  ) STRICT`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_site ON audit_logs(site_id)`,

  // ──────────────────────────────────────────────
  // 7. Rate Limit — proteksi brute force
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TEXT NOT NULL DEFAULT (datetime('now'))
  ) STRICT`,

  // ──────────────────────────────────────────────
  // 8. App KV — key-value store untuk konten legacy
  // (about, experience, skills, contact, testimonials, dll)
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS app_kv (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  ) STRICT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_app_kv_key ON app_kv(key)`,

  // ──────────────────────────────────────────────
  // 9. Portfolio Templates — katalog template yang tersedia
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS portfolio_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  ) STRICT`,

  // ──────────────────────────────────────────────
  // 10. Site Template Entitlements — template yang dibeli per site
  // ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS site_template_entitlements (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
    price INTEGER NOT NULL DEFAULT 0,
    granted_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (site_id) REFERENCES sites(id),
    FOREIGN KEY (template_id) REFERENCES portfolio_templates(id)
  ) STRICT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_site_template ON site_template_entitlements(site_id, template_id)`,
] as const;

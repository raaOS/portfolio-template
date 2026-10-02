/**
 * Cloudflare D1 Relational Schema Definitions
 * Berisi DDL SQL statis untuk migrasi tabel V6 (Cloudflare-only).
 */

export const SITE_QUOTA_OVERRIDES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS site_quota_overrides (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL UNIQUE,
    project_limit INTEGER,
    storage_mb INTEGER,
    media_per_project INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (project_limit IS NULL OR project_limit > 0),
    CHECK (storage_mb IS NULL OR storage_mb > 0),
    CHECK (media_per_project IS NULL OR media_per_project > 0)
  ) STRICT;`;

export const SITE_QUOTA_OVERRIDES_INDEX_SQL =
  `CREATE INDEX IF NOT EXISTS idx_site_quota_overrides_site ON site_quota_overrides(site_id);`;

export const D1_SCHEMA_QUERIES = [
  // 1. Sites
  `CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    active_template_key TEXT DEFAULT 'os-desktop',
    client_slug_change_count INTEGER NOT NULL DEFAULT 0,
    client_slug_changed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;`,

  // 1b. Site Quota Overrides
  SITE_QUOTA_OVERRIDES_TABLE_SQL,

  // 2. Projects
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    cover_media_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    order_index INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(site_id, slug)
  ) STRICT;`,

  // 3. Project Narratives
  `CREATE TABLE IF NOT EXISTS project_narratives (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    challenge TEXT,
    solution TEXT,
    impact TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;`,

  // 4. Media Assets
  `CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    project_id TEXT,
    r2_key TEXT NOT NULL,
    public_url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;`,

  // 5. Submissions
  `CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'needs_review',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;`,

  // 6. AI Generations
  `CREATE TABLE IF NOT EXISTS ai_generations (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    input_json TEXT NOT NULL,
    output_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;`,

  // 7. Audit Logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;`,

  // 8. Orders (Billing Checkout)
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    site_id TEXT,
    template_id TEXT,
    desired_slug TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    buyer_whatsapp TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'manual_qris',
    payment_proof_url TEXT,
    cancel_reason TEXT,
    access_token_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending_payment',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;`,

  // 10. Site Custom Domains
  `CREATE TABLE IF NOT EXISTS site_custom_domains (
    site_id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL UNIQUE,
    cloudflare_hostname_id TEXT,
    hostname_status TEXT NOT NULL DEFAULT 'pending',
    ssl_status TEXT NOT NULL DEFAULT 'pending_validation',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;`,

  // 13. Aggregated Site Analytics
  `CREATE TABLE IF NOT EXISTS site_analytics (
    site_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    target_slug TEXT NOT NULL DEFAULT 'main',
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_active TEXT NOT NULL,
    PRIMARY KEY (site_id, event_type, target_slug),
    CHECK (event_type IN ('page_view', 'project_view', 'app_view')),
    CHECK (hit_count >= 0)
  ) STRICT;`,

  // 14. Platform Settings (key-value for platform-wide config)
  `CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  ) STRICT;`,

  // ==========================================
  // INDEXES
  // ==========================================
  `CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);`,
  SITE_QUOTA_OVERRIDES_INDEX_SQL,
  `CREATE INDEX IF NOT EXISTS idx_projects_site_status_order ON projects(site_id, status, order_index);`,
  `CREATE INDEX IF NOT EXISTS idx_projects_site_slug ON projects(site_id, slug);`,
  `CREATE INDEX IF NOT EXISTS idx_media_site_project_order ON media_assets(site_id, project_id, sort_order);`,
  // Slug bebas dipakai ulang setelah order diaktifkan (aktivasi membuat situs
  // nyata di tabel `sites` yang punya index slug sendiri). Include 'activated'
  // membuat slug terkunci selamanya — sumber temuan audit #5.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_desired_slug_active ON orders(desired_slug) WHERE status IN ('pending_payment', 'waiting_verification', 'activating');`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_amount_active ON orders(amount) WHERE status IN ('pending_payment', 'waiting_verification', 'activating');`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(buyer_email);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_site_custom_domains_hostname ON site_custom_domains(hostname);`,
  `CREATE INDEX IF NOT EXISTS idx_site_analytics_site ON site_analytics(site_id);`,
];

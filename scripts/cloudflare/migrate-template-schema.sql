-- Migration Script for Multi-Template Marketplace Tables
-- Run with: npx wrangler d1 execute portfolio-os --remote --file=./scripts/cloudflare/migrate-template-schema.sql

-- 1. Add active_template_key to sites table (if not exists)
ALTER TABLE sites ADD COLUMN active_template_key TEXT DEFAULT 'os-desktop';

-- 2. Create portfolio_templates catalog table
CREATE TABLE IF NOT EXISTS portfolio_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'landing',
  tier_required TEXT NOT NULL DEFAULT 'lite',
  price_idr INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  preview_image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

-- 3. Create site_template_entitlements table
CREATE TABLE IF NOT EXISTS site_template_entitlements (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, template_id)
) STRICT;

-- 4. Create site_template_settings table
CREATE TABLE IF NOT EXISTS site_template_settings (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, template_id)
) STRICT;

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_template_entitlements_site ON site_template_entitlements(site_id);
CREATE INDEX IF NOT EXISTS idx_template_settings_site_tpl ON site_template_settings(site_id, template_id);

-- 6. Seed Default Templates
INSERT OR IGNORE INTO portfolio_templates (id, name, description, category, tier_required, price_idr, is_active)
VALUES 
  ('os-desktop', 'macOS Desktop Simulator', 'Simulasi desktop macOS interaktif dengan windowing, dock, dan audio.', 'os', 'lite', 0, 1);

-- 7. Cleanup template yang sudah di-retire dari katalog (aman dijalankan berulang)
DELETE FROM portfolio_templates WHERE id IN ('landing-editorial', '3d-spatial', 'landing-bento');
DELETE FROM site_template_entitlements WHERE template_id IN ('landing-editorial', '3d-spatial', 'landing-bento');
DELETE FROM site_template_settings WHERE template_id IN ('landing-editorial', '3d-spatial', 'landing-bento');
UPDATE sites SET active_template_key = 'os-desktop' WHERE active_template_key IN ('landing-editorial', '3d-spatial', 'landing-bento');

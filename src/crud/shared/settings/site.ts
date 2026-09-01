/**
 * Shared Core — Site Settings Service
 * CRUD for per-site settings in D1.
 *
 * @module
 */
import { queryD1, bootstrapD1Schema } from '@/crud/shared/db/connection';

export interface SiteSetting {
  key: string;
  value: unknown;
}

/**
 * Get a setting by key for a site.
 */
export async function getSiteSetting<T = unknown>(siteId: string, key: string): Promise<T | null> {
  await bootstrapD1Schema();
  const rows = await queryD1<{ setting_value: string }>(
    `SELECT setting_value FROM site_settings WHERE site_id = ? AND setting_key = ? LIMIT 1`,
    [siteId, key]
  );
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].setting_value) as T;
  } catch {
    return null;
  }
}

/**
 * Get all settings for a site.
 */
export async function getAllSiteSettings(siteId: string): Promise<SiteSetting[]> {
  await bootstrapD1Schema();
  const rows = await queryD1<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value FROM site_settings WHERE site_id = ?`,
    [siteId]
  );
  return rows.map((row) => ({
    key: row.setting_key,
    value: (() => { try { return JSON.parse(row.setting_value); } catch { return null; } })(),
  }));
}

/**
 * Set a setting for a site (upsert).
 */
export async function setSiteSetting(siteId: string, key: string, value: unknown): Promise<void> {
  await bootstrapD1Schema();
  const now = new Date().toISOString();
  await queryD1(
    `INSERT INTO site_settings (id, site_id, setting_key, setting_value, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(site_id, setting_key)
     DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`,
    [`setting_${siteId}_${key}`, siteId, key, JSON.stringify(value), now]
  );
}

/**
 * Delete a setting for a site.
 */
export async function deleteSiteSetting(siteId: string, key: string): Promise<void> {
  await bootstrapD1Schema();
  await queryD1(
    `DELETE FROM site_settings WHERE site_id = ? AND setting_key = ?`,
    [siteId, key]
  );
}

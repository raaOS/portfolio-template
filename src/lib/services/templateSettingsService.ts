/**
 * Template Settings Service
 * Baca/tulis settings kustomisasi template per site di D1 (`site_template_settings`).
 * Payload disimpan sebagai JSON; validasi/merge per-template dilakukan di layer
 * masing-masing template (mis. `normalizeBentoSettings`).
 * @module
 */

import { queryD1, isD1Configured, bootstrapD1Schema } from '@/lib/cloudflareD1';
import type { SiteTemplateSettings } from '@/types/template';

export class TemplateSettingsService {
  /**
   * Mengambil settings tersimpan untuk (siteId, templateId).
   * Mengembalikan null jika D1 tidak configured, row tidak ada, atau JSON rusak.
   */
  async getSettings(siteId: string, templateId: string): Promise<SiteTemplateSettings | null> {
    if (!isD1Configured()) return null;

    try {
      await bootstrapD1Schema();
      const rows = await queryD1<{ settings_json: string }>(
        `SELECT settings_json FROM site_template_settings WHERE site_id = ? AND template_id = ? LIMIT 1`,
        [siteId, templateId]
      );

      const raw = rows[0]?.settings_json;
      if (!raw) return null;

      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

      return { templateId, ...(parsed as Omit<SiteTemplateSettings, 'templateId'>) };
    } catch (err) {
      console.warn('[TemplateSettingsService] getSettings error:', err);
      return null;
    }
  }

  /**
   * Menyimpan (upsert) settings untuk (siteId, templateId).
   * Field `templateId` tidak ikut diserialisasi ke JSON (sudah jadi kolom).
   */
  async saveSettings(
    siteId: string,
    templateId: string,
    settings: Omit<SiteTemplateSettings, 'templateId'>
  ): Promise<boolean> {
    if (!isD1Configured()) return false;

    try {
      await bootstrapD1Schema();
      const now = new Date().toISOString();
      await queryD1(
        `INSERT INTO site_template_settings (id, site_id, template_id, settings_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(site_id, template_id)
         DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`,
        [`ts_${crypto.randomUUID()}`, siteId, templateId, JSON.stringify(settings), now]
      );
      return true;
    } catch (err) {
      console.error('[TemplateSettingsService] saveSettings error:', err);
      return false;
    }
  }
}

export const templateSettingsService = new TemplateSettingsService();

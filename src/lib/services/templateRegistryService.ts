/**
 * Template Registry Service
 * Mengatur resolusi template aktif tenant, periksa entitlement, dan fallback aman.
 * @module
 */

import { BUILTIN_TEMPLATES, SYSTEM_DEFAULT_TEMPLATE_ID, getBuiltinTemplate } from '@/lib/templates/registry';
import { queryD1, isD1Configured, bootstrapD1Schema } from '@/lib/cloudflareD1';
import type { TemplateMetadata } from '@/types/template';

export interface SiteEntitlementRow {
  site_id: string;
  template_id: string;
}

export class TemplateRegistryService {
  /**
   * Mengembalikan metadata template berdasarkan ID (baik builtin atau dari D1 catalog)
   */
  async getTemplateMetadata(templateId: string): Promise<TemplateMetadata | null> {
    if (!isD1Configured()) return getBuiltinTemplate(templateId) ?? null;

    try {
      await bootstrapD1Schema();
      const rows = await queryD1<{
        id: string;
        name: string;
        description: string;
        category: 'os' | 'landing' | '3d';
        tier_required: 'lite' | 'pro';
        price_idr: number;
        is_active: number;
        preview_image_url: string;
      }>(`SELECT * FROM portfolio_templates WHERE id = ? AND is_active = 1 LIMIT 1`, [templateId]);

      if (rows[0]) {
        return {
          id: rows[0].id,
          name: rows[0].name,
          description: rows[0].description,
          category: rows[0].category,
          tierRequired: rows[0].tier_required,
          priceIdr: rows[0].price_idr,
          isActive: Boolean(rows[0].is_active),
          previewImageUrl: rows[0].preview_image_url,
        };
      }
    } catch (err) {
      console.warn('[TemplateRegistryService] Error reading template from D1:', err);
    }

    return getBuiltinTemplate(templateId) ?? null;
  }

  /**
   * Mengembalikan seluruh daftar template aktif
   */
  async getAllTemplates(): Promise<TemplateMetadata[]> {
    const templatesMap = new Map<string, TemplateMetadata>();

    // Load builtins first
    for (const t of BUILTIN_TEMPLATES) {
      templatesMap.set(t.id, t);
    }

    if (isD1Configured()) {
      try {
        await bootstrapD1Schema();
        const rows = await queryD1<{
          id: string;
          name: string;
          description: string;
          category: 'os' | 'landing' | '3d';
          tier_required: 'lite' | 'pro';
          price_idr: number;
          is_active: number;
          preview_image_url: string;
        }>(`SELECT * FROM portfolio_templates WHERE is_active = 1`);

        for (const r of rows) {
          templatesMap.set(r.id, {
            id: r.id,
            name: r.name,
            description: r.description,
            category: r.category,
            tierRequired: r.tier_required,
            priceIdr: r.price_idr,
            isActive: Boolean(r.is_active),
            previewImageUrl: r.preview_image_url,
          });
        }
      } catch (err) {
        console.warn('[TemplateRegistryService] Error loading templates from D1:', err);
      }
    }

    return Array.from(templatesMap.values());
  }

  /**
   * Memeriksa apakah suatu site berhak menggunakan template ID tertentu
   */
  async canSiteUseTemplate(siteId: string, siteTier: string, templateId: string): Promise<boolean> {
    if (templateId === SYSTEM_DEFAULT_TEMPLATE_ID) return true;

    const metadata = await this.getTemplateMetadata(templateId);
    if (!metadata || !metadata.isActive) return false;

    // 1. Jika template berstatus Lite, semua site (Lite/Pro) berhak
    if (metadata.tierRequired === 'lite' && metadata.priceIdr === 0) return true;

    // 2. Jika site ber-tier Pro dan template tidak berbayar standalone tambahan, site Pro berhak
    if (siteTier === 'pro' && metadata.priceIdr === 0) return true;

    // 3. Periksa entitlement khusus di D1 (`site_template_entitlements`)
    if (isD1Configured()) {
      try {
        await bootstrapD1Schema();
        const rows = await queryD1<SiteEntitlementRow>(
          `SELECT site_id, template_id FROM site_template_entitlements WHERE site_id = ? AND template_id = ? LIMIT 1`,
          [siteId, templateId]
        );
        if (rows.length > 0) return true;
      } catch (err) {
        console.warn('[TemplateRegistryService] Error checking entitlement:', err);
      }
    }

    return false;
  }

  /**
   * Menyelesaikan template aktif yang akan dirender.
   * Mengembalikan templateKey valid yang berhak, atau fallback aman ke 'os-desktop'.
   */
  async resolveActiveTemplate(siteId: string, siteTier: string, requestedKey?: string): Promise<string> {
    const targetKey = requestedKey || SYSTEM_DEFAULT_TEMPLATE_ID;

    const isAllowed = await this.canSiteUseTemplate(siteId, siteTier, targetKey);
    if (isAllowed) return targetKey;

    // FIX: Jangan diam-diam fallback — log agar observable di monitoring.
    console.warn(
      `[TemplateRegistryService] Site ${siteId} (${siteTier}) tidak entitled untuk template "${targetKey}"; fallback ke "${SYSTEM_DEFAULT_TEMPLATE_ID}".`
    );
    return SYSTEM_DEFAULT_TEMPLATE_ID;
  }
}

export const templateRegistryService = new TemplateRegistryService();

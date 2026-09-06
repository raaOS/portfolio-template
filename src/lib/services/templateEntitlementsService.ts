/**
 * Template Entitlements Service
 * Kelola template yang dibeli per site.
 *
 * @module
 */
import { queryD1 } from '@/crud/shared/db/connection';

export interface TemplateEntitlement {
  id: string;
  site_id: string;
  template_id: string;
  purchased_at: string;
  price: number;
  granted_by: string | null;
  created_at: string;
}

export interface PortfolioTemplate {
  id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

class TemplateEntitlementsService {
  /**
   * Get all templates available in the system.
   */
  async getAllTemplates(): Promise<PortfolioTemplate[]> {
    const rows = await queryD1<PortfolioTemplate>(
      `SELECT id, name, description, price, is_active, created_at, updated_at
       FROM portfolio_templates
       WHERE is_active = 1
       ORDER BY name`
    );
    return rows.map((r) => ({ ...r, is_active: Boolean(r.is_active) }));
  }

  /**
   * Get a single template by ID.
   */
  async getTemplate(templateId: string): Promise<PortfolioTemplate | null> {
    const rows = await queryD1<PortfolioTemplate>(
      `SELECT id, name, description, price, is_active, created_at, updated_at
       FROM portfolio_templates
       WHERE id = ?`,
      [templateId]
    );
    if (rows.length === 0) return null;
    return { ...rows[0], is_active: Boolean(rows[0].is_active) };
  }

  /**
   * Get all entitlements for a site.
   */
  async getSiteEntitlements(siteId: string): Promise<TemplateEntitlement[]> {
    return queryD1<TemplateEntitlement>(
      `SELECT id, site_id, template_id, purchased_at, price, granted_by, created_at
       FROM site_template_entitlements
       WHERE site_id = ?
       ORDER BY purchased_at DESC`,
      [siteId]
    );
  }

  /**
   * Check if a site has access to a specific template.
   */
  async hasAccess(siteId: string, templateId: string): Promise<boolean> {
    const rows = await queryD1<{ id: string }>(
      `SELECT id FROM site_template_entitlements
       WHERE site_id = ? AND template_id = ? LIMIT 1`,
      [siteId, templateId]
    );
    return rows.length > 0;
  }

  /**
   * Get all template IDs that a site has access to.
   */
  async getEntitledTemplateIds(siteId: string): Promise<string[]> {
    const rows = await queryD1<{ template_id: string }>(
      `SELECT template_id FROM site_template_entitlements
       WHERE site_id = ?`,
      [siteId]
    );
    return rows.map((r) => r.template_id);
  }

  /**
   * Grant entitlement to a site for a template.
   */
  async grantEntitlement(
    siteId: string,
    templateId: string,
    options: { price?: number; grantedBy?: string } = {}
  ): Promise<TemplateEntitlement> {
    const id = `ent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const price = options.price ?? 0;
    const grantedBy = options.grantedBy ?? 'admin';

    await queryD1(
      `INSERT OR IGNORE INTO site_template_entitlements (id, site_id, template_id, purchased_at, price, granted_by, created_at)
       VALUES (?, ?, ?, datetime('now'), ?, ?, datetime('now'))`,
      [id, siteId, templateId, price, grantedBy]
    );

    const rows = await queryD1<TemplateEntitlement>(
      `SELECT id, site_id, template_id, purchased_at, price, granted_by, created_at
       FROM site_template_entitlements
       WHERE site_id = ? AND template_id = ?`,
      [siteId, templateId]
    );

    return rows[0];
  }

  /**
   * Revoke entitlement from a site for a template.
   */
  async revokeEntitlement(siteId: string, templateId: string): Promise<boolean> {
    const result = await queryD1(
      `DELETE FROM site_template_entitlements
       WHERE site_id = ? AND template_id = ?`,
      [siteId, templateId]
    );
    return result.length > 0;
  }
}

export const templateEntitlementsService = new TemplateEntitlementsService();

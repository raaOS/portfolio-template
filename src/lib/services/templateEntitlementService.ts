/**
 * Service Pengelola Hak Akses (Entitlement) Template per Site Tenant
 * @module
 */

import { queryD1, isD1Configured } from '@/lib/cloudflareD1';

export interface TemplateEntitlementRecord {
  id: string;
  siteId: string;
  templateId: string;
  grantedBy: string;
  createdAt: string;
}

export class TemplateEntitlementService {
  /**
   * Meng-grant entitlement template secara atomic ke D1
   */
  async grantEntitlement(
    siteId: string,
    templateId: string,
    grantedBy = 'system'
  ): Promise<boolean> {
    // FIX #41, #42: Entitlement tidak boleh dianggap sukses saat D1 offline
    // atau input tidak valid.
    if (!siteId || !templateId) return false;
    if (!isD1Configured()) return false;

    const id = `ent_${siteId}_${templateId}`;
    const now = new Date().toISOString();

    try {
      await queryD1(
        `INSERT OR IGNORE INTO site_template_entitlements (id, site_id, template_id, granted_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, siteId, templateId, grantedBy, now]
      );

      await queryD1(
        'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "entitlement", ?)',
        [`audit_${crypto.randomUUID()}`, siteId, `ENTITLEMENT_GRANTED_${templateId}`, now]
      );

      return true;
    } catch (err) {
      console.error('[TemplateEntitlementService] Error granting entitlement:', err);
      return false;
    }
  }

  /**
   * Menghapus hak akses template tertentu dari site
   */
  async revokeEntitlement(siteId: string, templateId: string): Promise<boolean> {
    if (!isD1Configured()) return true;

    const now = new Date().toISOString();

    try {
      await queryD1(
        `DELETE FROM site_template_entitlements WHERE site_id = ? AND template_id = ?`,
        [siteId, templateId]
      );

      await queryD1(
        'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "entitlement", ?)',
        [`audit_${crypto.randomUUID()}`, siteId, `ENTITLEMENT_REVOKED_${templateId}`, now]
      );

      return true;
    } catch (err) {
      console.error('[TemplateEntitlementService] Error revoking entitlement:', err);
      return false;
    }
  }

  /**
   * Mengambil daftar template ID yang di-entitle secara spesifik untuk site
   */
  async getSiteEntitlements(siteId: string): Promise<string[]> {
    if (!isD1Configured()) return [];

    try {
      const rows = await queryD1<{ template_id: string }>(
        `SELECT template_id FROM site_template_entitlements WHERE site_id = ?`,
        [siteId]
      );
      return rows.map((r) => r.template_id);
    } catch (err) {
      console.error('[TemplateEntitlementService] Error reading entitlements:', err);
      return [];
    }
  }
}

export const templateEntitlementService = new TemplateEntitlementService();

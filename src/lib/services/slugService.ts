import { queryD1 } from '@/lib/cloudflareD1';

export const RESERVED_SYSTEM_SLUGS = new Set([
  'admin',
  'administrator',
  'api',
  'client',
  'master',
  'about',
  'lab',
  'public',
  'login',
  'projects',
  'checkout',
  'orders',
  'order',
  'support',
  'dashboard',
  'default-site',
  'demo-designer',
  'undefined',
  'null',
  'root',
  'system',
  'user',
  'users',
  'setting',
  'settings',
  'config',
  'auth',
  'contact',
  'cv',
  'lab',
  'templates',
  'template',
  'r2',
]);

export interface SlugValidationResult {
  valid: boolean;
  reason?: string;
  normalizedSlug?: string;
}

export function validateSlugFormat(rawSlug: string): SlugValidationResult {
  if (!rawSlug || typeof rawSlug !== 'string') {
    return { valid: false, reason: 'Slug tidak boleh kosong' };
  }

  const normalized = rawSlug.trim().toLowerCase();

  if (normalized.length < 3) {
    return { valid: false, reason: 'Slug minimal 3 karakter' };
  }

  if (normalized.length > 30) {
    return { valid: false, reason: 'Slug maksimal 30 karakter' };
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(normalized)) {
    return { valid: false, reason: 'Slug hanya boleh menggunakan huruf kecil, angka, dan tanda hubung (-)' };
  }

  if (RESERVED_SYSTEM_SLUGS.has(normalized)) {
    return { valid: false, reason: 'Slug ini dilindungi oleh sistem dan tidak dapat digunakan' };
  }

  return { valid: true, normalizedSlug: normalized };
}

/**
 * Checks whether a normalized slug is available across both active sites and active pending orders.
 */
export async function isSlugAvailable(
  slug: string,
  excludeSiteId?: string
): Promise<boolean> {
  const formatCheck = validateSlugFormat(slug);
  if (!formatCheck.valid || !formatCheck.normalizedSlug) {
    return false;
  }

  const normalized = formatCheck.normalizedSlug;

  // 1. Check existing sites table
  let siteQuery = 'SELECT id FROM sites WHERE LOWER(slug) = ?';
  const siteParams: (string | number | boolean | null)[] = [normalized];

  if (excludeSiteId) {
    siteQuery += ' AND id != ?';
    siteParams.push(excludeSiteId);
  }

  const siteRows = await queryD1<{ id: string }>(siteQuery, siteParams);
  if (siteRows.length > 0) {
    return false;
  }

  // 2. Check active pending/reserved orders table
  const orderRows = await queryD1<{ id: string }>(
    `SELECT id FROM orders 
     WHERE LOWER(desired_slug) = ? 
     AND status IN ('pending_payment', 'waiting_verification', 'activating') 
     AND datetime(expires_at) > datetime('now')`,
    [normalized]
  );

  if (orderRows.length > 0) {
    return false;
  }

  return true;
}

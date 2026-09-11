/**
 * Shared Core — Seed
 * Seeds initial data for a new customer deployment.
 *
 * Content data (about, experience, skills, etc.) is NOT seeded here.
 * The frontend uses fallback JSON files from src/data/ as defaults.
 * Customers customize content via the admin panel.
 *
 * @module
 */
import { queryD1, bootstrapD1Schema, createSite } from './connection';
import { SITE_ID } from '../config';
import { createScryptPasswordRecord } from '../auth/password';

export interface SeedResult {
  siteCreated: boolean;
  adminCreated: boolean;
}

/**
 * Seed the database with initial site and admin user.
 * Content data comes from fallback JSON files (src/data/).
 */
export async function seedDeployment(options: {
  siteName?: string;
  siteSlug?: string;
  adminEmail: string;
  adminPassword: string;
}): Promise<SeedResult> {
  await bootstrapD1Schema();

  const siteName = options.siteName || 'My Portfolio';
  const siteSlug = options.siteSlug || SITE_ID;
  let siteCreated = false;

  // Check if site already exists
  const existingSites = await queryD1<{ id: string }>(
    `SELECT id FROM sites WHERE id = ? LIMIT 1`,
    [SITE_ID]
  );

  if (existingSites.length === 0) {
    await createSite({
      id: SITE_ID,
      slug: siteSlug,
      name: siteName,
      templateKey: 'os-desktop',
    });
    siteCreated = true;
  }

  // Seed default templates if not exists
  const defaultTemplates = [
    { id: 'os-desktop', name: 'OS Desktop', description: 'Portfolio interaktif bergaya desktop macOS dengan window system, dock, dan efek visual.', price: 0 },
    { id: 'infinite-canvas', name: 'Infinite Canvas', description: 'Infinite canvas dengan drag-to-explore dan zoom untuk melihat project.', price: 0 },
  ];

  for (const tmpl of defaultTemplates) {
    const existing = await queryD1<{ id: string }>(
      `SELECT id FROM portfolio_templates WHERE id = ? LIMIT 1`,
      [tmpl.id]
    );
    if (existing.length === 0) {
      await queryD1(
        `INSERT INTO portfolio_templates (id, name, description, price, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
        [tmpl.id, tmpl.name, tmpl.description, tmpl.price]
      );
    }
  }

  // Grant default entitlement (os-desktop) for the site
  const existingEntitlement = await queryD1<{ id: string }>(
    `SELECT id FROM site_template_entitlements WHERE site_id = ? AND template_id = 'os-desktop' LIMIT 1`,
    [SITE_ID]
  );
  if (existingEntitlement.length === 0) {
    const entitlementId = `ent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await queryD1(
      `INSERT INTO site_template_entitlements (id, site_id, template_id, purchased_at, price, granted_by, created_at)
       VALUES (?, ?, ?, datetime('now'), 0, 'system', datetime('now'))`,
      [entitlementId, SITE_ID, 'os-desktop']
    );
  }

  // Create admin user.
  // Guard: INSERT ... SELECT only when no admin exists yet (atomic check).
  // A plain check-then-insert is racy: two concurrent /api/setup calls
  // would both pass `existingUsers.length === 0` and create two admins.
  let adminCreated = false;
  const existingAdmins = await queryD1<{ id: string }>(
    `SELECT id FROM site_users WHERE site_id = ? AND role = 'admin' LIMIT 1`,
    [SITE_ID]
  );

  if (existingAdmins.length === 0) {
    const passwordRecord = createScryptPasswordRecord(options.adminPassword);
    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Atomic: only inserts if no admin row exists for this site.
    // Concurrent setups with different emails both try to insert, but
    // only the first wins the NOT EXISTS guard; the loser returns
    // adminCreated=false and the route layer rejects it below.
    const inserted = await queryD1<{ id: string }>(
      `INSERT INTO site_users (id, site_id, email, password_hash, password_salt, password_algorithm, role, created_at)
       SELECT ?, ?, ?, ?, ?, ?, 'admin', datetime('now')
       WHERE NOT EXISTS (
         SELECT 1 FROM site_users WHERE site_id = ? AND role = 'admin'
       )
       RETURNING id`,
      [
        userId,
        SITE_ID,
        options.adminEmail.toLowerCase().trim(),
        passwordRecord.passwordHash,
        passwordRecord.passwordSalt || '',
        passwordRecord.passwordAlgorithm || 'scrypt',
        SITE_ID,
      ]
    );

    adminCreated = inserted.length > 0;
  }

  return { siteCreated, adminCreated };
}

/**
 * Verify that the deployment is properly seeded.
 */
export async function verifyDeployment(): Promise<{
  hasSite: boolean;
  hasAdmin: boolean;
}> {
  await bootstrapD1Schema();

  const sites = await queryD1<{ id: string }>(
    `SELECT id FROM sites WHERE id = ? LIMIT 1`,
    [SITE_ID]
  );

  const admins = await queryD1<{ id: string }>(
    `SELECT id FROM site_users WHERE site_id = ? AND role = 'admin' LIMIT 1`,
    [SITE_ID]
  );

  return {
    hasSite: sites.length > 0,
    hasAdmin: admins.length > 0,
  };
}

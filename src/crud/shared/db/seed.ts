/**
 * Shared Core — Seed
 * Seeds initial data for a new customer deployment.
 *
 * @module
 */
import { queryD1, bootstrapD1Schema, createSite } from './connection';
import { SITE_ID } from '../config';
import { createScryptPasswordRecord } from '../auth/password';

export interface SeedResult {
  siteCreated: boolean;
  adminCreated: boolean;
  contentSeeded: boolean;
}

/**
 * Seed the database with initial site, admin user, and content data.
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

  // Create admin user
  let adminCreated = false;
  const existingUsers = await queryD1<{ id: string }>(
    `SELECT id FROM site_users WHERE site_id = ? AND email = ? LIMIT 1`,
    [SITE_ID, options.adminEmail.toLowerCase().trim()]
  );

  if (existingUsers.length === 0) {
    const passwordRecord = createScryptPasswordRecord(options.adminPassword);
    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await queryD1(
      `INSERT INTO site_users (id, site_id, email, password_hash, password_salt, password_algorithm, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'admin', datetime('now'))`,
      [
        userId,
        SITE_ID,
        options.adminEmail.toLowerCase().trim(),
        passwordRecord.passwordHash,
        passwordRecord.passwordSalt || '',
        passwordRecord.passwordAlgorithm || 'scrypt',
      ]
    );
    adminCreated = true;
  }

  // Seed content data
  let contentSeeded = false;
  const contentKeys = [
    { key: 'about', value: JSON.stringify({ headline: '', description: '', bio: '' }) },
    { key: 'experience', value: '[]' },
    { key: 'skills', value: '[]' },
    { key: 'contact', value: JSON.stringify({ email: '', phone: '', location: '' }) },
    { key: 'testimonials', value: '[]' },
    { key: 'interests', value: '[]' },
    { key: 'philosophy', value: JSON.stringify({ quote: '', principles: [] }) },
  ];

  for (const item of contentKeys) {
    const existing = await queryD1<{ id: string }>(
      `SELECT id FROM app_kv WHERE key = ? LIMIT 1`,
      [item.key]
    );

    if (existing.length === 0) {
      await queryD1(
        `INSERT INTO app_kv (id, key, value, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [`${SITE_ID}-${item.key}`, item.key, item.value]
      );
      contentSeeded = true;
    }
  }

  return { siteCreated, adminCreated, contentSeeded };
}

/**
 * Verify that the deployment is properly seeded.
 */
export async function verifyDeployment(): Promise<{
  hasSite: boolean;
  hasAdmin: boolean;
  hasContent: boolean;
  contentKeys: string[];
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

  const contentRows = await queryD1<{ key: string }>(
    `SELECT key FROM app_kv`,
    []
  );

  return {
    hasSite: sites.length > 0,
    hasAdmin: admins.length > 0,
    hasContent: contentRows.length > 0,
    contentKeys: contentRows.map((r: { key: string }) => r.key),
  };
}

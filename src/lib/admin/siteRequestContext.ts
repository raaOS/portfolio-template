import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { queryD1 } from '@/lib/cloudflareD1';
import { SITE_ID } from '@/crud/shared/config';

const DEFAULT_SITE_ID = SITE_ID;

type SiteLookupRow = {
  id: string;
  slug: string | null;
};

export class SiteContextError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'SiteContextError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getBodySiteId(body?: unknown) {
  if (!isRecord(body)) return null;
  return clean(body.siteId) || clean(body.site_id);
}

function getBodySiteSlug(body?: unknown) {
  if (!isRecord(body)) return null;
  return clean(body.siteSlug) || clean(body.site_slug);
}

async function getSiteBySlug(slug: string) {
  const rows = await queryD1<SiteLookupRow>(
    `SELECT id, slug FROM sites WHERE slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] ?? null;
}

async function getSiteById(siteId: string) {
  const rows = await queryD1<SiteLookupRow>(
    `SELECT id, slug FROM sites WHERE id = ? LIMIT 1`,
    [siteId]
  );
  return rows[0] ?? null;
}

export function stripSiteContext<T>(body: T): T {
  if (!isRecord(body)) return body;
  const { siteId: _siteId, site_id: _site_id, siteSlug: _siteSlug, site_slug: _site_slug, ...rest } =
    body;
  return rest as T;
}

export async function resolveRequestSiteId(request: NextRequest, body?: unknown) {
  const { searchParams } = new URL(request.url);

  const explicitSiteId =
    getBodySiteId(body) ||
    clean(request.headers.get('x-site-id')) ||
    clean(searchParams.get('siteId'));

  if (explicitSiteId) return explicitSiteId;

  const explicitSlug =
    getBodySiteSlug(body) ||
    clean(request.headers.get('x-site-slug')) ||
    clean(searchParams.get('siteSlug')) ||
    clean(searchParams.get('site'));

  if (explicitSlug) {
    const site = await getSiteBySlug(explicitSlug);
    if (!site) {
      throw new SiteContextError(`Site slug "${explicitSlug}" not found`, 404);
    }
    return site.id;
  }

  return DEFAULT_SITE_ID;
}

export async function assertKnownSite(siteId: string) {
  const finalSiteId = siteId.trim() || DEFAULT_SITE_ID;
  if (finalSiteId === DEFAULT_SITE_ID) return { id: DEFAULT_SITE_ID, slug: null };

  const site = await getSiteById(finalSiteId);
  if (!site) {
    throw new SiteContextError(`Site "${finalSiteId}" not found`, 404);
  }
  return site;
}

function revalidate(path: string, type?: 'layout' | 'page') {
  if (type) {
    revalidatePath(path, type);
    return;
  }
  revalidatePath(path);
}

export async function revalidateSiteContentPaths(siteId: string, paths: string[] = ['/']) {
  const uniquePaths = Array.from(new Set(paths));

  if (siteId === DEFAULT_SITE_ID) {
    uniquePaths.forEach((path) => revalidate(path, path === '/' ? 'layout' : undefined));
    return;
  }

  const site = await getSiteById(siteId).catch(() => null);
  const slug = site?.slug;
  if (!slug) return;

  revalidate(`/${slug}`, 'layout');
  if (uniquePaths.includes('/projects')) {
    revalidate(`/${slug}/projects`);
  }
}

export async function revalidateSiteProjectPaths(siteId: string, projectSlugs: string[] = []) {
  if (siteId === DEFAULT_SITE_ID) {
    revalidate('/', 'layout');
    revalidate('/projects');
    projectSlugs.filter(Boolean).forEach((slug) => revalidate(`/projects/${slug}`));
    return;
  }

  const site = await getSiteById(siteId).catch(() => null);
  const slug = site?.slug;
  if (!slug) return;

  revalidate(`/${slug}`, 'layout');
  revalidate(`/${slug}/projects`);
  projectSlugs.filter(Boolean).forEach((projectSlug) => {
    revalidate(`/${slug}/projects/${projectSlug}`);
  });
}

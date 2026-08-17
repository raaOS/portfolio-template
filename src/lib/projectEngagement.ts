const DEFAULT_SITE_ID = 'default-site';

export function normalizeEngagementSiteId(siteId: string | null | undefined) {
  const normalized = siteId?.trim() || DEFAULT_SITE_ID;
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error('Invalid site id');
  }
  return normalized;
}

export function buildCommentPath(siteId: string | null | undefined, slug: string) {
  return `comments/${normalizeEngagementSiteId(siteId)}/${slug}`;
}

export function buildMetricsPath(siteId: string | null | undefined, slug: string) {
  return `metrics/metrics/${normalizeEngagementSiteId(siteId)}/${slug}`;
}

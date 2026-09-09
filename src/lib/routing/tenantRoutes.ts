const RESERVED_TOP_LEVEL_SEGMENTS = new Set([
  'admin',
  'api',
  'client',
  'contact',
  'checkout',
  'cv',
  'lab',
  'orders',
  'preview',
  'projects',
  'r2',
  'robots.txt',
  'sitemap.xml',
  'sw.js',
  'templates',
]);

function cleanPathname(pathname: string | null | undefined) {
  return (pathname ?? '').split(/[?#]/)[0] || '/';
}

export function getTopLevelSegment(pathname: string | null | undefined) {
  return cleanPathname(pathname).split('/').filter(Boolean)[0] ?? '';
}

export function isTenantRoute(pathname: string | null | undefined) {
  const segment = getTopLevelSegment(pathname);
  return Boolean(segment && !RESERVED_TOP_LEVEL_SEGMENTS.has(segment));
}

export function getTenantBasePath(pathname: string | null | undefined) {
  if (!isTenantRoute(pathname)) return '';
  return `/${getTopLevelSegment(pathname)}`;
}

export function isProjectsRoute(pathname: string | null | undefined) {
  const segments = cleanPathname(pathname).split('/').filter(Boolean);
  return segments[0] === 'projects' || segments[1] === 'projects';
}

export function buildTenantProjectsHref(pathname: string | null | undefined, queryString?: string) {
  const query = queryString ? (queryString.startsWith('?') ? queryString : `?${queryString}`) : '';
  return `${getTenantBasePath(pathname)}/projects${query}`;
}

export function buildTenantProjectDetailHref(pathname: string | null | undefined, slug: string) {
  return `${getTenantBasePath(pathname)}/projects/${slug}`;
}

export function buildTenantHomeHref(pathname: string | null | undefined, queryString?: string) {
  const basePath = getTenantBasePath(pathname) || '/preview/os-desktop';
  const query = queryString ? (queryString.startsWith('?') ? queryString : `?${queryString}`) : '';
  return `${basePath}${query}`;
}

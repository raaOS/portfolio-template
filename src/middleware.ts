/**
 * Cloudflare/OpenNext middleware entrypoint.
 *
 * Next proxy.ts runs as Node.js middleware in this project, while OpenNext
 * Cloudflare requires Edge middleware. Keep this file as the active request
 * interception entry for the full Cloudflare target.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isStaticAsset, addSecurityHeaders, shouldRedirectToHttps } from './middleware/utils';
import { checkCustomerAuth } from './middleware/customer-auth';
import { checkCSRF } from './middleware/csrf';
import { customDomainService, isCustomDomainEnabled } from './lib/services/customDomainService';

function getHostname(request: NextRequest) {
  return (request.headers.get('host') || request.nextUrl.hostname)
    .split(':')[0]
    .trim()
    .toLowerCase();
}

function isPlatformHostname(hostname: string) {
  const configured = [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value as string).hostname.toLowerCase()];
      } catch {
        return [];
      }
    });
  return (
    configured.includes(hostname) ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.workers.dev') ||
    hostname.endsWith('.pages.dev')
  );
}

// Path yang tetap dilayani oleh platform (bukan tenant site) di custom domain.
// Tanpa allowlist ini, `/checkout`, `/orders`, `/templates`, `/client` di
// domain tenant di-rewrite ke `/{slug}/...` dan menjadi 404.
const PLATFORM_PATH_PREFIXES = [
  '/api/',
  '/checkout',
  '/orders',
  '/templates',
  '/preview',
  '/client',
  '/admin',
  '/r2',
  '/_next',
];

function isPlatformPath(pathname: string) {
  return PLATFORM_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldRedirectToHttps(request)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = 'https:';
    return addSecurityHeaders(NextResponse.redirect(redirectUrl, 308));
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (
    isCustomDomainEnabled() &&
    !isPlatformPath(pathname) &&
    !isPlatformHostname(getHostname(request))
  ) {
    const site = await customDomainService.resolveActiveSiteByDomain(getHostname(request));
    if (site && !pathname.startsWith(`/${site.slug}`)) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/${site.slug}${pathname === '/' ? '' : pathname}`;
      return addSecurityHeaders(NextResponse.rewrite(rewriteUrl));
    }
  }

  const csrfResult = checkCSRF(request);
  if (!csrfResult.isValid && csrfResult.response) {
    return addSecurityHeaders(csrfResult.response);
  }

  const authResult = await checkCustomerAuth(request);
  if (!authResult.authenticated && authResult.response) {
    return addSecurityHeaders(authResult.response);
  }

  if (authResult.refreshResponse) {
    return addSecurityHeaders(authResult.refreshResponse);
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/|admin\\.html).*)'],
};

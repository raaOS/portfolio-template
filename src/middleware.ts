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
import { isStorefrontDeployment } from './lib/storefront';

// Jalur mesin penjualan (toko) — hanya hidup di deployment storefront
// (makeitbetter.my.id). Di website klien jalur ini 404 supaya tidak ada
// order yang masuk ke D1 klien dan tidak ada halaman jualan yang tampil.
// Custom domain klien tidak butuh rewrite lagi: halaman `/` deployment klien
// sudah merender portofolio miliknya sendiri (lihat src/app/page.tsx).
const STOREFRONT_ONLY_PREFIXES = ['/checkout', '/orders', '/api/billing', '/api/telegram'];

function isStorefrontOnlyPath(pathname: string) {
  return STOREFRONT_ONLY_PREFIXES.some(
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
    // SECURITY FIX (audit 2026-09-29): jalur aset statis (termasuk
    // `/api/r2/*.svg` yang menyajikan unggahan) sebelumnya keluar tanpa
    // nosniff/CSP sama sekali. Tetap lewati CSRF/auth, tapi header keamanan
    // wajib terpasang.
    return addSecurityHeaders(NextResponse.next());
  }

  if (
    !isStorefrontDeployment() &&
    isStorefrontOnlyPath(pathname)
  ) {
    return addSecurityHeaders(new NextResponse(null, { status: 404 }));
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

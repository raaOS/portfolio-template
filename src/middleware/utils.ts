/**
 * Middleware Utilities — Helper functions untuk middleware pipeline.
 *
 * Menyediakan deteksi route (`isAPIRoute`, `isStaticAsset`) dan injeksi
 * security headers (CSP, HSTS, X-Frame-Options, dll.) pada response.
 *
 * @module middleware/utils
 */
import { NextResponse, type NextRequest } from 'next/server';

export function isAPIRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

export function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    /\.(ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|woff2?|ttf|eot|mp4|webm|wav|mp3|json|xml|txt|map)$/i.test(
      pathname
    )
  );
}

export function shouldRedirectToHttps(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = (forwardedProto || request.nextUrl.protocol.replace(':', '')).toLowerCase();

  if (protocol !== 'http') {
    return false;
  }

  const hostname = request.nextUrl.hostname.toLowerCase();
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === 'production';

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  const cspBase =
    [
      "default-src 'self'",
      isProd
        ? "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com"
        : "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.youtube.com https://s.ytimg.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss: http://localhost:* ws://localhost:* blob:",
      "media-src 'self' https: data: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src 'self' https://www.youtube.com",
      "frame-ancestors 'self'",
    ].join('; ') + ';';

  response.headers.set('Content-Security-Policy', cspBase);

  if (isProd) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

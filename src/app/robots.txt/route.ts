import { NextResponse } from 'next/server';
import { DEFAULT_SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/*',
    'Disallow: /api',
    'Disallow: /api/*',
    'Disallow: /_next',
    'Disallow: /_next/*',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/*',
    'Disallow: /api',
    'Disallow: /api/*',
    '',
    'User-agent: Googlebot-Image',
    'Allow: /assets',
    'Allow: /assets/*',
    '',
    `Host: ${baseUrl}`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, no-transform',
      'CDN-Cache-Control': 'public, max-age=86400, no-transform',
    },
  });
}

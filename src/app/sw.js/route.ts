import { NextResponse } from 'next/server';

/**
 * Legacy service worker handler.
 *
 * Returns 410 Gone untuk memaksa browser unregister SW yang lama.
 * Runtime eksplisit tidak disetel agar kompatibel dengan OpenNext Cloudflare.
 */

export async function GET() {
  return new NextResponse('Service worker disabled', {
    status: 410,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

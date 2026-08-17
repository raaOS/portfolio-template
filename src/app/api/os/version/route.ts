import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/constants';

/**
 * API to get the current application version from the server.
 * Used by VersionGuard for client-side auto-update notifications.
 */

export async function GET() {
  return NextResponse.json(
    { version: APP_VERSION, timestamp: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}

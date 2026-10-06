import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { validateAdminRequest } from '@/lib/auth';
import { clearApplicationCache } from '@/lib/cache/clearApplicationCache';
import { logAdminActivity } from '@/lib/services/auditLogger';

export const dynamic = 'force-dynamic';

const REVALIDATE_PATHS = [
  '/',
  '/about',
  '/projects',
  '/contact',
  '/admin',
  '/api/media',
  '/r2',
] as const;

export async function POST(request: NextRequest) {
  try {
    // Audit HIGH: auth + CSRF (double-submit) + jejak audit — checkAdminAuth
    // saja tidak memverifikasi header CSRF di handler (lapisan kedua).
    const isAuthenticated = await validateAdminRequest(request);
    if (!isAuthenticated) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    REVALIDATE_PATHS.forEach((path) => {
      if (path === '/') {
        revalidatePath(path, 'layout');
        return;
      }
      revalidatePath(path);
    });

    const details = await clearApplicationCache();

    await logAdminActivity(request, 'Clear admin cache', {
      revalidatedPaths: REVALIDATE_PATHS,
      details,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Cache server dan client cache signal berhasil dibersihkan',
      details,
      client: {
        clearSiteData: true,
        clearCacheStorage: true,
        clearReactQuery: true,
        clearSwr: true,
      },
    });

    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Clear-Site-Data', '"cache"');

    return response;
  } catch (error) {
    console.error('[ClearCache] Error:', error);
    return NextResponse.json({ message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}

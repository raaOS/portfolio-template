import { NextRequest, NextResponse } from 'next/server';
import { loadHomepageData } from '@/lib/loaders';
import {
  assertKnownSite,
  resolveRequestSiteId,
  SiteContextError,
} from '@/lib/admin/siteRequestContext';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    const siteId = await resolveRequestSiteId(request);
    await assertKnownSite(siteId);
    const data = await loadHomepageData(siteId);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API/Homepage] Failed to load homepage data:', error);
    return NextResponse.json({ error: 'Failed to load homepage data' }, { status: 500 });
  }
}

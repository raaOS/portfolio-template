import { NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { aboutService } from '@/lib/services/aboutService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ siteSlug: string }> }) {
  try {
    const params = await props.params;
    const { siteSlug } = params;
    const site = await getSiteBySlug(siteSlug);

    if (!site || site.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: { code: 'SITE_NOT_FOUND', message: 'Site not found' } },
        { status: 404 }
      );
    }

    const about = await aboutService.getAboutData(false, false, site.id);

    return NextResponse.json({ site, about });
  } catch (error) {
    console.error('[API Public Site GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

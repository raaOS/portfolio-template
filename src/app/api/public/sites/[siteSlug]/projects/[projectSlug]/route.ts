import { NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug, getProjectBySlugAndSiteSlug } from '@/lib/adapters/siteDataAdapter';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ siteSlug: string; projectSlug: string }> }
) {
  try {
    const params = await props.params;
    const { siteSlug, projectSlug } = params;
    const site = await getSiteBySlug(siteSlug);

    if (!site || site.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: { code: 'SITE_NOT_FOUND', message: 'Site not found' } },
        { status: 404 }
      );
    }

    const project = await getProjectBySlugAndSiteSlug(siteSlug, projectSlug);

    if (!project) {
      return NextResponse.json(
        { ok: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[API Public Project Detail GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

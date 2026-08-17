import { NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { projectSqlService } from '@/lib/services/project/projectSqlService';
import { resolveProjectMediaUrls } from '@/lib/urlResolver';

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

    const { projects, lastUpdated } = await projectSqlService.getProjectsSql(site.id, 'published');

    const fixedProjects = resolveProjectMediaUrls(projects);

    return NextResponse.json({ projects: fixedProjects, lastUpdated });
  } catch (error) {
    console.error('[API Public Projects GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

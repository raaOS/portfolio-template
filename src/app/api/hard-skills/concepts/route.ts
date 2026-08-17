import { NextRequest, NextResponse } from 'next/server';
import { hardSkillConceptService } from '@/lib/services/hardSkillConceptService';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

export async function GET(request?: NextRequest) {
  try {
    const siteId = await resolveRequestSiteId(
      request ?? new NextRequest('http://localhost/api/hard-skills/concepts')
    );
    const data = await hardSkillConceptService.getConcepts(false, false, siteId);
    const concepts = data.concepts
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title));

    return NextResponse.json({
      concepts,
      lastUpdated: data.lastUpdated,
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error loading hard skill concepts:', error);
    return NextResponse.json({ error: 'Failed to load hard skill concepts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const siteId = await resolveRequestSiteId(request, body);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const payload = stripSiteContext(body) as {
      title?: unknown;
      description?: unknown;
      order?: unknown;
      isActive?: unknown;
    };
    const { title, description, order } = payload;

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const newConcept = await hardSkillConceptService.createConcept(
      {
        title: String(title),
        description: String(description),
        order: typeof order === 'number' ? order : 0,
        isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
      },
      siteId
    );

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true, concept: newConcept });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating hard skill concept:', error);
    return NextResponse.json({ error: 'Failed to create concept' }, { status: 500 });
  }
}

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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const siteId = await resolveRequestSiteId(request, body);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const updated = await hardSkillConceptService.updateConcept(
      id,
      stripSiteContext(body),
      siteId
    );

    if (!updated) {
      return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
    }

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true, concept: updated });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating hard skill concept:', error);
    return NextResponse.json({ error: 'Failed to update concept' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const siteId = await resolveRequestSiteId(request);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const success = await hardSkillConceptService.deleteConcept(id, siteId);

    if (!success) {
      return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
    }

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting hard skill concept:', error);
    return NextResponse.json({ error: 'Failed to delete concept' }, { status: 500 });
  }
}

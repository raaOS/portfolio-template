import { NextRequest, NextResponse } from 'next/server';
import { experienceService } from '@/lib/services/experienceService';
import { updateExperienceSchema } from '@/lib/validations';
import { validationError } from '@/lib/api-response';
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
      request ?? new NextRequest('http://localhost/api/experience')
    );
    const data = await experienceService.getExperienceData(false, false, siteId);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error reading experience data:', error);
    return NextResponse.json({ error: 'Failed to read experience data' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const siteId = await resolveRequestSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ message: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validationResult = updateExperienceSchema.safeParse(stripSiteContext(rawBody));

    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const { statistics, workExperience } = validationResult.data;

    // Using Partial logic in service
    const data = await experienceService.updateExperienceData({
      statistics,
      workExperience,
    }, siteId);

    await revalidateSiteContentPaths(siteId, ['/', '/about', '/cv']);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating experience data:', error);
    return NextResponse.json({ error: 'Failed to update experience data' }, { status: 500 });
  }
}

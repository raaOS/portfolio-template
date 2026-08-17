import { NextResponse, type NextRequest } from 'next/server';
import { galleryFeaturedService } from '@/lib/services/galleryFeaturedService';
import { galleryFeaturedSchema } from '@/lib/validations';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

export async function GET(request: NextRequest) {
  try {
    const siteId = await resolveRequestSiteId(request);
    const data = await galleryFeaturedService.getFeaturedData(siteId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error reading gallery data:', error);
    return NextResponse.json({ featuredProjectIds: [], lastUpdated: new Date().toISOString() });
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

    const rateLimit = await enforceRequestRateLimit(
      request,
      `gallery_featured:${siteId}`,
      10,
      60_000,
      300_000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const validation = galleryFeaturedSchema.safeParse(stripSiteContext(body));
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid gallery payload',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const uniqueIds = Array.from(new Set(validation.data.featuredProjectIds));
    const newData = await galleryFeaturedService.updateFeaturedData(uniqueIds, siteId);

    await revalidateSiteContentPaths(siteId, ['/', '/projects']);

    return NextResponse.json({ success: true, data: newData });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating gallery data:', error);
    return NextResponse.json({ error: 'Failed to update gallery data' }, { status: 500 });
  }
}

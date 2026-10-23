import { NextRequest, NextResponse } from 'next/server';
import { UpdateAboutData } from '@/types/about';
import { aboutService } from '@/lib/services/aboutService';
import { invalidateAboutCache } from '@/lib/about';
import { updateAboutSchema } from '@/lib/validations';
import { validationError } from '@/lib/api-response';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

// GET - Read about content
export async function GET(request: NextRequest) {
  try {
    const fresh = request.nextUrl.searchParams.get('fresh') === 'true';
    const siteId = await resolveRequestSiteId(request);
    const data = await aboutService.getAboutData(fresh, true, siteId);
    return NextResponse.json(data);
  } catch (error) {
    console.error(
      '[API/About] Error loading about data:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Failed to load about data' }, { status: 500 });
  }
}

// PUT - Update about content (admin only)
export async function PUT(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const siteId = await resolveRequestSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validationResult = updateAboutSchema.safeParse(stripSiteContext(rawBody));

    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const updates: UpdateAboutData = validationResult.data;

    // The service handles the merging logic now
    const updatedData = await aboutService.updateAboutData(updates, siteId);

    // Invalidate cache agar visitor langsung lihat perubahan
    invalidateAboutCache();

    // Revalidate ISR pages — sertakan /preview/* (v1.3.42): halaman demo
    // preview memakai renderer & intro yang sama, tanpa ini perubahan intro
    // config hanya tampil di `/` sedangkan preview basi sampai ISR 60 dtk.
    await revalidateSiteContentPaths(siteId, [
      '/',
      '/about',
      '/preview/os-desktop',
      '/preview/infinite-canvas',
      '/preview/spatial-gallery',
    ]);

    return NextResponse.json({
      success: true,
      data: updatedData,
    });
  } catch (error: unknown) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API/About] Update Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to update about data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

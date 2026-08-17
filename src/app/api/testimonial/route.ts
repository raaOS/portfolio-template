import { NextRequest, NextResponse } from 'next/server';
import { testimonialService } from '@/lib/services/testimonialService';
import {
  createTestimonialSchema,
  deleteTestimonialSchema,
  updateTestimonialSchema,
} from '@/lib/validations';
import { validationError } from '@/lib/api-response';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

export const dynamic = 'force-dynamic';

export async function GET(request?: NextRequest) {
  try {
    const siteId = await resolveRequestSiteId(
      request ?? new NextRequest('http://localhost/api/testimonial')
    );
    const data = await testimonialService.getSiteTestimonials(siteId);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching testimonials:', error);
    return NextResponse.json({ error: 'Failed to read testimonials' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const siteId = await resolveRequestSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validationResult = createTestimonialSchema.safeParse(stripSiteContext(rawBody));
    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const newTestimonial = await testimonialService.createTestimonial(
      validationResult.data,
      siteId
    );

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true, testimonial: newTestimonial });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating testimonial:', error);
    return NextResponse.json({ error: 'Failed to create testimonial' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const siteId = await resolveRequestSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validationResult = updateTestimonialSchema.safeParse(stripSiteContext(rawBody));
    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const { id, ...updates } = validationResult.data;
    const updated = await testimonialService.updateTestimonial(id, updates, siteId);

    if (!updated) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true, testimonial: updated });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating testimonial:', error);
    return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const siteId = await resolveRequestSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validationResult = deleteTestimonialSchema.safeParse(stripSiteContext(rawBody));
    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const success = await testimonialService.deleteTestimonial(validationResult.data.id, siteId);

    if (!success) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting testimonial:', error);
    return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 });
  }
}

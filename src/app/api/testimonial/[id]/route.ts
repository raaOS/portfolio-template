import { NextRequest, NextResponse } from 'next/server';
import { testimonialService } from '@/lib/services/testimonialService';
import { deleteTestimonialSchema, updateTestimonialSchema } from '@/lib/validations';
import { validationError } from '@/lib/api-response';
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
    const rawBody = await request.json();
    const siteId = await resolveRequestSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validationResult = updateTestimonialSchema.safeParse({
      ...(stripSiteContext(rawBody) as Record<string, unknown>),
      id,
    });
    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const { id: _validatedId, ...updates } = validationResult.data;
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

    const validationResult = deleteTestimonialSchema.safeParse({ id });
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

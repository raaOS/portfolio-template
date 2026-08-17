import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getClientSessionFromRequest, validateClientRequest } from '@/lib/clientAuth';
import { getPlanFeatures } from '@/lib/product/sitePlan';
import { testimonialService } from '@/lib/services/testimonialService';
import {
  createTestimonialSchema,
  deleteTestimonialSchema,
  updateTestimonialSchema,
} from '@/lib/validations';
import { unauthorized, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

function featureUnavailable() {
  return NextResponse.json(
    {
      success: false,
      error: 'WhatsApp testimonial manager is available on Pro plan only',
      errorCode: 'FEATURE_REQUIRES_PRO',
    },
    { status: 403 }
  );
}

function limitReached(limit: number) {
  return NextResponse.json(
    {
      success: false,
      error: `Testimonial quota reached (${limit})`,
      errorCode: 'TESTIMONIAL_LIMIT_REACHED',
    },
    { status: 403 }
  );
}

function siteResponse(
  data: Awaited<ReturnType<typeof testimonialService.getSiteTestimonials>>,
  plan: string
) {
  return {
    testimonials: data.testimonials,
    lastUpdated: data.lastUpdated,
    feature: getPlanFeatures(plan),
  };
}

function revalidateTenant(siteSlug: string) {
  revalidatePath(`/${siteSlug}`);
  revalidatePath(`/${siteSlug}`, 'layout');
}

export async function GET(request: NextRequest) {
  try {
    const session = await getClientSessionFromRequest(request);
    if (!session) return unauthorized('Client session is required');

    const feature = getPlanFeatures(session.plan);
    if (!feature.whatsappTestimonials) return featureUnavailable();

    const data = await testimonialService.getSiteTestimonials(session.siteId);
    return NextResponse.json(
      { success: true, data: siteResponse(data, session.plan) },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[Client Testimonials GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read testimonials' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await validateClientRequest(request);
    if (!session) return unauthorized('Client session is required');

    const feature = getPlanFeatures(session.plan);
    if (!feature.whatsappTestimonials) return featureUnavailable();

    const rawBody = await request.json().catch(() => ({}));
    const validationResult = createTestimonialSchema.safeParse(rawBody);
    if (!validationResult.success) return validationError(validationResult.error);

    const currentData = await testimonialService.getSiteTestimonials(session.siteId);
    if (currentData.testimonials.length >= feature.testimonialLimit) {
      return limitReached(feature.testimonialLimit);
    }

    const testimonial = await testimonialService.createTestimonial(
      validationResult.data,
      session.siteId
    );
    revalidateTenant(session.siteSlug);

    return NextResponse.json({ success: true, data: { testimonial, feature } }, { status: 201 });
  } catch (error) {
    console.error('[Client Testimonials POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create testimonial' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await validateClientRequest(request);
    if (!session) return unauthorized('Client session is required');

    const feature = getPlanFeatures(session.plan);
    if (!feature.whatsappTestimonials) return featureUnavailable();

    const rawBody = await request.json().catch(() => ({}));
    const validationResult = updateTestimonialSchema.safeParse(rawBody);
    if (!validationResult.success) return validationError(validationResult.error);

    const { id, ...updates } = validationResult.data;
    const testimonial = await testimonialService.updateTestimonial(id, updates, session.siteId);
    if (!testimonial) {
      return NextResponse.json(
        { success: false, error: 'Testimonial not found', errorCode: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    revalidateTenant(session.siteSlug);
    return NextResponse.json({ success: true, data: { testimonial, feature } });
  } catch (error) {
    console.error('[Client Testimonials PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update testimonial' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await validateClientRequest(request);
    if (!session) return unauthorized('Client session is required');

    const feature = getPlanFeatures(session.plan);
    if (!feature.whatsappTestimonials) return featureUnavailable();

    const rawBody = await request.json().catch(() => ({}));
    const validationResult = deleteTestimonialSchema.safeParse(rawBody);
    if (!validationResult.success) return validationError(validationResult.error);

    const wasDeleted = await testimonialService.deleteTestimonial(
      validationResult.data.id,
      session.siteId
    );
    if (!wasDeleted) {
      return NextResponse.json(
        { success: false, error: 'Testimonial not found', errorCode: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    revalidateTenant(session.siteSlug);
    return NextResponse.json({ success: true, data: { id: validationResult.data.id, feature } });
  } catch (error) {
    console.error('[Client Testimonials DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete testimonial' },
      { status: 500 }
    );
  }
}

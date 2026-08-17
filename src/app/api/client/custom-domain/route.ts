import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateClientRequest } from '@/lib/clientAuth';
import {
  customDomainService,
  isCustomDomainEnabled,
} from '@/lib/services/customDomainService';

const mutationSchema = z
  .object({
    siteId: z.string().trim().min(1).optional(),
    customDomain: z.string().trim().max(253).optional(),
    action: z.enum(['register', 'verify']),
  })
  .strict()
  // FIX #52: customDomain wajib diisi saat action = register.
  .refine(
    (data) => data.action !== 'register' || (data.customDomain ?? '').trim().length > 0,
    {
      message: 'Custom domain is required',
      path: ['customDomain'],
    }
  );

function featureError(plan: string) {
  if (!isCustomDomainEnabled()) {
    return NextResponse.json({ error: 'Custom domain feature is disabled' }, { status: 404 });
  }
  if (plan !== 'pro') {
    return NextResponse.json({ error: 'Custom domain requires the Pro plan' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await validateClientRequest(request, { checkCsrf: false });
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const blocked = featureError(session.plan);
    if (blocked) return blocked;

    const requestedSiteId = request.nextUrl.searchParams.get('siteId');
    if (requestedSiteId && requestedSiteId !== session.siteId) {
      return NextResponse.json({ error: 'Forbidden site context' }, { status: 403 });
    }

    const data = await customDomainService.getStatus(session.siteId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Custom Domain GET Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch custom domain status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await validateClientRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const blocked = featureError(session.plan);
    if (blocked) return blocked;

    const parsed = mutationSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid custom domain payload' }, { status: 400 });
    }
    if (parsed.data.siteId && parsed.data.siteId !== session.siteId) {
      return NextResponse.json({ error: 'Forbidden site context' }, { status: 403 });
    }

    const data =
      parsed.data.action === 'verify'
        ? await customDomainService.verifyDomain(session.siteId)
        : await customDomainService.registerDomain(
            session.siteId,
            parsed.data.customDomain || ''
          );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Custom Domain POST Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update custom domain' },
      { status: 400 }
    );
  }
}

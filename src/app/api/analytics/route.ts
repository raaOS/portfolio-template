import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { analyticsService, isSupportedAnalyticsEvent } from '@/lib/services/analyticsService';
import { SITE_ID } from '@/crud/shared/config';
import { z } from 'zod';

const analyticsPostSchema = z.object({
  event: z.string().min(1).max(100),
  details: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await enforceRequestRateLimit(request, 'analytics_post', 30, 60000, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const body = (await request.json()) as z.infer<typeof analyticsPostSchema>;
    const validation = analyticsPostSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid analytics payload' },
        { status: 400 }
      );
    }

    const { event, details } = validation.data;

    // Daftar event ditutup di service — baris baru = 1 write D1, jadi path /
    // nama event bebas dari pihak luar tidak boleh membuat row tanpa batas.
    if (!isSupportedAnalyticsEvent(event)) {
      return NextResponse.json({ success: false, error: 'Unsupported analytics event' }, { status: 400 });
    }

    const path = typeof details?.path === 'string' ? details.path : undefined;

    await analyticsService.recordHit(SITE_ID, event, path);

    return NextResponse.json({ success: true });
  } catch (err) {
    // Jangan telan error: 500 tanpa log membuat tracking gagal diam-diam
    // dan angka analitik diam-diam nol tanpa sebab yang bisa ditemukan.
    console.error('[api/analytics] POST failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to log event' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Only admins can read analytics
  if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await analyticsService.getSummary(SITE_ID);
  return NextResponse.json({ summary });
}

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analyticsService';
import { validateClientRequest } from '@/lib/clientAuth';
import { queryD1 } from '@/lib/cloudflareD1';
import { getClientIP } from '@/lib/security/request';

// Simple in-memory rate limit for public beacon POST (1 hit per siteId+IP per 10s)
const recentHits = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 10_000;

function isRateLimited(siteId: string, ip: string): boolean {
  const key = `${siteId}:${ip}`;
  const now = Date.now();
  const last = recentHits.get(key) || 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) return true;
  recentHits.set(key, now);

  // Cleanup stale entries every ~100 checks
  if (recentHits.size > 500) {
    for (const [k, ts] of recentHits) {
      if (now - ts > RATE_LIMIT_WINDOW_MS * 3) recentHits.delete(k);
    }
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    // Require authenticated client session
    const session = await validateClientRequest(req, { checkCsrf: false });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await analyticsService.getSummary(session.siteId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[Analytics API GET Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics summary' }, { status: 500 });
  }
}

const VALID_EVENT_TYPES = new Set(['page_view', 'project_view', 'app_view']);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { siteId, eventType, targetSlug } = body || {};

    if (!siteId || !eventType) {
      return NextResponse.json({ error: 'siteId and eventType are required' }, { status: 400 });
    }

    // Validate event type enum
    if (!VALID_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
    }

    // Bound targetSlug — mencegah kolom audit_logs diisi string raksasa
    const normalizedSlug =
      typeof targetSlug === 'string' ? targetSlug.trim().slice(0, 120) : undefined;

    // Validate site exists
    const siteRows = await queryD1<{ id: string }>(
      'SELECT id FROM sites WHERE id = ? AND status = "active" LIMIT 1',
      [siteId]
    );
    if (siteRows.length === 0) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Simple rate limit — pakai IP asli (cf-connecting-ip) karena
    // x-forwarded-for bisa di-spoof attacker.
    const clientIp = getClientIP(req);
    if (isRateLimited(siteId, clientIp)) {
      return NextResponse.json({ success: true, message: 'Rate limited — hit skipped' });
    }

    await analyticsService.recordHit(siteId, eventType, normalizedSlug);

    return NextResponse.json({
      success: true,
      message: 'Hit recorded successfully',
    });
  } catch (error) {
    console.error('[Analytics API POST Error]:', error);
    return NextResponse.json({ error: 'Failed to record analytics hit' }, { status: 500 });
  }
}

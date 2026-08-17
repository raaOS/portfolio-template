import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { db } from '@/lib/database';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// CLOUDFLARE_D1 path for analytics logs
const ANALYTICS_PATH = 'analytics/logs';
const MAX_LOGS = 100;

interface AnalyticsLog {
  id: string;
  timestamp: string;
  event: string;
  details: Record<string, unknown>;
  userAgent: string;
}

interface AnalyticsPostBody {
  event: string;
  details?: Record<string, unknown>;
}

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

    const body = (await request.json()) as AnalyticsPostBody;
    const validation = analyticsPostSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid analytics payload' },
        { status: 400 }
      );
    }

    const { event, details } = validation.data;

    const newLog: AnalyticsLog = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event,
      details: details || {},
      userAgent: request.headers.get('user-agent') || 'Unknown',
    };

    // Write to CLOUDFLARE_D1 asynchronously.
    const logsSnap = await db.ref(ANALYTICS_PATH).once('value');
    const existing: AnalyticsLog[] = logsSnap.exists() ? Object.values(logsSnap.val()) : [];

    // Keep only last MAX_LOGS entries
    const updated = [newLog, ...existing].slice(0, MAX_LOGS);

    // Rewrite as object keyed by id
    const updatedMap: Record<string, AnalyticsLog> = {};
    updated.forEach((log) => {
      updatedMap[log.id] = log;
    });
    await db.ref(ANALYTICS_PATH).set(updatedMap);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to log event' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Only admins can read analytics
  if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logsSnap = await db.ref(ANALYTICS_PATH).once('value');
    const logs: AnalyticsLog[] = logsSnap.exists()
      ? (Object.values(logsSnap.val()) as AnalyticsLog[]).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      : [];

    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}

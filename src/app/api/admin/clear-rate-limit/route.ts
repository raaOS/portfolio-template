import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { logAdminActivity } from '@/lib/services/auditLogger';

export async function POST(request: NextRequest) {
  try {
    // Audit HIGH: auth + CSRF (double-submit) + jejak audit dalam satu helper.
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.NODE_ENV === 'development') {
      await logAdminActivity(request, 'Clear admin rate-limit cache').catch((error) => {
        console.error('[Audit] Failed to log clear rate-limit:', error);
      });

      return NextResponse.json({
        success: true,
        message:
          'Proxy no longer uses in-memory rate limits. Use route-level CLOUDFLARE_D1-backed limits instead.',
      });
    } else {
      return NextResponse.json(
        {
          error: 'This endpoint is only available in development',
        },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error clearing rate limits:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear rate limits',
      },
      { status: 500 }
    );
  }
}

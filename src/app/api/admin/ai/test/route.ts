import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { resolveRequestSiteId } from '@/lib/admin/siteRequestContext';
import { getSiteSetting } from '@/crud/shared/settings/site';
import {
  siteAiConfigSchema,
  testAiConnection,
  type SiteAiConfig,
} from '@/lib/services/aiGatewayService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const isAuthed = await validateAdminRequest(request);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const siteId = await resolveRequestSiteId(request);
    const body = await request.json();

    // Jika apiKey masked atau kosong, coba ambil dari D1 eksisting atau server env
    let effectiveApiKey = (body.apiKey || '').trim();
    if (!effectiveApiKey || effectiveApiKey.includes('...')) {
      const existing = await getSiteSetting<SiteAiConfig>(siteId, 'ai_config');
      if (existing?.apiKey) {
        effectiveApiKey = existing.apiKey;
      } else if (process.env.AI_API_KEY) {
        effectiveApiKey = process.env.AI_API_KEY.trim();
      }
    }

    const payload = {
      enabled: true,
      provider: body.provider || 'gemini',
      apiKey: effectiveApiKey,
      baseUrl: body.baseUrl || undefined,
      model: body.model || undefined,
    };

    const parsed = siteAiConfigSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Format parameter uji coba tidak valid',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const testResult = await testAiConnection(parsed.data);

    return NextResponse.json(testResult);
  } catch (error) {
    console.error('[API/Admin/AI/Test POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Uji coba koneksi gagal dijalankan.',
      },
      { status: 500 }
    );
  }
}

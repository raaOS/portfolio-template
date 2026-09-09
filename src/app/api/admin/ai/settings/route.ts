import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { resolveRequestSiteId } from '@/lib/admin/siteRequestContext';
import { getSiteSetting } from '@/crud/shared/settings/site';
import {
  siteAiConfigSchema,
  saveSiteAiConfig,
  resetSiteAiConfig,
  maskApiKey,
  DEFAULT_MODELS,
  DEFAULT_BASE_URLS,
  type SiteAiConfig,
} from '@/lib/services/aiGatewayService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await validateAdminRequest(request, { checkCsrf: false });
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = await resolveRequestSiteId(request);
    const customConfig = await getSiteSetting<SiteAiConfig>(siteId, 'ai_config');

    const hasServerFallback = !!(process.env.AI_API_KEY || '').trim();
    const serverProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

    if (customConfig) {
      return NextResponse.json({
        success: true,
        isCustom: true,
        hasServerFallback,
        config: {
          enabled: customConfig.enabled ?? true,
          provider: customConfig.provider || 'gemini',
          apiKeyMasked: maskApiKey(customConfig.apiKey || ''),
          hasApiKey: !!customConfig.apiKey,
          baseUrl: customConfig.baseUrl || DEFAULT_BASE_URLS[customConfig.provider] || '',
          model: customConfig.model || DEFAULT_MODELS[customConfig.provider] || '',
        },
      });
    }

    // Default response (fallback)
    return NextResponse.json({
      success: true,
      isCustom: false,
      hasServerFallback,
      config: {
        enabled: hasServerFallback,
        provider: serverProvider,
        apiKeyMasked: hasServerFallback ? '•••• Server Default ••••' : '',
        hasApiKey: hasServerFallback,
        baseUrl: process.env.AI_BASE_URL || DEFAULT_BASE_URLS.gemini,
        model: process.env.AI_MODEL || DEFAULT_MODELS.gemini,
      },
    });
  } catch (error) {
    console.error('[API/Admin/AI/Settings GET] Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil pengaturan AI' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAuthed = await validateAdminRequest(request);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const siteId = await resolveRequestSiteId(request);
    const body = await request.json();

    // Jika apiKey tidak diubah (masih masked atau kosong saat ada config lama), pertahankan apiKey lama
    const existing = await getSiteSetting<SiteAiConfig>(siteId, 'ai_config');
    let effectiveApiKey = (body.apiKey || '').trim();

    if ((!effectiveApiKey || effectiveApiKey.includes('...')) && existing?.apiKey) {
      effectiveApiKey = existing.apiKey;
    }

    const payloadToValidate = {
      ...body,
      apiKey: effectiveApiKey,
    };

    const parsed = siteAiConfigSchema.safeParse(payloadToValidate);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Format pengaturan tidak valid',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    await saveSiteAiConfig(siteId, parsed.data);

    return NextResponse.json({
      success: true,
      message: 'Pengaturan Asisten AI berhasil disimpan.',
      config: {
        ...parsed.data,
        apiKeyMasked: maskApiKey(parsed.data.apiKey),
        apiKey: undefined, // jangan kembalikan raw key
      },
    });
  } catch (error) {
    console.error('[API/Admin/AI/Settings POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan AI' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const isAuthed = await validateAdminRequest(request);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const siteId = await resolveRequestSiteId(request);
    await resetSiteAiConfig(siteId);

    return NextResponse.json({
      success: true,
      message: 'Pengaturan AI dikembalikan ke default server.',
    });
  } catch (error) {
    console.error('[API/Admin/AI/Settings DELETE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal mereset pengaturan AI' },
      { status: 500 }
    );
  }
}

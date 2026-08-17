import { NextRequest, NextResponse } from 'next/server';
import { validateClientRequest } from '@/lib/clientAuth';
import { queryD1 } from '@/lib/cloudflareD1';
import { isSlugAvailable, validateSlugFormat } from '@/lib/services/slugService';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const session = await validateClientRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const body = await request.json();
    const { newSlug } = body;

    if (!newSlug || typeof newSlug !== 'string') {
      return NextResponse.json({ error: 'Slug baru wajib diisi' }, { status: 400 });
    }

    const formatResult = validateSlugFormat(newSlug);
    if (!formatResult.valid || !formatResult.normalizedSlug) {
      return NextResponse.json({ error: formatResult.reason || 'Format slug tidak valid' }, { status: 400 });
    }

    const normalized = formatResult.normalizedSlug;

    if (normalized === session.siteSlug.toLowerCase()) {
      return NextResponse.json({ error: 'Slug baru sama dengan slug saat ini' }, { status: 400 });
    }

    // -----------------------------------------------------------------------
    // Slug change limits: Lite = 1x lifetime, Pro = 7-day cooldown
    // -----------------------------------------------------------------------
    const siteRows = await queryD1<{
      plan: string;
      client_slug_change_count: number;
      client_slug_changed_at: string | null;
    }>(
      'SELECT plan, client_slug_change_count, client_slug_changed_at FROM sites WHERE id = ?',
      [session.siteId]
    );
    const site = siteRows[0];

    if (site) {
      const changeCount = site.client_slug_change_count || 0;
      const plan = site.plan || session.plan;

      if (plan === 'lite' && changeCount >= 1) {
        return NextResponse.json(
          { error: 'Paket Lite hanya mengizinkan 1 kali perubahan slug.' },
          { status: 403 }
        );
      }

      if (plan === 'pro' && site.client_slug_changed_at) {
        const lastChange = new Date(site.client_slug_changed_at);
        const cooldownEnd = new Date(lastChange.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (new Date() < cooldownEnd) {
          const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          return NextResponse.json(
            { error: `Perubahan slug berikutnya tersedia dalam ${remaining} hari.` },
            { status: 429 }
          );
        }
      }
    }

    // Dual-Check Availability excluding current siteId
    const available = await isSlugAvailable(normalized, session.siteId);
    if (!available) {
      return NextResponse.json({ error: 'Slug baru tidak tersedia atau sudah digunakan site lain' }, { status: 409 });
    }

    const now = new Date().toISOString();

    // Atomic update site slug + increment change counter + record timestamp
    await queryD1(
      'UPDATE sites SET slug = ?, client_slug_change_count = client_slug_change_count + 1, client_slug_changed_at = ?, updated_at = ? WHERE id = ?',
      [normalized, now, now, session.siteId]
    );

    // Audit Log
    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "site", ?)',
      [`audit_${crypto.randomUUID()}`, session.siteId, `SITE_SLUG_CHANGED_${session.siteSlug}_TO_${normalized}`, now]
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://makeitbetter.my.id';

    return NextResponse.json({
      success: true,
      message: 'Slug ID berhasil diperbarui',
      oldSlug: session.siteSlug,
      newSlug: normalized,
      publicUrl: `${baseUrl}/${normalized}`
    });
  } catch (error: unknown) {
    console.error('Client slug update API error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui slug ID' }, { status: 500 });
  }
}

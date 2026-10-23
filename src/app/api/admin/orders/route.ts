import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { requireOwnerMode } from '@/lib/ownerMode';
import { getPublicBaseUrl } from '@/lib/constants';
import {
  activateOrder,
  cancelOrder,
  createOrder,
  getAdminOrders,
  reopenOrder,
  sweepExpiredOrders,
} from '@/lib/services/orderService';

export async function GET(request: NextRequest) {
  try {
    // Owner Mode: data bisnis owner (order pembelian site). Guard sebelum
    // auth supaya site klien mendapat 404 — route ini seolah tidak ada di
    // sana (lihat src/lib/ownerMode.ts).
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;

    // validateAdminRequest (bukan checkAdminAuth polos) — mengenali sesi
    // customer site_user_token; checkAdminAuth hanya tahu cookie legacy
    // admin_token → 401. GET tanpa CSRF, pola route admin lain (2026-10-08).
    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // H2: refresh status kadaluwarsa saat admin membuka panel (guarded 10 menit).
    await sweepExpiredOrders();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));

    const result = await getAdminOrders({ search, status }, { page, limit });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('[GET /api/admin/orders] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Owner Mode: sama dengan GET — aksi aktivasi/batal adalah operasi
    // bisnis owner atas pembelian site, bukan milik klien.
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;

    // Audit HIGH: auth + CSRF (double-submit) + jejak audit dalam satu helper —
    // sebelumnya hanya checkAdminAuth (tanpa lapisan CSRF di handler).
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, action, cancelReason, allowExpired, proofUrl } = body;

    // Alur B (chat-first): seller membuat order dari panel setelah deal di
    // WhatsApp, lalu menyalin link checkout ke pembeli. Jalur admin ini sengaja
    // TIDAK lewat rate-limit publik `billing_checkout` (5/menit per IP) karena
    // pemanggilnya owner sendiri — anti-spam publik tidak relevan di sini.
    if (action === 'create') {
      const { buyerName, buyerEmail, buyerWhatsapp, desiredSlug, templateId } = body;

      if (!buyerName || !buyerEmail || !buyerWhatsapp) {
        return NextResponse.json(
          { success: false, error: 'Nama, email, dan WhatsApp pembeli wajib diisi' },
          { status: 400 }
        );
      }

      // Slug opsional — auto-generate dari nama pembeli (sama dengan checkout publik).
      const slug = desiredSlug
        ? String(desiredSlug).trim().toLowerCase()
        : String(buyerName)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 30) || 'portfolio';

      const result = await createOrder(
        {
          buyerName,
          buyerEmail,
          buyerWhatsapp,
          desiredSlug: slug,
          templateId: typeof templateId === 'string' && templateId.trim() ? templateId.trim() : undefined,
        },
        {
          TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
          TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
          APP_BASE_URL: getPublicBaseUrl(),
        }
      );

      if (!result.success || !result.order) {
        return NextResponse.json({ success: false, error: result.error || 'Gagal membuat order' }, { status: 400 });
      }

      // Link checkout hanya bisa ditampilkan SEKARANG: `access_token_hash`
      // disimpan di D1, token mentahnya tidak pernah bisa dibaca lagi. Panel
      // wajib menyalin/mengirimkannya ke pembeli sebelum dialog ditutup.
      const checkoutUrl = result.accessToken
        ? `${getPublicBaseUrl()}/orders/${result.order.id}?token=${result.accessToken}`
        : '';

      return NextResponse.json({
        success: true,
        message: `Order ${result.order.id} dibuat. Salin link checkout ke pembeli.`,
        order: result.order,
        checkoutUrl,
      });
    }

    if (!orderId || !action) {
      return NextResponse.json(
        { success: false, error: 'Parameter orderId dan action wajib diisi' },
        { status: 400 }
      );
    }

    if (action === 'activate') {
      const result = await activateOrder(orderId, {
        // Jalur late-activation: order expired yang sudah dibayar dan diverifikasi
        // mutasinya secara manual oleh admin. proofUrl opsional (link screenshot WA).
        allowExpired: Boolean(allowExpired),
        proofUrl: typeof proofUrl === 'string' && proofUrl.trim() ? proofUrl.trim() : undefined,
      });
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: result.message, siteId: result.siteId });
    }

    if (action === 'cancel') {
      const result = await cancelOrder(orderId, cancelReason);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: result.message, order: result.order });
    }

    if (action === 'reopen') {
      const result = await reopenOrder(orderId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: result.message, order: result.order });
    }

    return NextResponse.json({ success: false, error: 'Action tidak valid' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[POST /api/admin/orders] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

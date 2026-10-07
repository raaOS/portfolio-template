import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth, validateAdminRequest } from '@/lib/auth';
import { activateOrder, cancelOrder, getAdminOrders, reopenOrder, sweepExpiredOrders } from '@/lib/services/orderService';

export async function GET(request: NextRequest) {
  try {
    if (!checkAdminAuth(request)) {
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
    // Audit HIGH: auth + CSRF (double-submit) + jejak audit dalam satu helper —
    // sebelumnya hanya checkAdminAuth (tanpa lapisan CSRF di handler).
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, action, cancelReason, allowExpired, proofUrl } = body;

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

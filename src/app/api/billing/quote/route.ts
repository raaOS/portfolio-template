import { NextRequest, NextResponse } from 'next/server';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { getBasePrice, getBundleTiers } from '@/lib/services/pricingConfigService';
import { evaluateCoupon } from '@/lib/services/couponService';
import { computeQuote } from '@/lib/services/checkoutPricing';
import { getTemplate, TEMPLATES } from '@/lib/templates/registry';

/**
 * POST /api/billing/quote
 *
 * Hitung rincian harga (subtotal, diskon bundel, kupon, total) SEBELUM order
 * dibuat. Endpoint ini TIDAK menulis apa pun: hanya membaca harga & aturan
 * kupon dari D1 owner.
 *
 * Nominal yang ditampilkan di checkout bersifat informasi; nominal yang
 * ditagih selalu dihitung ulang di `createOrder` (server-side, kode sama).
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = await enforceRequestRateLimit(request, 'billing_quote', 30, 60_000, 300_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawIds: unknown = body?.templateIds;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ error: 'templateIds wajib berisi minimal satu template.' }, { status: 400 });
    }

    const seen = new Set<string>();
    const templateIds: string[] = [];
    for (const raw of rawIds) {
      if (typeof raw !== 'string') continue;
      const id = raw.trim();
      if (!id || seen.has(id)) continue;
      if (!getTemplate(id)) {
        return NextResponse.json({ error: 'Template tidak dikenal.' }, { status: 400 });
      }
      seen.add(id);
      templateIds.push(id);
    }

    if (templateIds.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu template.' }, { status: 400 });
    }
    if (templateIds.length > TEMPLATES.length) {
      return NextResponse.json({ error: 'Jumlah template melebihi katalog.' }, { status: 400 });
    }

    const listPrice = await getBasePrice();
    const items = templateIds.map((templateId) => ({ templateId, listPrice }));
    const bundleTiers = templateIds.length > 1 ? await getBundleTiers() : [];

    const couponCode =
      typeof body?.couponCode === 'string' ? body.couponCode.trim() : '';

    let couponRule = null;
    let couponMessage: string | null = null;
    if (couponCode) {
      const evaluation = await evaluateCoupon(couponCode, items);
      if (evaluation.usable && evaluation.rule) {
        couponRule = evaluation.rule;
      } else {
        couponMessage = evaluation.reason || 'Kode kupon tidak valid atau sudah tidak berlaku.';
      }
    }

    const quote = computeQuote({ items, bundleTiers, coupon: couponRule });

    return NextResponse.json({
      success: true,
      listPrice,
      items: quote.items.map((item) => ({
        templateId: item.templateId,
        name: getTemplate(item.templateId)?.name || item.templateId,
        listPrice: item.listPrice,
        discount: item.discount,
        finalPrice: item.finalPrice,
      })),
      itemCount: quote.itemCount,
      subtotal: quote.subtotal,
      bundlePercent: quote.bundlePercent,
      bundleDiscount: quote.bundleDiscount,
      couponCode: quote.appliedSource === 'coupon' ? couponRule?.code ?? null : null,
      couponDiscount: quote.couponDiscount,
      appliedDiscount: quote.appliedDiscount,
      appliedSource: quote.appliedSource,
      total: quote.total,
      couponMessage,
    });
  } catch (error: unknown) {
    console.error('[billing/quote] Gagal menghitung harga:', error);
    return NextResponse.json({ error: 'Gagal menghitung harga.' }, { status: 500 });
  }
}

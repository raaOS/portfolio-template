import { NextRequest, NextResponse } from 'next/server';
import { resolveOrderTemplate } from '@/lib/services/orderService';
import { PLAN_BASE_PRICES } from '@/constants/plans';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const plan = searchParams.get('plan') === 'lite' ? 'lite' : 'pro';
    const templateId = searchParams.get('template')?.trim() || undefined;

    const selection = await resolveOrderTemplate(templateId, plan);
    if (selection.error) {
      return NextResponse.json({ error: selection.error, available: false }, { status: 400 });
    }

    const basePrice = PLAN_BASE_PRICES[plan];
    const extraAmount = selection.extraAmount;
    const total = basePrice + extraAmount;

    return NextResponse.json({
      available: true,
      plan,
      templateId: selection.templateId,
      templateName: selection.templateName,
      basePrice,
      extraAmount,
      total,
    });
  } catch (error: unknown) {
    console.error('Template price API error:', error);
    return NextResponse.json({ error: 'Gagal memuat harga template' }, { status: 500 });
  }
}
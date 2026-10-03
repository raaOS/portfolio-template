import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { activateOrder, cancelOrder } from '@/lib/services/orderService';
import { enforceRequestRateLimit } from '@/lib/security/request';

// SECURITY FIX (audit 2026-09-29):
// 1. Perbandingan secret pakai timing-safe equal.
// 2. Callback hanya diproses bila berasal dari chat admin
//    (TELEGRAM_ADMIN_CHAT_ID) — mengunci notifikasi ke chat yang benar.
// 3. buyer_whatsapp disanitasi (hanya digit) sebelum ditanam ke pesan HTML.

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface TelegramCallbackQuery {
  id?: string;
  data?: string;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number };
  };
}

interface TelegramWebhookPayload {
  callback_query?: TelegramCallbackQuery;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX (audit 2026-09-29): rate limit IP-only — webhook resmi
    // Telegram hanya butuh ~beberapa request/menit saat admin klik tombol.
    const rateLimit = await enforceRequestRateLimit(request, 'telegram_webhook', 30, 60_000, 300_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    // 1. SECURITY: Always verify secret header — reject if not configured
    const secret = process.env.TELEGRAM_BOT_SECRET;
    if (!secret) {
      console.warn('[TelegramWebhook] TELEGRAM_BOT_SECRET is not configured. Rejecting request.');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 403 });
    }

    // Timing-safe compare (length bukan rahasia, lalu byte-per-byte tanpa short-circuit).
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (!headerSecret || !safeEqual(headerSecret, secret)) {
      return NextResponse.json({ error: 'Unauthorized secret token' }, { status: 401 });
    }

    const payload = (await request.json()) as TelegramWebhookPayload;

    // Handle Callback Query (Inline Button Click)
    if (payload.callback_query) {
      const callbackQuery = payload.callback_query;
      const callbackData: string = callbackQuery.data || '';
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      // Izinkan hanya callback dari chat admin. Bila env belum di-set tetap
      // diproses (kompatibilitas setup lama) tapi dicatat.
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChatId && String(chatId) !== adminChatId) {
        console.warn('[TelegramWebhook] Callback from unknown chat ignored:', chatId);
        return NextResponse.json({ ok: true });
      }

      // Handle Activate Order Button
      if (callbackData.startsWith('activate_')) {
        const orderId = callbackData.replace('activate_', '');

        const result = await activateOrder(orderId, {
          APP_BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://makeitbetter.my.id',
        });

        if (botToken && callbackQuery.id) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: result.success ? 'Order berhasil diaktifkan!' : result.message,
              show_alert: true,
            }),
          });
        }

        if (botToken && callbackQuery.message && chatId && messageId && result.success) {
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `${callbackQuery.message.text}\n\n✅ <b>STATUS: ACTIVATED</b>\n<i>${result.message}</i>`,
              parse_mode: 'HTML',
            }),
          });
        }
      }

      // Handle Cancel / Refund Order Button
      if (callbackData.startsWith('cancel_')) {
        const orderId = callbackData.replace('cancel_', '');
        const result = await cancelOrder(orderId);

        if (botToken && callbackQuery.id) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: result.success ? 'Order berhasil dibatalkan/direfund.' : result.message,
              show_alert: true,
            }),
          });
        }

        if (botToken && callbackQuery.message && chatId && messageId && result.success) {
          const waDigits = (result.order?.buyer_whatsapp || '').replace(/\D/g, '');
          const waLink = waDigits
            ? `\n\n💬 <b>Chat WA Pembeli untuk Transfer Balik:</b> https://wa.me/${waDigits}`
            : '';

          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `${callbackQuery.message.text}\n\n❌ <b>STATUS: CANCELED / REFUNDED</b>\n<i>${result.message}</i>${waLink}`,
              parse_mode: 'HTML',
            }),
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Telegram Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

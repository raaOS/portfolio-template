import { NextRequest, NextResponse } from 'next/server';
import { activateOrder, cancelOrder } from '@/lib/services/orderService';

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
    // 1. SECURITY: Always verify secret header — reject if not configured
    const secret = process.env.TELEGRAM_BOT_SECRET;
    if (!secret) {
      console.warn('[TelegramWebhook] TELEGRAM_BOT_SECRET is not configured. Rejecting request.');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 403 });
    }

    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
    // Timing-safe compare — cegah timing attack yang bisa membocorkan secret karakter per karakter.
    // Panjang dibandingkan lebih dulu (length bukan rahasia); isi dibandingkan byte-per-byte tanpa short-circuit.
    const encoder = new TextEncoder();
    const a = encoder.encode(headerSecret);
    const b = encoder.encode(secret);
    if (a.length !== b.length) {
      return NextResponse.json({ error: 'Unauthorized secret token' }, { status: 401 });
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    if (diff !== 0) {
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
          const waLink = result.order?.buyer_whatsapp
            ? `\n\n💬 <b>Chat WA Pembeli untuk Transfer Balik:</b> https://wa.me/${result.order.buyer_whatsapp}`
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

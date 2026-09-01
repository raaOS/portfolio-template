import crypto from 'crypto';
import { queryD1 } from '@/lib/cloudflareD1';
import { cleanEnvVar } from '@/lib/utils/env';
import { isSlugAvailable } from './slugService';
import { getPaymentConfig, type PaymentConfig } from './paymentConfigService';
import { PLAN_BASE_PRICES } from '@/constants/plans';

export interface OrderRecord {
  id: string;
  site_id?: string | null;
  template_id?: string | null;
  desired_slug: string;
  buyer_name: string;
  buyer_email: string;
  buyer_whatsapp: string;
  plan: string;
  amount: number;
  payment_method: string;
  payment_proof_url?: string | null;
  cancel_reason?: string | null;
  status: 'pending_payment' | 'waiting_verification' | 'activating' | 'activated' | 'failed' | 'expired' | 'canceled';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  buyerName: string;
  buyerEmail: string;
  buyerWhatsapp: string;
  plan: 'lite' | 'pro';
  desiredSlug: string;
  templateId?: string;
  amount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateOrderId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // 3 bytes (6 hex chars) = 16.777.216 kombinasi/hari. Dengan ~1000 order/hari
  // peluang tabrakan birthday paradox ≈ 0.03%. Ditambah retry di createOrder.
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${dateStr}-${randomSuffix}`;
}

function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const ACTIVE_PAYMENT_STATUSES = ['pending_payment', 'waiting_verification', 'activating'] as const;
const DEFAULT_UNIQUE_AMOUNT_MAX_OFFSET = 999;

// ---------------------------------------------------------------------------
// Expiry Window & Sweeper
// ---------------------------------------------------------------------------
const SWEEP_GUARD_KEY = 'billing_expire_sweep_at';
const SWEEP_GUARD_INTERVAL_MS = 10 * 60 * 1000;

async function expireStalePendingOrders(nowIso: string): Promise<void> {
  // Recovery lock activation yang macet: jika aktivasi berlangsung > 10 menit,
  // besar kemungkinan Worker crash saat memproses. Kembalikan ke waiting_verification
  // agar admin bisa klik ulang tombol Aktivasi (idempoten, tanpa row nyangkut).
  await queryD1(
    `UPDATE orders
     SET status = 'waiting_verification', updated_at = ?
     WHERE status = 'activating'
       AND datetime(updated_at) <= datetime(?, '-10 minutes')`,
    [nowIso, nowIso]
  );

  // Stale waiting_verification (bukti diunggah tapi tak pernah selesai diverifikasi /
  // bukti palsu dan admin lupa cancel): dibatalkan otomatis setelah 7 hari agar
  // reservasi slug & nominal unik tidak terkunci selamanya (index unik partial
  // hanya melindungi pending/waiting/activating, bukan canceled).
  await queryD1(
    `UPDATE orders
     SET status = 'canceled',
         cancel_reason = ?,
         payment_proof_url = NULL,
         updated_at = ?
     WHERE status = 'waiting_verification'
       AND datetime(updated_at) <= datetime(?, '-7 days')`,
    ['Dibatalkan otomatis: bukti pembayaran tidak selesai diverifikasi dalam 7 hari.', nowIso, nowIso]
  );

  const staleOrders = await queryD1<{
    id: string;
    buyer_name: string;
    buyer_email: string;
    desired_slug: string;
    plan: string;
  }>(
    `SELECT id, buyer_name, buyer_email, desired_slug, plan
     FROM orders
     WHERE status = 'pending_payment'
       AND datetime(expires_at) <= datetime(?)`,
    [nowIso]
  );

  const pendingStale = staleOrders || [];
  if (pendingStale.length === 0) return;

  await queryD1(
    `UPDATE orders
     SET status = 'expired', updated_at = ?
     WHERE status = 'pending_payment'
       AND datetime(expires_at) <= datetime(?)`,
    [nowIso, nowIso]
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const checkoutUrl = `${baseUrl}/checkout`;

  // FIX #39: Dedupe notifikasi expired berdasarkan email buyer agar tidak
  // spam jika buyer memiliki banyak order pending yang expired bersamaan.
  const notifiedEmails = new Set<string>();
  for (const order of pendingStale) {
    const email = order.buyer_email.toLowerCase();
    if (notifiedEmails.has(email)) continue;
    notifiedEmails.add(email);
    sendOrderExpiredEmail({
      to: order.buyer_email,
      orderId: order.id,
      buyerName: order.buyer_name,
      desiredSlug: order.desired_slug,
      plan: order.plan,
      checkoutUrl,
    }).catch((err) => console.error(`[expireStaleOrders] Email failed for ${order.id}:`, err));
  }
}

/**
 * Targeted per-order expiry — dipanggil dari read path halaman order pembeli
 * (murah: 1-2 UPDATE by id) supaya status order selalu akurat saat dibuka,
 * tanpa harus menunggu sweeper global.
 */
export async function expireOrderIfStale(orderId: string): Promise<void> {
  const nowIso = new Date().toISOString();

  const expiredRows = await queryD1<{
    id: string;
    buyer_name: string;
    buyer_email: string;
    desired_slug: string;
    plan: string;
  }>(
    `UPDATE orders
     SET status = 'expired', updated_at = ?
     WHERE id = ?
       AND status = 'pending_payment'
       AND datetime(expires_at) <= datetime(?)
     RETURNING id, buyer_name, buyer_email, desired_slug, plan`,
    [nowIso, orderId, nowIso]
  );

  if (expiredRows.length > 0) {
    const order = expiredRows[0];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkoutUrl = `${baseUrl}/checkout`;
    sendOrderExpiredEmail({
      to: order.buyer_email,
      orderId: order.id,
      buyerName: order.buyer_name,
      desiredSlug: order.desired_slug,
      plan: order.plan,
      checkoutUrl,
    }).catch((err) => console.error(`[expireOrderIfStale] Email failed for ${order.id}:`, err));
  }

  // Aktivasi yang nyangkut > 10 menit → kembali ke waiting_verification supaya
  // pembeli tidak menggantung di "Mengaktifkan..." selamanya.
  await queryD1(
    `UPDATE orders
     SET status = 'waiting_verification', updated_at = ?
     WHERE id = ?
       AND status = 'activating'
       AND datetime(updated_at) <= datetime(?, '-10 minutes')`,
    [nowIso, orderId, nowIso]
  );
}

/**
 * Global guarded sweeper — dipanggil dari read path admin (dan dapat
 * dijadwalkan via cron). Guard 10 menit menjaga kuota D1/Cloudflare tetap
 * hemat saat lalu lintas tinggi.
 */
export async function sweepExpiredOrders(): Promise<void> {
  const now = new Date();
  const nowTs = now.getTime();

  try {
    const guardRows = await queryD1<{ value: string }>(
      'SELECT value FROM platform_settings WHERE key = ?',
      [SWEEP_GUARD_KEY]
    );
    const lastSweep = Number(guardRows?.[0]?.value || 0);
    if (Number.isFinite(lastSweep) && lastSweep > 0 && nowTs - lastSweep < SWEEP_GUARD_INTERVAL_MS) {
      return;
    }
  } catch {
    // Guard gagal dibaca → tetap cluster (tidak memblokir maintenance).
  }

  try {
    await expireStalePendingOrders(now.toISOString());
    await queryD1(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [SWEEP_GUARD_KEY, String(nowTs), now.toISOString()]
    );
  } catch (err) {
    console.error('[sweepExpiredOrders] Failed:', err);
  }
}

function getBasePlanAmount(plan: 'lite' | 'pro') {
  return PLAN_BASE_PRICES[plan];
}

function isUniqueConstraintError(error: unknown, field: 'desired_slug' | 'amount' | 'id') {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('UNIQUE constraint failed') && message.includes(field);
}

function escapeTelegramHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizePaymentProofUrl(proofUrl: string): string | null {
  const trimmed = proofUrl.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function resolveOrderAmount(
  baseAmount: number,
  config: PaymentConfig,
  forceUniqueAmount = false
): Promise<number> {
  if (!config.qrisUniqueAmountEnabled && !forceUniqueAmount) {
    return baseAmount;
  }

  const maxOffset = config.qrisUniqueAmountMaxOffset || DEFAULT_UNIQUE_AMOUNT_MAX_OFFSET;

  const usedRows = await queryD1<{ amount: number }>(
    `SELECT amount FROM orders
     WHERE status IN (?, ?, ?)
       AND amount > ?
       AND amount <= ?`,
    [
      ACTIVE_PAYMENT_STATUSES[0],
      ACTIVE_PAYMENT_STATUSES[1],
      ACTIVE_PAYMENT_STATUSES[2],
      baseAmount,
      baseAmount + maxOffset,
    ]
  );

  const usedOffsets = new Set(
    (usedRows || [])
      .map((row) => Number(row.amount) - baseAmount)
      .filter((offset) => Number.isInteger(offset) && offset >= 1 && offset <= maxOffset)
  );

  if (usedOffsets.size >= maxOffset) {
    throw new Error('Kode unik nominal untuk hari ini sudah habis. Silakan naikkan batas kode unik.');
  }

  // Probe mulai dari offset acak (wrap-around scan). Strategi "ambil yang
  // terkecil bebas" terbukti menyebabkan thundering herd: 100+ checkout
  // serentak semuanya memilih nominal yang sama, lalu gagal beruntun
  // ("Nominal unik sedang penuh") padahal kolam 999 slot masih kosong.
  const start = 1 + Math.floor(Math.random() * maxOffset);
  for (let step = 0; step < maxOffset; step += 1) {
    const offset = ((start - 1 + step) % maxOffset) + 1;
    if (!usedOffsets.has(offset)) {
      return baseAmount + offset;
    }
  }

  throw new Error('Kode unik nominal untuk hari ini sudah habis. Silakan naikkan batas kode unik.');
}

async function sendTelegramMessage(
  env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_ADMIN_CHAT_ID?: string },
  text: string,
  replyMarkup?: Record<string, unknown>
): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return false;
  }
}

async function sendOrderEmail({
  to,
  orderId,
  buyerName,
  plan,
  amount,
  orderUrl,
}: {
  to: string;
  orderId: string;
  buyerName: string;
  plan: string;
  amount: number;
  orderUrl: string;
}): Promise<boolean> {
  const provider = (cleanEnvVar('NOTIFICATION_PROVIDER') || '').toLowerCase();
  if (provider !== 'resend') return false;

  const apiKey = cleanEnvVar('NOTIFICATION_API_KEY');
  const from = cleanEnvVar('NOTIFICATION_DEFAULT_FROM');
  if (!apiKey || !from) return false;

  const formattedAmount = `Rp ${amount.toLocaleString('id-ID')}`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Struk Pesanan ${orderId} — Portfolio OS ${plan.toUpperCase()}`,
        text: [
          `Halo ${buyerName},`,
          '',
          `Pesanan Anda telah dibuat:`,
          `• Order ID: ${orderId}`,
          `• Paket: ${plan.toUpperCase()}`,
          `• Total Bayar: ${formattedAmount}`,
          '',
          'Silakan selesaikan pembayaran melalui QRIS atau Transfer Bank sesuai nominal di atas.',
          '',
          'Simpan link ini untuk cek status pesanan Anda kapan saja:',
          orderUrl,
          '',
          'Setelah membayar, upload bukti pembayaran di halaman tersebut.',
          '',
          '— Portfolio OS',
        ].join('\n'),
        html: [
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">`,
          `<h2 style="margin:0 0 4px">Struk Pesanan</h2>`,
          `<p style="color:#64748b;font-size:13px;margin:0 0 20px">Portfolio OS • ${plan.toUpperCase()} Plan</p>`,
          `<table style="width:100%;font-size:13px;border-collapse:collapse">`,
          `<tr><td style="padding:6px 0;color:#64748b">Order ID</td><td style="padding:6px 0;text-align:right;font-weight:700;font-family:monospace">${orderId}</td></tr>`,
          `<tr><td style="padding:6px 0;color:#64748b">Nama</td><td style="padding:6px 0;text-align:right;font-weight:600">${buyerName}</td></tr>`,
          `<tr><td style="padding:6px 0;color:#64748b">Total Bayar</td><td style="padding:6px 0;text-align:right;font-weight:800;font-size:16px;color:#1e40af">${formattedAmount}</td></tr>`,
          `</table>`,
          `<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">`,
          `<p style="font-size:13px;margin:0 0 12px">Selesaikan pembayaran melalui <strong>QRIS</strong> atau <strong>Transfer Bank</strong> sesuai nominal di atas.</p>`,
          `<a href="${orderUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Lihat Pesanan & Bayar</a>`,
          `<p style="font-size:11px;color:#94a3b8;margin:16px 0 0">Simpan email ini. Link di atas adalah akses Anda ke halaman pesanan untuk upload bukti bayar dan cek status kapan saja.</p>`,
          `</div>`,
        ].join(''),
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[sendOrderEmail] Failed:', err);
    return false;
  }
}

async function sendOrderExpiredEmail({
  to,
  orderId,
  buyerName,
  desiredSlug,
  plan,
  checkoutUrl,
}: {
  to: string;
  orderId: string;
  buyerName: string;
  desiredSlug: string;
  plan: string;
  checkoutUrl: string;
}): Promise<boolean> {
  const provider = (cleanEnvVar('NOTIFICATION_PROVIDER') || '').toLowerCase();
  if (provider !== 'resend') return false;

  const apiKey = cleanEnvVar('NOTIFICATION_API_KEY');
  const from = cleanEnvVar('NOTIFICATION_DEFAULT_FROM');
  if (!apiKey || !from) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `⏳ Pesanan ${orderId} Telah Kedaluwarsa — Portfolio OS`,
        text: [
          `Halo ${buyerName},`,
          '',
          `Batas waktu pembayaran 24 jam untuk pesanan ${orderId} (${plan.toUpperCase()} Plan) telah berakhir.`,
          `Nominal unik dan reservasi slug '${desiredSlug}' telah dilepas oleh sistem.`,
          '',
          'Jika Anda masih berminat untuk membuat website portofolio, silakan buat pesanan baru:',
          checkoutUrl,
          '',
          '— Portfolio OS',
        ].join('\n'),
        html: [
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">`,
          `<h2 style="margin:0 0 4px;color:#d97706">Pesanan Kedaluwarsa</h2>`,
          `<p style="color:#64748b;font-size:13px;margin:0 0 20px">Portfolio OS • ${plan.toUpperCase()} Plan</p>`,
          `<p style="font-size:13px;color:#334155">Halo <strong>${buyerName}</strong>,</p>`,
          `<p style="font-size:13px;color:#334155">Batas waktu pembayaran 24 jam untuk pesanan <code style="font-family:monospace;font-weight:bold">${orderId}</code> telah berakhir.</p>`,
          `<div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px;margin:16px 0;font-size:12px;color:#92400e">`,
          `Nominal unik dan reservasi slug <strong>${desiredSlug}</strong> telah dilepas oleh sistem.`,
          `</div>`,
          `<p style="font-size:13px;margin:0 0 16px">Jika Anda masih berminat membuat website portofolio, silakan buat pesanan baru di bawah ini:</p>`,
          `<a href="${checkoutUrl}" style="display:inline-block;background:#d97706;color:#fff;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Buat Pesanan Baru</a>`,
          `</div>`,
        ].join(''),
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[sendOrderExpiredEmail] Failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Access Token Verification
// ---------------------------------------------------------------------------

/**
 * Verifies a plaintext access token against the stored hash for an order.
 * Returns true if the token matches, false otherwise.
 */
export async function verifyOrderAccessToken(orderId: string, token: string): Promise<boolean> {
  if (!orderId || !token) return false;
  const rows = await queryD1<{ access_token_hash: string | null }>(
    'SELECT access_token_hash FROM orders WHERE id = ?',
    [orderId]
  );
  const row = rows[0];
  if (!row?.access_token_hash) return false;
  const inputHash = hashAccessToken(token);
  if (inputHash.length !== row.access_token_hash.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(inputHash, 'hex'),
    Buffer.from(row.access_token_hash, 'hex')
  );
}

// ---------------------------------------------------------------------------
// Create Order
// ---------------------------------------------------------------------------

export async function createOrder(
  input: CreateOrderInput,
  env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_ADMIN_CHAT_ID?: string; APP_BASE_URL?: string } = {}
): Promise<{ success: boolean; order?: OrderRecord; accessToken?: string; error?: string }> {
  const slugLower = input.desiredSlug.trim().toLowerCase();
  const now = new Date();
  const createdAt = now.toISOString();
  const updatedAt = createdAt;

  await expireStalePendingOrders(createdAt);

  // Validate Slug Availability — allow renewal/upgrade when the slug belongs
  // to an existing active site of the same buyer email (order is created by the
  // site owner themselves; activation then follows the upgrade path).
  const buyerEmailLower = input.buyerEmail.trim().toLowerCase();
  const available = await isSlugAvailable(slugLower);
  if (!available) {
    return { success: false, error: 'Slug tidak tersedia atau sudah digunakan. Silakan pilih slug lain.' };
  }

  let orderId = '';
  let accessToken = '';
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const paymentConfig = await getPaymentConfig();
  if (!paymentConfig.isActive) {
    return { success: false, error: 'Pembayaran sedang tidak aktif. Silakan coba lagi nanti.' };
  }

  // M5: dedupe — buyer tidak boleh menumpuk banyak order aktif untuk slug yang
  // sama (mengunci reservasi slug & nominal, dan membanjiri notif Telegram).
  const duplicateRows = await queryD1<{ id: string }>(
    `SELECT id FROM orders
     WHERE LOWER(buyer_email) = ?
       AND LOWER(desired_slug) = ?
       AND status IN (?, ?, ?)
     LIMIT 1`,
    [buyerEmailLower, slugLower, ...ACTIVE_PAYMENT_STATUSES]
  );
  if (duplicateRows.length > 0) {
    return {
      success: false,
      error: `Anda sudah memiliki pesanan aktif dengan slug ini (${duplicateRows[0].id}). Gunakan tautan dari email Anda, atau hubungi admin bila ingin mengganti paket.`,
    };
  }

  const baseAmount = input.amount ?? getBasePlanAmount(input.plan);
  let amount = baseAmount;
  let forceUniqueAmount = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Regenerate id/token per attempt: jika UNIQUE constraint orders.id tabrakan
    // (sangat jarang), coba lagi dengan id baru sampai 3x sebelum menyerah.
    const attemptOrderId = generateOrderId();
    const attemptAccessToken = generateAccessToken();

    try {
      amount = Math.floor(await resolveOrderAmount(baseAmount, paymentConfig, forceUniqueAmount));
    } catch (err) {
      if (err instanceof Error && err.message.includes('Kode unik nominal')) {
        return { success: false, error: 'Nominal unik sedang penuh. Silakan coba lagi.' };
      }
      throw err;
    }

    try {
      await queryD1(
        `INSERT INTO orders (
          id, desired_slug, buyer_name, buyer_email, buyer_whatsapp,
          plan, amount, payment_method, access_token_hash, status, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual_qris', ?, 'pending_payment', ?, ?, ?)`,
        [
          attemptOrderId,
          slugLower,
          input.buyerName.trim(),
          input.buyerEmail.trim().toLowerCase(),
          input.buyerWhatsapp.trim(),
          input.plan,
          amount,
          hashAccessToken(attemptAccessToken),
          expiresAt,
          createdAt,
          updatedAt
        ]
      );
      orderId = attemptOrderId;
      accessToken = attemptAccessToken;
      break;
    } catch (err) {
      if (isUniqueConstraintError(err, 'desired_slug')) {
        return { success: false, error: 'Slug tidak tersedia atau sudah digunakan. Silakan pilih slug lain.' };
      }
      if (isUniqueConstraintError(err, 'amount') && attempt < 2) {
        forceUniqueAmount = true;
        continue;
      }
      if (isUniqueConstraintError(err, 'amount')) {
        return { success: false, error: 'Nominal unik sedang penuh. Silakan coba lagi.' };
      }
      if (isUniqueConstraintError(err, 'id') && attempt < 2) {
        continue;
      }
      throw err;
    }
  }

  const newOrder: OrderRecord = {
    id: orderId,
    template_id: null,
    desired_slug: slugLower,
    buyer_name: input.buyerName.trim(),
    buyer_email: input.buyerEmail.trim().toLowerCase(),
    buyer_whatsapp: input.buyerWhatsapp.trim(),
    plan: input.plan,
    amount,
    payment_method: 'manual_qris',
    status: 'pending_payment',
    expires_at: expiresAt,
    created_at: createdAt,
    updated_at: updatedAt
  };

  // Notify Telegram Admin (Information only)
  const tgMsg = `🛒 <b>ORDER BARU (BELUM DIBAYAR)</b>\n\n` +
    `ID: <code>${escapeTelegramHtml(orderId)}</code>\n` +
    `Paket: <b>${escapeTelegramHtml(input.plan.toUpperCase())}</b>\n` +
    `Slug: <code>${escapeTelegramHtml(slugLower)}</code>\n` +
    `Buyer: ${escapeTelegramHtml(input.buyerName)}\n` +
    `WA: ${escapeTelegramHtml(input.buyerWhatsapp)}\n` +
    `Email: ${escapeTelegramHtml(input.buyerEmail)}\n` +
    `Nominal: <b>Rp ${amount.toLocaleString('id-ID')}</b>\n` +
    `Status: <i>pending_payment</i> (Expired in 24h)`;

  await sendTelegramMessage(env, tgMsg);

  // Send order confirmation email to buyer with direct link to order page
  const baseUrl = env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://makeitbetter.my.id';
  const orderUrl = `${baseUrl}/orders/${orderId}?token=${accessToken}`;
  await sendOrderEmail({
    to: input.buyerEmail.trim().toLowerCase(),
    orderId,
    buyerName: input.buyerName.trim(),
    plan: input.plan,
    amount,
    orderUrl,
  });

  return { success: true, order: newOrder, accessToken };
}

// ---------------------------------------------------------------------------
// Upload Payment Proof
// ---------------------------------------------------------------------------

// Upload Payment Proof
// ---------------------------------------------------------------------------

/** Statuses that are allowed to upload payment proof */
const PROOF_ALLOWED_STATUSES = new Set(['pending_payment', 'waiting_verification', 'expired']);

export async function uploadPaymentProof(
  orderId: string,
  proofUrl: string,
  env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_ADMIN_CHAT_ID?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const normalizedProofUrl = normalizePaymentProofUrl(proofUrl);
  if (!normalizedProofUrl) {
    return { success: false, error: 'URL bukti pembayaran harus berupa link http/https yang valid.' };
  }

  const rows = await queryD1<OrderRecord>('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = rows[0];

  if (!order) {
    return { success: false, error: 'Pesanan tidak ditemukan' };
  }

  if (!PROOF_ALLOWED_STATUSES.has(order.status)) {
    return { success: false, error: `Pesanan dengan status "${order.status}" tidak dapat mengunggah bukti bayar` };
  }

  const updatedAt = new Date().toISOString();
  const isLatePayment = order.status === 'expired';
  const wasWaitingVerification = order.status === 'waiting_verification';
  // H4: hanya kirim notifikasi Telegram bila bukti benar-benar BERUBAH.
  // Re-submit bukti yang sama (mis. double-click / refresh) tidak boleh spam.
  const previousProofUrl = typeof order.payment_proof_url === 'string' ? order.payment_proof_url.trim() : '';
  const isSameProof = wasWaitingVerification && previousProofUrl === normalizedProofUrl;
  // L2: order late-payment diberi jendela verifikasi baru 24 jam (konsistensi data).
  const lateExpiresAt = new Date(new Date(updatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();

  if (isLatePayment) {
    const amountConflicts = await queryD1<{ id: string }>(
      `SELECT id FROM orders
       WHERE id != ?
         AND amount = ?
         AND status IN (?, ?, ?)
       LIMIT 1`,
      [
        orderId,
        order.amount,
        ACTIVE_PAYMENT_STATUSES[0],
        ACTIVE_PAYMENT_STATUSES[1],
        ACTIVE_PAYMENT_STATUSES[2],
      ]
    );

    if (amountConflicts.length > 0) {
      return {
        success: false,
        error: 'Order sudah kedaluwarsa dan nominalnya sudah dipakai order lain. Hubungi admin untuk verifikasi manual.',
      };
    }

    // Late payment: slug may have been released and taken by another order/site.
    // Reject early instead of letting activation fail after the buyer has paid.
    const slugAvailable = await isSlugAvailable(order.desired_slug);
    if (!slugAvailable) {
      return {
        success: false,
        error: 'Order sudah kedaluwarsa dan slug-nya sudah dipakai order/site lain. Hubungi admin untuk verifikasi manual.',
      };
    }
  }

  try {
    await queryD1(
      `UPDATE orders
       SET payment_proof_url = ?,
           status = 'waiting_verification',
           expires_at = CASE WHEN ? THEN ? ELSE expires_at END,
           updated_at = ?
       WHERE id = ?`,
      [normalizedProofUrl, isLatePayment ? 1 : 0, lateExpiresAt, updatedAt, orderId]
    );
  } catch (err) {
    if (isUniqueConstraintError(err, 'amount')) {
      return {
        success: false,
        error: 'Nominal pembayaran bentrok dengan order aktif lain. Hubungi admin untuk verifikasi manual.',
      };
    }
    if (isUniqueConstraintError(err, 'desired_slug')) {
      return {
        success: false,
        error: 'Slug pesanan ini sudah dipakai order/site lain. Hubungi admin untuk verifikasi manual.',
      };
    }
    throw err;
  }

  if (!isSameProof) {
    // Notify Telegram Admin with Activation Button & Manual Verification Notice.
    // Header dibedakan: bukti baru, bukti update, atau late/expired.
    const headerTitle = wasWaitingVerification
      ? '🔄 <b>BUKTI BAYAR DIUPDATE (pengganti bukti lama)</b>'
      : isLatePayment
      ? '💳 <b>BUKTI BAYAR DIUNGGAH (LATE / EXPIRED)</b>'
      : '💳 <b>BUKTI BAYAR DIUNGGAH</b>';
    const proofDomain = (() => {
      try {
        return new URL(normalizedProofUrl).hostname;
      } catch {
        return '?';
      }
    })();
    const tgMsg = `${headerTitle}\n\n` +
      `ID: <code>${escapeTelegramHtml(order.id)}</code>\n` +
      `Paket: <b>${escapeTelegramHtml(order.plan.toUpperCase())}</b>\n` +
      `Slug: <code>${escapeTelegramHtml(order.desired_slug)}</code>\n` +
      `Buyer: ${escapeTelegramHtml(order.buyer_name)}\n` +
      `WA: ${escapeTelegramHtml(order.buyer_whatsapp)}\n` +
      `Nominal dicek: <b>Rp ${Number(order.amount || 0).toLocaleString('id-ID')}</b>\n` +
      `Bukti Bayar: <a href="${escapeTelegramHtml(normalizedProofUrl)}">Lihat Gambar</a> (domain: <code>${escapeTelegramHtml(proofDomain)}</code>)\n\n` +
      `⚠️ <b>PENTING:</b> Mohon cek & pastikan mutasi saldo m-Banking / QRIS Anda secara manual SEBELUM menekan tombol di bawah.\n` +
      `🔒 Link bukti berasal dari pembeli — verifikasi keaslian alamat & gambar sebelum mengklik (hindari tautan mencurigakan).`;

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '✅ Verifikasi & Aktifkan',
            callback_data: `activate_${order.id}`
          },
          {
            text: '❌ Batalkan / Refund',
            callback_data: `cancel_${order.id}`
          }
        ]
      ]
    };

    await sendTelegramMessage(env, tgMsg, replyMarkup);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Activate Order
// ---------------------------------------------------------------------------

export async function activateOrder(
  orderId: string,
  env: { APP_BASE_URL?: string } = {},
  options: { allowExpired?: boolean; proofUrl?: string } = {}
): Promise<{ success: boolean; message: string; siteId?: string }> {
  const { allowExpired = false, proofUrl } = options;
  const now = new Date().toISOString();

  if (allowExpired) {
    // Jalur "Aktivasi Late" (admin sudah cek mutasi manual di m-Banking/QRIS):
    // order expired dipindah ke antrean verifikasi; bukti URL opsional
    // (admin bisa tempel link screenshot dari WhatsApp pembeli).
    const normalizedProof = proofUrl ? normalizePaymentProofUrl(proofUrl) : null;
    await queryD1(
      `UPDATE orders
       SET status = 'waiting_verification',
           payment_proof_url = CASE WHEN ? IS NOT NULL THEN ? ELSE payment_proof_url END,
           updated_at = ?
       WHERE id = ? AND status = 'expired'`,
      [normalizedProof, normalizedProof, now, orderId]
    );
  }

  const lockedOrders = await queryD1<OrderRecord>(
    `UPDATE orders
     SET status = 'activating', updated_at = ?
     WHERE id = ?
       AND status = 'waiting_verification'
       AND ( ? = 1 OR (payment_proof_url IS NOT NULL AND TRIM(payment_proof_url) != '') )
     RETURNING *`,
    [now, orderId, allowExpired ? 1 : 0]
  );

  if (lockedOrders.length === 0) {
    const existingRows = await queryD1<{ status: string; payment_proof_url?: string | null }>(
      'SELECT status, payment_proof_url FROM orders WHERE id = ?',
      [orderId]
    );
    const existing = existingRows[0];

    if (existing?.status === 'activated') {
      return { success: true, message: 'Order ini sudah diaktifkan sebelumnya.' };
    }
    if (existing?.status === 'activating') {
      return { success: false, message: 'Order sedang dalam proses aktivasi lain.' };
    }
    if (existing?.status === 'pending_payment' || existing?.status === 'expired') {
      return {
        success: false,
        message: 'Order belum memiliki bukti bayar. Upload bukti pembayaran dulu sebelum aktivasi.',
      };
    }
    if (existing?.status === 'waiting_verification') {
      return {
        success: false,
        message: 'Bukti pembayaran belum tersedia. Upload bukti pembayaran dulu sebelum aktivasi.',
      };
    }
    return { success: false, message: `Gagal mengunci order (Status saat ini: ${existing?.status || 'tidak ditemukan'}).` };
  }

  const order = lockedOrders[0];
  let siteId: string;
  const actualSlug = order.desired_slug;

  // Wrap provisioning in try/catch with compensating cleanup (no orphan rows)
  type CreatedRow =
    | { kind: 'site'; id: string }
    | { kind: 'site_subscription'; id: string };

  const createdRows: CreatedRow[] = [];

  try {
    // New Site Provisioning Flow
    siteId = `site_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await queryD1(
      `INSERT INTO sites (id, slug, name, plan, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      [siteId, order.desired_slug, `${order.buyer_name}'s Portfolio`, order.plan, now, now]
    );
    createdRows.push({ kind: 'site', id: siteId });

    await queryD1(
      `INSERT INTO site_subscriptions (id, site_id, plan, status, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?)`,
      [`sub_${siteId}`, siteId, order.plan, now, now]
    );
    createdRows.push({ kind: 'site_subscription', id: `sub_${siteId}` });

    // Update Order status to activated
    await queryD1('UPDATE orders SET status = "activated", site_id = ?, updated_at = ? WHERE id = ?', [
      siteId,
      now,
      orderId
    ]);

    // Log Audit Event
    await queryD1(
      `INSERT INTO audit_logs (id, site_id, action, entity_type, created_at)
       VALUES (?, ?, ?, 'order', ?)`,
      [`audit_${crypto.randomUUID()}`, siteId, 'ORDER_ACTIVATED', now]
    );
  } catch (err) {
    // Rollback — undo partially created rows, then mark order as failed
    console.error(`[activateOrder] Provisioning failed for order ${orderId}, rolling back:`, err);

    for (const row of createdRows) {
      try {
        if (row.kind === 'site') {
          await queryD1('DELETE FROM sites WHERE id = ?', [row.id]);
        } else if (row.kind === 'site_subscription') {
          await queryD1('DELETE FROM site_subscriptions WHERE id = ?', [row.id]);
        }
      } catch (cleanupErr) {
        console.error(`[activateOrder] Cleanup failed for ${row.kind} ${JSON.stringify(row)}:`, cleanupErr);
      }
    }

    try {
      await queryD1(
        `UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'activating'`,
        [new Date().toISOString(), orderId]
      );
    } catch (rollbackErr) {
      console.error(`[activateOrder] Rollback also failed for order ${orderId}:`, rollbackErr);
    }

    const isSlugCollision = err instanceof Error && (err.message.includes('sites.slug') || err.message.includes('UNIQUE constraint failed: sites.slug'));
    const errorMessage = isSlugCollision
      ? `Aktivasi gagal: Slug "${order.desired_slug}" sudah digunakan oleh website aktif lain. Silakan ubah slug order atau buat order baru.`
      : `Aktivasi gagal: ${err instanceof Error ? err.message : 'Unknown error'}`;

    return { success: false, message: errorMessage };
  }

  const baseUrl = env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://makeitbetter.my.id';
  const siteUrl = `${baseUrl}/${actualSlug}`;

  const message = `Berhasil mengaktifkan pesanan ${order.id}. Site URL: ${siteUrl}`;

  return { success: true, message, siteId };
}

// ---------------------------------------------------------------------------
// Cancel / Refund Order
// ---------------------------------------------------------------------------

export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<{ success: boolean; message: string; order?: OrderRecord }> {
  const now = new Date().toISOString();

  const orders = await queryD1<OrderRecord>('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = orders[0];

  if (!order) {
    return { success: false, message: `Pesanan ${orderId} tidak ditemukan` };
  }

  if (order.status === 'canceled') {
    return {
      success: true,
      message: `Pesanan ${orderId} sudah dibatalkan sebelumnya.`,
      order,
    };
  }

  if (order.status === 'activated') {
    return {
      success: false,
      message: 'Order sudah aktif. Refund/penonaktifan site harus diproses lewat flow suspend atau downgrade terpisah.',
      order,
    };
  }

  if (order.status === 'activating') {
    return {
      success: false,
      message: 'Order sedang dalam proses aktivasi. Tunggu proses selesai sebelum mengambil tindakan lain.',
      order,
    };
  }

  const cancelReason = reason?.trim() || 'Dibatalkan oleh Admin (Bukti bayar tidak valid / mutasi tidak ditemukan)';

  // Cleanup: clear sensitive payment proof URL.
  // Keep `amount` intact for late-payment reconciliation and keep `access_token_hash`
  // so the buyer can still view their order status page via their secret token link.
  try {
    await queryD1(
      `UPDATE orders
       SET status = 'canceled',
           cancel_reason = ?,
           payment_proof_url = NULL,
           updated_at = ?
       WHERE id = ?`,
      [cancelReason, now, orderId]
    );
  } catch {
    // Fallback: at minimum set status to canceled
    await queryD1(
      `UPDATE orders
       SET status = 'canceled',
           payment_proof_url = NULL,
           updated_at = ?
       WHERE id = ?`,
      [now, orderId]
    );
  }

  const updatedOrder: OrderRecord = {
    ...order,
    status: 'canceled' as const,
    cancel_reason: cancelReason,
    payment_proof_url: null,
  };

  return {
    success: true,
    message: `Pesanan ${orderId} telah dibatalkan dan data sensitif dibersihkan.`,
    order: updatedOrder,
  };
}

export async function getAdminOrders(
  filters?: {
    search?: string;
    status?: string;
  },
  pagination?: { page?: number; limit?: number }
): Promise<{ orders: OrderRecord[]; page: number; limit: number; hasMore: boolean; total: number }> {
  const page = Math.max(1, pagination?.page || 1);
  const limit = Math.min(100, Math.max(1, pagination?.limit || 50));
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM orders';
  const countSql = 'SELECT COUNT(*) AS total FROM orders';
  const params: (string | number | boolean | null)[] = [];
  const conditions: string[] = [];

  if (filters?.status && filters.status !== 'all') {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (filters?.search && filters.search.trim()) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(
      '(LOWER(id) LIKE ? OR LOWER(buyer_name) LIKE ? OR LOWER(buyer_email) LIKE ? OR LOWER(buyer_whatsapp) LIKE ? OR LOWER(desired_slug) LIKE ?)'
    );
    params.push(q, q, q, q, q);
  }

  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const countRows = await queryD1<{ total: number }>(countSql + where, params);
  const total = Number(countRows?.[0]?.total || 0);

  sql += where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const orders = await queryD1<OrderRecord>(sql, [...params, limit, offset]);

  return {
    orders,
    page,
    limit,
    hasMore: offset + orders.length < total,
    total,
  };
}

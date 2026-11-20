/**
 * Backfill `order_items` + kolom rincian order lama (v1.3.93).
 *
 * Order yang dibuat SEBELUM fitur checkout multi-template hanya punya
 * `orders.template_id` dan `orders.amount`. Script ini membuat satu baris
 * `order_items` per order tersebut supaya halaman pembeli & panel owner
 * menampilkan rincian yang utuh (bukan fallback "Portfolio OS").
 *
 * Sifat:
 * - Idempoten: order yang sudah punya item dilewati.
 * - Tidak mengubah `orders.amount` (uang yang benar-benar ditagih).
 * - `subtotal` lama diisi dari `amount` dan `discount_total` = 0 karena order
 *   lama memang tidak punya diskon; kode unik QRIS ikut terhitung di amount.
 * - Dry-run default — tidak menulis tanpa `--apply`.
 *
 * Pemakaian:
 *   npx tsx scripts/cloudflare/backfill-order-items.ts
 *   npx tsx scripts/cloudflare/backfill-order-items.ts --apply
 *   npx tsx scripts/cloudflare/backfill-order-items.ts --apply --limit 50
 *
 * Env dibaca dari .env.local (D1 OWNER). Tidak ada kredensial yang dicetak.
 */

import { loadProductEnv } from './product-env';
import { getTemplate } from '../../src/lib/templates/registry';

type D1Param = string | number | null;

interface OwnerContext {
  accountId: string;
  apiToken: string;
  databaseId: string;
}

interface OrderRow {
  id: string;
  template_id: string | null;
  amount: number;
  subtotal: number | null;
  discount_total: number | null;
  created_at: string;
}

async function runD1<T>(
  ctx: OwnerContext,
  sql: string,
  params: D1Param[] = []
): Promise<T[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ctx.accountId}/d1/database/${ctx.databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const payload = (await res.json().catch(() => null)) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: Array<{ success?: boolean; error?: string; results?: T[] }>;
  } | null;

  if (!res.ok || !payload?.success) {
    const detail = payload?.errors?.map((error) => error.message).filter(Boolean).join('; ');
    throw new Error(`D1 HTTP ${res.status}: ${detail || 'query gagal'}`);
  }

  const first = payload.result?.[0];
  if (first && first.success === false) {
    throw new Error(first.error || 'statement D1 gagal');
  }
  return first?.results ?? [];
}

function readOwnerContext(): OwnerContext | null {
  loadProductEnv();
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = (
    process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''
  ).trim();
  const databaseId = (process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim();
  if (!accountId || !apiToken || !databaseId) return null;
  return { accountId, apiToken, databaseId };
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readLimit(): number {
  const index = process.argv.indexOf('--limit');
  if (index === -1) return 0;
  const value = Number(process.argv[index + 1]);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

async function main() {
  const apply = hasFlag('--apply');
  const limit = readLimit();
  const ctx = readOwnerContext();

  if (!ctx) {
    console.error(
      'Env D1 owner tidak lengkap. Isi CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_API_TOKEN, dan CLOUDFLARE_D1_DATABASE_ID di .env.local.'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Mode: ${apply ? 'APPLY (menulis)' : 'DRY-RUN (tidak menulis)'}`);

  const orders = await runD1<OrderRow>(
    ctx,
    `SELECT id, template_id, amount, subtotal, discount_total, created_at
       FROM orders o
      WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id)
      ORDER BY o.created_at ASC`
  );

  const targets = limit > 0 ? orders.slice(0, limit) : orders;
  console.log(`Order tanpa rincian item: ${orders.length}${limit > 0 ? ` (diproses ${targets.length})` : ''}`);

  if (targets.length === 0) {
    console.log('Tidak ada yang perlu di-backfill.');
    return;
  }

  let written = 0;
  for (const order of targets) {
    const templateId = (order.template_id || 'os-desktop').trim();
    if (!getTemplate(templateId)) {
      console.warn(`↷ ${order.id}: template "${templateId}" tidak dikenal registry — dilewati.`);
      continue;
    }

    const amount = Math.max(0, Math.floor(Number(order.amount) || 0));
    const subtotal =
      order.subtotal !== null && Number(order.subtotal) > 0 ? Number(order.subtotal) : amount;
    const discountTotal =
      order.discount_total !== null ? Number(order.discount_total) : 0;
    const finalPrice = Math.max(0, subtotal - discountTotal);
    const templateName = getTemplate(templateId)?.name || templateId;

    console.log(
      `• ${order.id} → ${templateName} (${finalPrice.toLocaleString('id-ID')})`
    );

    if (!apply) continue;

    await runD1(
      ctx,
      `INSERT INTO order_items
         (id, order_id, template_id, template_name, list_price, discount_amount, final_price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `itm-${order.id}-${templateId}`,
        order.id,
        templateId,
        templateName,
        subtotal,
        discountTotal,
        finalPrice,
        order.created_at || new Date().toISOString(),
      ]
    );

    // Lengkapi kolom rincian order lama (hanya bila masih kosong).
    if (subtotal !== Number(order.subtotal) || Number(order.subtotal) === 0) {
      await runD1(
        ctx,
        `UPDATE orders
            SET subtotal = ?, discount_total = ?
          WHERE id = ? AND (subtotal IS NULL OR subtotal = 0)`,
        [subtotal, discountTotal, order.id]
      );
    }

    written += 1;
  }

  console.log(
    apply
      ? `Selesai. ${written} order di-backfill.`
      : 'Dry-run selesai. Jalankan dengan --apply untuk menulis.'
  );
}

main().catch((err) => {
  console.error('Backfill gagal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

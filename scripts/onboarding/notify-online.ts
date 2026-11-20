/**
 * Email "🎉 Website Sudah Online" — dikirim portal onboarding / CLI
 * SETELAH `deployClient()` sukses (PK2, rencana v1.3.27).
 *
 * Pemisahan jujur (keputusan owner 2026-10-07):
 *  - `orderService.sendActivationEmail` → "✅ Pembayaran Terverifikasi —
 *    Website Sedang Disiapkan" (janji 1×24 jam, TANPA link) saat pembayaran masuk.
 *  - Modul ini → "🎉 Website Anda Sudah Online: <url>" dengan URL benar
 *    (`websiteUrl` dari deployClient; bentuknya
 *    `https://<slug>.<subdomain-akun-klien>.workers.dev`), hanya setelah deploy
 *    benar-benar sukses. URL yang sama dicatat ke `orders.site_url` +
 *    `orders.provisioned_at` supaya admin punya bukti serah terima.
 *
 * Pencarian pembeli: order di D1 OWNER dengan `desired_slug = slug` (order
 * `activated` diprioritaskan). Tanpa order (deploy demo/manual) → email
 * DILEWATI dengan alasan jelas, bukan error. Pencatatan serah terima tetap
 * dijalankan walau email tidak dikonfigurasi.
 *
 * Sengaja TIDAK dipanggil pada mode update batch `cloud-manager.ts`
 * (deploy ulang site yang sudah online = bukan momen "sudah online" pertama).
 */
import { loadProductEnv } from '../cloudflare/product-env';
import { getCurrentD1DatabaseId, queryD1ForDatabase } from '../cloudflare/backup-common';

export interface OnlineEmailResult {
  sent: boolean;
  /** Alasan singkat untuk ditampilkan di log/portal. */
  reason: string;
}

interface OrderRow {
  id: string;
  buyer_email: string | null;
  buyer_name: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Cari order milik slug di D1 owner. Order `activated` didahulukan karena
 * dialah yang menunggu deploy. Best-effort: kegagalan D1 → null (dibalik
 * alasan ke pemanggil).
 */
export async function findOrderBySlug(slug: string): Promise<OrderRow | null> {
  const databaseId = getCurrentD1DatabaseId();
  if (!databaseId) return null;

  const rows = await queryD1ForDatabase<OrderRow>(
    databaseId,
    `SELECT id, buyer_email, buyer_name FROM orders
      WHERE desired_slug = ?
      ORDER BY CASE WHEN status = 'activated' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

/**
 * Daftar slug dari orders hidup (`pending_payment` / `waiting_verification` /
 * `activated`) untuk dropdown saran di portal. Best-effort: error → [].
 */
export async function listOrderSlugs(): Promise<string[]> {
  loadProductEnv();
  try {
    const databaseId = getCurrentD1DatabaseId();
    if (!databaseId) return [];

    const rows = await queryD1ForDatabase<{ desired_slug: string }>(
      databaseId,
      `SELECT DISTINCT desired_slug FROM orders
        WHERE status IN ('pending_payment', 'waiting_verification', 'activated')
          AND desired_slug IS NOT NULL AND desired_slug != ''
        ORDER BY desired_slug`
    );
    return rows.map((row) => row.desired_slug).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Template yang dibeli untuk slug ini di D1 owner (v1.3.93).
 *
 * Satu checkout bisa berisi beberapa template (`order_items`). Portal
 * onboarding hanya menanyakan SATU template untuk `active_template_key`,
 * jadi kepemilikan template lain harus diambil dari order agar pembeli
 * multi-template tidak kehilangan aksesnya.
 *
 * Semua order lunas untuk slug ini digabung (bukan hanya yang terakhir):
 * slug bisa pernah order lalu batal, lalu membeli lagi — setiap pembelian
 * menambah template yang berhak dipakai.
 *
 * `price` = harga efektif per template (`order_items.final_price`, sudah
 * dipotong diskon). `null` = order lama tanpa rincian item → pemanggil
 * memakai harga default. Best-effort: query gagal → [].
 */
export interface PurchasedTemplate {
  templateId: string;
  price: number | null;
}

export async function listPurchasedTemplates(slug: string): Promise<PurchasedTemplate[]> {
  loadProductEnv();
  try {
    const databaseId = getCurrentD1DatabaseId();
    if (!databaseId) return [];

    let items: Array<{ template_id: string; final_price: number }> = [];
    try {
      items = await queryD1ForDatabase<{ template_id: string; final_price: number }>(
        databaseId,
        `SELECT i.template_id AS template_id, i.final_price AS final_price
           FROM order_items i
           JOIN orders o ON o.id = i.order_id
          WHERE o.desired_slug = ?
            AND o.status IN ('activated', 'waiting_verification')
          ORDER BY o.created_at ASC`,
        [slug]
      );
    } catch {
      // Tabel `order_items` belum ada di database owner lama — pakai fallback.
      items = [];
    }

    const byTemplate = new Map<string, number | null>();
    for (const item of items) {
      if (!item?.template_id) continue;
      const price = Number(item.final_price);
      byTemplate.set(item.template_id, Number.isFinite(price) ? price : null);
    }
    if (byTemplate.size > 0) {
      return Array.from(byTemplate, ([templateId, price]) => ({ templateId, price }));
    }

    const legacy = await queryD1ForDatabase<{ template_id: string | null }>(
      databaseId,
      `SELECT template_id FROM orders
        WHERE desired_slug = ?
          AND status IN ('activated', 'waiting_verification')
        ORDER BY created_at DESC
        LIMIT 1`,
      [slug]
    );
    const main = legacy[0]?.template_id;
    return main ? [{ templateId: main, price: null }] : [];
  } catch {
    return [];
  }
}

/**
 * Catat bukti serah terima ke D1 owner: `orders.site_url` + `orders.provisioned_at`
 * pada order `activated` milik slug. WAJIB dijalankan sebelum gerbang email —
 * pencatatan tetap jalan walau email tidak dikonfigurasi (sesuai janji di
 * komentar header). Best-effort: kegagalan tidak boleh menggagalkan deploy.
 */
export async function recordProvisionedSite(
  slug: string,
  websiteUrl: string
): Promise<OnlineEmailResult> {
  loadProductEnv();
  try {
    const databaseId = getCurrentD1DatabaseId();
    if (!databaseId) {
      return { sent: false, reason: 'Pencatatan site_url dilewati: database D1 owner tidak ditemukan di env.' };
    }
    const now = new Date().toISOString();
    await queryD1ForDatabase(
      databaseId,
      `UPDATE orders
         SET site_url = ?, provisioned_at = ?, updated_at = ?
       WHERE desired_slug = ? AND status = 'activated'`,
      [websiteUrl, now, now, slug]
    );
    return { sent: true, reason: `Bukti serah terima tercatat: site_url=${websiteUrl} (slug ${slug}).` };
  } catch (err) {
    return { sent: false, reason: `Pencatatan site_url gagal (${(err as Error).message}).` };
  }
}

/**
 * Kirim email "Website Sudah Online". Tidak pernah melempar — semua kegagalan
 * dikembalikan sebagai `{ sent: false, reason }` supaya deploy yang sudah sukses
 * tidak dianggap gagal oleh portal.
 */
export async function sendWebsiteOnlineEmail(params: {
  slug: string;
  websiteUrl: string;
}): Promise<OnlineEmailResult> {
  const { slug, websiteUrl } = params;
  loadProductEnv();

  // Bukti serah terima dulu, SEBELUM gerbang email — deploy sukses wajib
  // tercatat ke order walau provider email belum diisi.
  const record = await recordProvisionedSite(slug, websiteUrl);
  console.log(record.sent ? `📝 ${record.reason}` : `⚠️ ${record.reason}`);

  const provider = (process.env.NOTIFICATION_PROVIDER || '').trim().toLowerCase();
  const apiKey = (process.env.NOTIFICATION_API_KEY || '').trim();
  const from = (process.env.NOTIFICATION_DEFAULT_FROM || '').trim();
  if (provider !== 'resend' || !apiKey || !from) {
    return {
      sent: false,
      reason: 'Email "Sudah Online" dilewati: NOTIFICATION_PROVIDER/API_KEY belum dikonfigurasi.',
    };
  }

  let order: OrderRow | null = null;
  try {
    order = await findOrderBySlug(slug);
  } catch (err) {
    return {
      sent: false,
      reason: `Email "Sudah Online" dilewati: gagal membaca order di D1 owner (${(err as Error).message}).`,
    };
  }

  if (!order?.buyer_email) {
    return {
      sent: false,
      reason: 'Email "Sudah Online" dilewati: tidak ada order dengan slug ini di D1 owner.',
    };
  }

  const nameText = (order.buyer_name || '').trim() || 'Pelanggan';
  const nameHtml = escapeHtml(nameText);
  const urlHtml = escapeHtml(websiteUrl);
  const orderIdHtml = escapeHtml(order.id);
  const slugHtml = escapeHtml(slug);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: order.buyer_email,
        subject: `🎉 Website Anda Sudah Online`,
        text: [
          `Halo ${nameText},`,
          '',
          'Kabar baik: website portofolio Anda sudah ONLINE dan bisa dibuka siapa saja:',
          websiteUrl,
          '',
          'Ringkasan order:',
          `• Order ID: ${order.id}`,
          `• Alamat website: ${websiteUrl}`,
          '',
          'Langkah berikutnya:',
          '1. Buka link di atas untuk melihat website Anda.',
          '2. Akses login pengaturan website (panel /admin) kami serahkan lewat WhatsApp.',
          '3. Butuh penyesuaian konten (judul, proyek, foto, kontak)? Balas email ini atau kabari lewat WhatsApp — kami siap membantu.',
          '',
          'Simpan email ini sebagai bukti serah terima.',
          '',
          '— Make it Better Studio',
        ].join('\n'),
        html: [
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">`,
          `<h2 style="margin:0 0 4px">🎉 Website Anda Sudah Online</h2>`,
          `<p style="color:#64748b;font-size:13px;margin:0 0 20px">Make it Better Studio</p>`,
          `<p style="font-size:13px;color:#334155">Halo <strong>${nameHtml}</strong>, kabar baik: website portofolio Anda sudah online dan bisa dibuka siapa saja.</p>`,
          `<table style="width:100%;font-size:13px;border-collapse:collapse">`,
          `<tr><td style="padding:6px 0;color:#64748b">Order ID</td><td style="padding:6px 0;text-align:right;font-weight:700;font-family:monospace">${orderIdHtml}</td></tr>`,
          `<tr><td style="padding:6px 0;color:#64748b">Alamat</td><td style="padding:6px 0;text-align:right;font-weight:700;font-family:monospace">${urlHtml}</td></tr>`,
          `</table>`,
          `<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">`,
          `<a href="${urlHtml}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Buka Website Anda</a>`,
          `<p style="font-size:13px;color:#334155;margin:16px 0 0">Akses login pengaturan website (panel <code>/admin</code>) kami serahkan lewat WhatsApp.</p>`,
          `<p style="font-size:13px;color:#334155;margin:8px 0 0">Butuh penyesuaian konten (judul, proyek, foto, kontak)? Balas email ini atau kabari lewat WhatsApp — kami siap membantu.</p>`,
          `<p style="font-size:11px;color:#94a3b8;margin:16px 0 0">Simpan email ini sebagai bukti serah terima.</p>`,
          `</div>`,
        ].join(''),
      }),
    });

    if (!res.ok) {
      return { sent: false, reason: `Email "Sudah Online" ditolak Resend (HTTP ${res.status}).` };
    }
    return { sent: true, reason: `Email "Website Sudah Online" terkirim ke ${order.buyer_email} (slug ${slugHtml}).` };
  } catch (err) {
    return {
      sent: false,
      reason: `Email "Sudah Online" gagal dikirim (${(err as Error).message}).`,
    };
  }
}

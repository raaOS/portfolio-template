/**
 * Email "🎉 Website Sudah Online" — dikirim portal onboarding / CLI
 * SETELAH `deployClient()` sukses (PK2, rencana v1.3.27).
 *
 * Pemisahan jujur (keputusan owner 2026-10-07):
 *  - `orderService.sendActivationEmail` → "✅ Pembayaran Terverifikasi —
 *    Website Sedang Disiapkan" (janji 1×24 jam, TANPA link) saat pembayaran masuk.
 *  - Modul ini → "🎉 Website Anda Sudah Online: <url>" dengan URL benar
 *    (`https://<slug>.workers.dev`), hanya setelah deploy benar-benar sukses.
 *
 * Pencarian pembeli: order di D1 OWNER dengan `desired_slug = slug` (order
 * `activated` diprioritaskan). Tanpa order (deploy demo/manual) atau tanpa
 * konfigurasi Resend → email DILEWATI dengan alasan jelas, bukan error.
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
        subject: `🎉 Website Anda Sudah Online — ${slug}.workers.dev`,
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

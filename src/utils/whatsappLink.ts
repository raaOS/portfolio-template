/**
 * WhatsApp Link Builder — jembatan chat ↔ WhatsApp.
 *
 * Jendela Contact (desktop OS) meneruskan pesan pengunjung langsung ke
 * WhatsApp yang ditulis klien di admin (app "Contacts" → Nomor WhatsApp,
 * data `contact.info.socialMedia.whatsapp`). Percakapan lanjutannya terjadi
 * di aplikasi WhatsApp milik klien — di luar template — sehingga chat
 * visitor tidak lagi menyimpan pesan di D1 maupun melakukan polling
 * (`useChatSync` dengan nomor WA = mode tanpa jaringan).
 *
 * Murni fungsi tanpa dependency — aman dipakai di client maupun server.
 *
 * @module whatsappLink
 */

/**
 * Menormalkan nomor WhatsApp raw menjadi digit internasional ( untuk wa.me).
 *
 * Menerima bentuk yang lazim diisikan klien di admin:
 * - `0812-3456-7890` / `0812 3456 789`   → dibersihkan, prefix `0` → `62`
 * - `+62 812 3456 7890`                  → `6281234567890`
 * - `6281234567890`                      → dipakai apa adanya
 * - URL `https://wa.me/628123...` dan `https://api.whatsapp.com/send?phone=628123...`
 *   → digit setelah `wa.me/` atau `phone=` yang dipakai (bukan digit acak di dalam pesan)
 *
 * @returns digit internasional yang valid, atau `null` bila tidak layak
 *          dipakai untuk `wa.me` (kosong, bukan nomor, atau di luar
 *          8–15 digit). Panggilan dengan `null`/`undefined` mengembalikan
 *          `null` — caller memakai ini untuk memilih mode chat.
 */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let value = String(raw).trim();
  if (!value) return null;

  // Paste URL wa.me / api.whatsapp.com → ambil angka nomornya saja.
  const urlMatch = value.match(/(?:wa\.me\/|phone=)(\d+)/i);
  if (urlMatch) {
    value = urlMatch[1];
  }

  const digits = value.replace(/\D/g, '');
  if (!digits || digits.length < 8 || digits.length > 15) return null;

  // Nomor lokal Indonesia diawali `0` → konversi ke internasional `62`
  // (wa.me hanya menerima format internasional).
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

/**
 * Membangun link `wa.me` lengkap dengan pesan prefilled.
 *
 * @returns `https://wa.me/<digit>?text=<pesan ter-encode>`, atau `null`
 *          bila nomornya tidak valid/kosong (caller jatuh ke perilaku lama).
 */
export function buildWhatsAppLink(
  raw: string | null | undefined,
  text?: string
): string | null {
  const number = normalizeWhatsAppNumber(raw);
  if (!number) return null;

  const trimmed = typeof text === 'string' ? text.trim() : '';
  const query = trimmed ? `?text=${encodeURIComponent(trimmed)}` : '';
  return `https://wa.me/${number}${query}`;
}

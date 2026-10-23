/**
 * Test `buildOrderHref` (reel halaman jualan) — sumber kebenaran link tombol
 * "Pesan" di nav, modal, dan footer.
 *
 * Yang dijaga:
 * 1. Nomor kosong → JANGAN menghasilkan `wa.me` kosong; jatuh ke `/checkout`.
 * 2. Nomor berformat bebas → dinormalkan jadi digit murni.
 * 3. Pesan prefill memuat nama template + harga + link checkout absolut.
 */
import { describe, expect, it } from 'vitest';

import { formatIdr } from '@/constants/pricing';
import { getPublicBaseUrl } from '@/lib/constants';
import { buildOrderHref, REEL_TEMPLATES } from '@/components/landing/reel/reelData';

const template = REEL_TEMPLATES[0];

function decodeText(href: string): string {
  const url = new URL(href);
  return decodeURIComponent(url.searchParams.get('text') || '');
}

describe('buildOrderHref', () => {
  it('jatuh ke /checkout saat nomor WhatsApp kosong', () => {
    expect(buildOrderHref('', template, 199000)).toBe('/checkout');
    expect(buildOrderHref('   ', template, 199000)).toBe('/checkout');
    expect(buildOrderHref('---', template)).toBe('/checkout');
  });

  it('menormalkan nomor jadi digit murni', () => {
    const href = buildOrderHref('+62 812-3456-7890', template, 199000);
    expect(href.startsWith('https://wa.me/6281234567890?text=')).toBe(true);
  });

  it('memprefill nama template, harga, dan link checkout absolut', () => {
    const href = buildOrderHref('6281234567890', template, 199000);
    const text = decodeText(href);

    expect(text).toContain(`pesan template ${template.name}`);
    expect(text).toContain(formatIdr(199000));
    expect(text).toContain(`${getPublicBaseUrl()}/checkout`);
  });

  it('memakai label generik saat template tidak disertakan', () => {
    const text = decodeText(buildOrderHref('6281234567890'));
    expect(text).toContain('template portfolio');
  });

  it('membuat link wa.me yang valid', () => {
    const href = buildOrderHref('6281234567890', template, 199000);
    const url = new URL(href);
    expect(url.origin).toBe('https://wa.me');
    expect(url.searchParams.get('text')).toBeTruthy();
  });
});

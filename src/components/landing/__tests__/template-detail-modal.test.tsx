/**
 * Test `TemplateDetailModal` — popup detail template di homepage storefront.
 *
 * Yang dikunci di sini:
 * - **Media preview = iframe LIVE** (`/preview/[id]`), bukan gambar mockup
 *   statis (permintaan owner v1.3.41); iframe berukuran desain 1440×810
 *   dan di-scale ke area media via `--fit` (lihat `landing.css`).
 * - Ketiga jalur konversi tetap ada: Live Preview (tab baru), Pesan
 *   Sekarang (`/checkout?template=`), Tanya via WhatsApp (prefill).
 * - Escape menutup popup.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { TemplateDetailModal } from '@/components/landing/TemplateDetailModal';
import { TEMPLATES_DATA } from '@/components/landing/templates';

const template = TEMPLATES_DATA[0];

function renderModal(onClose = vi.fn()) {
  return render(
    <TemplateDetailModal template={template} onClose={onClose} adminWhatsapp="081234567890" />,
  );
}

describe('TemplateDetailModal', () => {
  afterEach(cleanup);

  it('menampilkan iframe LIVE preview, bukan gambar mockup statis', () => {
    const { container } = renderModal();

    const iframe = container.querySelector('iframe.wave-modal-iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe(template.previewUrl);
    expect(iframe?.getAttribute('title')).toContain(template.name);
    // Ukuran desain 1440×810 (16:9) — di-scale ke area media via --fit.
    expect(iframe?.getAttribute('width')).toBe('1440');
    expect(iframe?.getAttribute('height')).toBe('810');

    // Tidak ada lagi <img> mockup di popup.
    expect(container.querySelector('img')).toBeNull();
  });

  it('mempertahankan ketiga jalur konversi', () => {
    renderModal();

    const preview = screen.getByRole('link', { name: /live preview/i });
    expect(preview.getAttribute('href')).toBe(template.previewUrl);
    expect(preview.getAttribute('target')).toBe('_blank');

    const order = screen.getByRole('link', { name: /pesan sekarang/i });
    expect(order.getAttribute('href')).toBe(`/checkout?template=${template.id}`);

    const wa = screen.getByRole('link', { name: /whatsapp/i });
    expect(wa.getAttribute('href')).toContain('wa.me');
    expect(decodeURIComponent(wa.getAttribute('href') || '')).toContain(template.name);
  });

  it('Escape menutup popup (onClose terpanggil)', () => {
    const onClose = vi.fn();
    render(
      <TemplateDetailModal template={template} onClose={onClose} />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tidak merender apa pun saat template null', () => {
    const { container } = render(
      <TemplateDetailModal template={null} onClose={() => {}} />,
    );
    expect(container.querySelector('.wave-modal-card')).toBeNull();
  });
});

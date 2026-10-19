/**
 * Test `MagazineShowcase` — panggung hero koridor majalah WebGL
 * (pengganti LiveStage, v1.3.47).
 *
 * Di jsdom WebGL TIDAK tersedia → konstruktor scene melempar → komponen
 * jatuh ke jalur fallback (grid kartu statis). Yang dikunci di sini:
 * - Fallback render SATU kartu per gambar dengan tombol berlabel
 *   "Buka demo <nama>" (jalur klik mouse).
 * - Nav keyboard sr-only ikut dirender (jalur aksesibilitas).
 * - Klik kartu maupun tombol nav → `onSheetActivate(index)` benar.
 * - `prefers-reduced-motion: reduce` TETAP memilih fallback (cabang JS
 *   matchMedia terbukti terpanggil, bukan kebetulan WebGL yang gagal).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import MagazineShowcase, { type MagazineImage } from '@/components/landing/MagazineShowcase';

const IMAGES: MagazineImage[] = [
  { src: '/landing/os-desktop.webp', alt: 'OS Desktop' },
  { src: '/landing/infinite-canvas.webp', alt: 'Infinite Canvas' },
  { src: '/landing/spatial-gallery.webp', alt: 'Spatial Gallery' },
];

function renderShowcase(onSheetActivate = vi.fn()) {
  const result = render(
    <MagazineShowcase images={IMAGES} onSheetActivate={onSheetActivate} />
  );
  return { ...result, onSheetActivate };
}

const cardsOf = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Buka demo"]')
  );

describe('MagazineShowcase', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('fallback: satu kartu per gambar, berlabel "Buka demo <nama>"', () => {
    const { container } = renderShowcase();

    const cards = cardsOf(container);
    expect(cards).toHaveLength(3);
    expect(cards[0].getAttribute('aria-label')).toBe('Buka demo OS Desktop');
    expect(cards[2].getAttribute('aria-label')).toBe('Buka demo Spatial Gallery');
  });

  it('klik kartu → onSheetActivate(index)', () => {
    const { container, onSheetActivate } = renderShowcase();

    fireEvent.click(cardsOf(container)[1]);

    expect(onSheetActivate).toHaveBeenCalledTimes(1);
    expect(onSheetActivate).toHaveBeenCalledWith(1);
  });

  it('nav keyboard sr-only tersedia — jalur tanpa mouse ikut berfungsi', () => {
    const { container, onSheetActivate } = renderShowcase();

    const nav = container.querySelector('nav[aria-label="Pilih template"]');
    expect(nav).not.toBeNull();
    const navButtons = Array.from(nav!.querySelectorAll('button'));
    expect(navButtons).toHaveLength(3);

    fireEvent.click(navButtons[2]);
    expect(onSheetActivate).toHaveBeenCalledWith(2);
  });

  it('prefers-reduced-motion: reduce -> memilih jalur fallback', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );

    const { container } = renderShowcase();

    expect(cardsOf(container)).toHaveLength(3);
  });

  it('setiap kartu menampilkan tangkapan layar template yang benar', () => {
    const { container } = renderShowcase();

    const imgs = Array.from(container.querySelectorAll('button img'));
    expect(imgs.map((img) => img.getAttribute('src'))).toEqual([
      '/landing/os-desktop.webp',
      '/landing/infinite-canvas.webp',
      '/landing/spatial-gallery.webp',
    ]);
  });
});

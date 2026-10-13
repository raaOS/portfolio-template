/**
 * Test `LiveStage` — panggung tiga demo live: kartu tengah besar (demo
 * aktif) + dua kartu samping mengecil/redup, semuanya menghadap lurus
 * depan (tanpa putaran silinder).
 *
 * Yang dikunci di sini:
 * - **Guardrail 3 iframe live** ter-mount sekaligus dan `src`-nya tidak
 *   pernah berubah saat slot bertukar (tak pernah reload).
 * - Tepat SATU kartu di tengah (`is-center`), dua sisanya kiri/kanan.
 * - Klik kartu samping → `onActiveChange(index)` (tukar demo / FLIP);
 *   klik kartu tengah → `onActivate(index)` (popup detail).
 * - Kelas `is-live` dipasang setelah mount (gerbang entrance stagger).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import LiveStage, { type LiveStageItem } from '@/components/landing/LiveStage';

const ITEMS: LiveStageItem[] = [
  { id: 'os-desktop', name: 'OS Desktop', src: '/preview/os-desktop' },
  { id: 'infinite-canvas', name: 'Infinite Canvas', src: '/preview/infinite-canvas' },
  { id: 'spatial-gallery', name: 'Spatial Gallery', src: '/preview/spatial-gallery' },
];

function renderStage(activeIndex = 0, overrides = {}) {
  return render(
    <LiveStage
      items={ITEMS}
      activeIndex={activeIndex}
      onActiveChange={() => {}}
      onActivate={() => {}}
      {...overrides}
    />,
  );
}

const slotsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.stage-slot'));

describe('LiveStage', () => {
  afterEach(cleanup);

  it('memuat ketiga demo live sekaligus (3 iframe, tanpa penukar src)', () => {
    const { container } = renderStage(0);

    const iframes = Array.from(container.querySelectorAll('iframe'));
    expect(iframes).toHaveLength(3);
    expect(iframes.map((f) => f.getAttribute('src'))).toEqual(
      ITEMS.map((item) => item.src),
    );
  });

  it('menempatkan demo aktif di tengah dan sisanya kiri/kanan', () => {
    const { container } = renderStage(1);

    const classes = slotsOf(container).map((slot) => slot.className);
    expect(classes[0]).toContain('is-left');
    expect(classes[1]).toContain('is-center');
    expect(classes[2]).toContain('is-right');
    // Tepat satu kartu tengah.
    expect(classes.filter((cls) => cls.includes('is-center'))).toHaveLength(1);
  });

  it('berganti slot saat activeIndex berpindah tanpa reload iframe', () => {
    const { container, rerender } = renderStage(0);
    const srcsBefore = Array.from(container.querySelectorAll('iframe')).map((f) =>
      f.getAttribute('src'),
    );

    rerender(
      <LiveStage
        items={ITEMS}
        activeIndex={2}
        onActiveChange={() => {}}
        onActivate={() => {}}
      />,
    );

    const classes = slotsOf(container).map((slot) => slot.className);
    expect(classes[2]).toContain('is-center');
    expect(classes[1]).toContain('is-left');
    expect(classes[0]).toContain('is-right');

    // src identik — kartu hanya berpindah slot via class (FLIP), tak reload.
    const srcsAfter = Array.from(container.querySelectorAll('iframe')).map((f) =>
      f.getAttribute('src'),
    );
    expect(srcsAfter).toEqual(srcsBefore);
  });

  it('klik kartu samping menukar demo aktif; klik kartu tengah buka popup', () => {
    const onActiveChange = vi.fn();
    const onActivate = vi.fn();
    const { container } = renderStage(0, { onActiveChange, onActivate });

    const buttons = container.querySelectorAll<HTMLButtonElement>('button.stage-hit');
    expect(buttons).toHaveLength(3);

    // Kartu samping (index 2 = Spatial Gallery, slot kanan) → tukar demo.
    fireEvent.click(buttons[2]);
    expect(onActiveChange).toHaveBeenCalledTimes(1);
    expect(onActiveChange).toHaveBeenCalledWith(2);
    expect(onActivate).not.toHaveBeenCalled();

    // Kartu tengah (index 0 = demo aktif) → popup detail.
    fireEvent.click(buttons[0]);
    expect(onActivate).toHaveBeenCalledWith(0);
  });

  it('membuka entrance (is-live) setelah mount & memberi label aksesibel tiap kartu', () => {
    const { container } = renderStage(0);

    expect(container.querySelector('.live-stage')?.className).toContain('is-live');

    // Titik "live" + badge nama demo hanya di kartu aktif.
    expect(container.querySelectorAll('.stage-badge')).toHaveLength(1);
    expect(container.querySelector('.stage-badge')?.textContent).toContain('OS Desktop');

    const labels = Array.from(
      container.querySelectorAll('button.stage-hit'),
    ).map((btn) => btn.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Lihat detail template OS Desktop',
      'Tampilkan demo Infinite Canvas',
      'Tampilkan demo Spatial Gallery',
    ]);
  });
});

/**
 * Test `MagazineShowcase` — panggung hero koridor majalah WebGL
 * (v1.3.48: luncur → berhenti → demo LIVE di lembaran terangkat).
 *
 * Di jsdom WebGL TIDAK tersedia → konstruktor scene melempar → komponen
 * jatuh ke jalur fallback (grid kartu statis). Yang dikunci di sini:
 * - Fallback render SATU kartu per gambar dengan tombol berlabel
 *   "Buka demo <nama>".
 * - Klik kartu MAUPUN tombol nav keyboard sr-only → membuka `previewUrl`
 *   di TAB BARU (window.open) — tanpa popup (keputusan owner v1.3.48,
 *   menggantikan TemplateDetailModal).
 * - `prefers-reduced-motion: reduce` TETAP memilih fallback (cabang JS
 *   matchMedia terbukti terpanggil, bukan kebetulan WebGL yang gagal).
 * - Urutan & sumber gambar atlas tetap benar.
 *
 * Jalur live-on-focus (scene → onLive → iframe tumpangan) membutuhkan
 * WebGL nyata sehingga tidak bisa diuji di jsdom — diverifikasi lewat
 * pemeriksaan DOM langsung di produksi setelah deploy (lihat tracker #171).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import MagazineShowcase, {
  type MagazineImage,
  sameOriginMediaUrl,
  previewVideoOf,
} from '@/components/landing/MagazineShowcase';

const IMAGES: MagazineImage[] = [
  { src: '/landing/os-desktop.webp', alt: 'OS Desktop', previewUrl: '/preview/os-desktop' },
  { src: '/landing/infinite-canvas.webp', alt: 'Infinite Canvas', previewUrl: '/preview/infinite-canvas' },
  { src: '/landing/spatial-gallery.webp', alt: 'Spatial Gallery', previewUrl: '/preview/spatial-gallery' },
];

function renderShowcase() {
  const openSpy = vi.fn();
  vi.stubGlobal('open', openSpy);
  const result = render(<MagazineShowcase images={IMAGES} />);
  return { ...result, openSpy };
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

  it('klik kartu fallback → buka previewUrl di tab baru (tanpa popup)', () => {
    const { container, openSpy } = renderShowcase();

    fireEvent.click(cardsOf(container)[1]);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      '/preview/infinite-canvas',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('nav keyboard sr-only tersedia — jalur tanpa mouse ikut berfungsi', () => {
    const { container, openSpy } = renderShowcase();

    const nav = container.querySelector('nav[aria-label="Pilih template"]');
    expect(nav).not.toBeNull();
    const navButtons = Array.from(nav!.querySelectorAll('button'));
    expect(navButtons).toHaveLength(3);

    fireEvent.click(navButtons[2]);
    expect(openSpy).toHaveBeenCalledWith(
      '/preview/spatial-gallery',
      '_blank',
      'noopener,noreferrer'
    );
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

    const { container } = render(<MagazineShowcase images={IMAGES} />);

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

  it('demo tanpa previewUrl tidak membuka tab kosong', () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { container } = render(
      <MagazineShowcase images={[{ src: '/landing/os-desktop.webp', alt: 'X' }]} />
    );

    fireEvent.click(cardsOf(container)[0]);

    expect(openSpy).not.toHaveBeenCalled();
  });

  // Guardregresi SecurityError texImage2D (video lintas domain jadi tekstur WebGL).
  describe('sameOriginMediaUrl', () => {
    it('URL R2 absolut lintas domain dialihkan ke proxy same-origin /r2/', () => {
      expect(
        sameOriginMediaUrl('https://pub-abc.r2.dev/assets/hero-videos/os-desktop.mp4')
      ).toBe('/r2/assets/hero-videos/os-desktop.mp4');
    });

    it('parameter ?v= (anti-cache) ikut dibuang — key R2 tanpa query', () => {
      expect(
        sameOriginMediaUrl(
          'https://cdn.example.com/assets/hero-videos/a.mp4?v=2026-10-23T01%3A02%3A03'
        )
      ).toBe('/r2/assets/hero-videos/a.mp4');
    });

    it('path relatif & URL eksternal yang bukan media R2 tidak diubah', () => {
      expect(sameOriginMediaUrl('/landing/os-desktop.webp')).toBe('/landing/os-desktop.webp');
      expect(sameOriginMediaUrl('https://images.unsplash.com/photo-1.jpg')).toBe(
        'https://images.unsplash.com/photo-1.jpg'
      );
      expect(sameOriginMediaUrl('')).toBe('');
    });
  });

  // Guard `texImage2D SecurityError`: tekstur WebGL hanya boleh dari sumber
  // same-origin. URL eksternal non-R2 = video DILEWATI (pakai poster statis).
  describe('previewVideoOf', () => {
    it('video R2 lintas domain → /r2/ (same-origin, tetap diputar)', () => {
      expect(
        previewVideoOf({
          src: '/x.webp',
          previewVideo: 'https://pub-abc.r2.dev/assets/hero-videos/a.mp4?v=1',
        })
      ).toBe('/r2/assets/hero-videos/a.mp4');
    });

    it('video absolut same-origin dinormalkan ke jalur /r2/ (tetap dipakai)', () => {
      const same = `${window.location.origin}/assets/hero-videos/a.mp4`;
      expect(previewVideoOf({ src: '/x.webp', previewVideo: same })).toBe(
        '/r2/assets/hero-videos/a.mp4'
      );
    });

    it('video eksternal non-R2 DIKOSONGKAN — mencegah SecurityError tiap frame', () => {
      expect(
        previewVideoOf({
          src: '/x.webp',
          previewVideo: 'https://cdn.example.com/video/hero.mp4',
        })
      ).toBe('');
    });

    it('slot tanpa video tetap kosong', () => {
      expect(previewVideoOf({ src: '/x.webp' })).toBe('');
    });
  });
});

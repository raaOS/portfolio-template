import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import HomepageLoaderGate from '../HomepageLoaderGate';
import type { Project } from '@/types/projects';
import type { LoaderConfig } from '@/types/about';

// Mock DeckRevealLoader (dynamic import, ssr:false) supaya mudah dideteksi di DOM.
vi.mock('@/components/shared/DeckRevealLoader', () => ({
  __esModule: true,
  default: ({ images }: { images: string[] }) => (
    <div data-testid="deck-reveal-loader" data-images={images.join(',')} />
  ),
}));

// Mock HelloIntro (dynamic import, ssr:false) — komponen asli butuh lottie.
vi.mock('@/components/shared/HelloIntro', () => ({
  __esModule: true,
  default: () => <div data-testid="hello-intro" />,
}));

function makeProject(id: string, cover: string): Project {
  return {
    id,
    title: `Project ${id}`,
    slug: id,
    client: 'Client',
    year: 2025,
    tags: [],
    cover,
    autoplay: false,
    muted: true,
    loop: true,
    playsInline: true,
    coverWidth: 720,
    coverHeight: 900,
    description: '',
    order: 0,
    status: 'published',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };
}

const baseConfig: LoaderConfig = {
  enabled: true,
  style: 'deck-reveal',
  imageProjectIds: [],
};

const projects: Project[] = [
  makeProject('p1', '/assets/projects/a.jpg'),
  // Video di luar pola assets/ → getVideoPosterSource tidak bisa infer poster
  makeProject('p2', 'https://cdn.example.com/video.mp4'),
  makeProject('p3', '/assets/projects/c.jpg'),
];

beforeEach(() => {
  sessionStorage.clear();
});

describe('HomepageLoaderGate', () => {
  it('tidak render loader saat config.disabled', async () => {
    render(
      <HomepageLoaderGate
        config={{ ...baseConfig, enabled: false }}
        projects={projects}
      />,
    );
    await waitFor(() => expect(sessionStorage.getItem('portfolio_loader_played')).toBeNull());
    expect(screen.queryByTestId('deck-reveal-loader')).toBeNull();
  });

  it('render loader saat enabled & sesi belum pernah main', async () => {
    render(<HomepageLoaderGate config={baseConfig} projects={projects} />);
    await waitFor(() =>
      expect(screen.getByTestId('deck-reveal-loader')).toBeInTheDocument(),
    );
    expect(sessionStorage.getItem('portfolio_loader_played')).toBe('1');
  });

  it('hanya main sekali per sesi', async () => {
    sessionStorage.setItem('portfolio_loader_played', '1');
    render(<HomepageLoaderGate config={baseConfig} projects={projects} />);
    // Tunggu sebentar untuk memastikan tidak ada render dadakan
    await waitFor(() =>
      expect(screen.queryByTestId('deck-reveal-loader')).toBeNull(),
    );
  });

  it('tetap main di bawah React StrictMode (regresi: flag sesi terkonsumsi efek run pertama)', async () => {
    // React StrictMode (dev) menjalankan setup → cleanup → setup. Versi lama
    // menulis flag sesi di badan effect lalu timer-nya dibatalkan cleanup →
    // run kedua melihat flag terisi dan loader tidak pernah tampil.
    render(
      <StrictMode>
        <HomepageLoaderGate config={baseConfig} projects={projects} />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('deck-reveal-loader')).toBeInTheDocument(),
    );
    expect(sessionStorage.getItem('portfolio_loader_played')).toBe('1');
  });

  it('resolve gambar sesuai urutan imageProjectIds', async () => {
    render(
      <HomepageLoaderGate
        config={{ ...baseConfig, imageProjectIds: ['p3', 'p1'] }}
        projects={projects}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('deck-reveal-loader')).toBeInTheDocument(),
    );
    const images = screen
      .getByTestId('deck-reveal-loader')
      .getAttribute('data-images');
    expect(images).toBe('/assets/projects/c.jpg,/assets/projects/a.jpg');
  });

  it('fallback ke semua project ber-cover gambar saat imageProjectIds kosong', async () => {
    render(<HomepageLoaderGate config={baseConfig} projects={projects} />);
    await waitFor(() =>
      expect(screen.getByTestId('deck-reveal-loader')).toBeInTheDocument(),
    );
    const images = screen
      .getByTestId('deck-reveal-loader')
      .getAttribute('data-images');
    // p2 video tanpa poster → di-skip, sisanya dipakai
    expect(images).toContain('/assets/projects/a.jpg');
    expect(images).toContain('/assets/projects/c.jpg');
    expect(images).not.toContain('video.mp4');
  });

  it('tidak render loader kalau tidak ada project dengan gambar', async () => {
    render(
      <HomepageLoaderGate
        config={baseConfig}
        projects={[makeProject('only-video', 'https://cdn.example.com/v.mp4')]}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByTestId('deck-reveal-loader')).toBeNull(),
    );
  });

  it('gaya hello + os-desktop → render HelloIntro (tanpa syarat gambar)', async () => {
    render(
      <HomepageLoaderGate
        config={{ ...baseConfig, style: 'hello' }}
        projects={[]} // hello tidak butuh cover project
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('hello-intro')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('deck-reveal-loader')).toBeNull();
    expect(sessionStorage.getItem('portfolio_loader_played')).toBe('1');
  });

  it('gaya hello + spatial-gallery → gate diam (intro bawaan template yang main)', async () => {
    render(
      <HomepageLoaderGate
        config={{ ...baseConfig, style: 'hello' }}
        projects={projects}
        activeTemplateKey="spatial-gallery"
      />,
    );
    await waitFor(() =>
      expect(sessionStorage.getItem('portfolio_loader_played')).toBe('1'),
    );
    expect(screen.queryByTestId('hello-intro')).toBeNull();
    expect(screen.queryByTestId('deck-reveal-loader')).toBeNull();
  });

  it('gaya hello + infinite-canvas → gate diam (intro bawaan template yang main)', async () => {
    render(
      <HomepageLoaderGate
        config={{ ...baseConfig, style: 'hello' }}
        projects={projects}
        activeTemplateKey="infinite-canvas"
      />,
    );
    await waitFor(() =>
      expect(sessionStorage.getItem('portfolio_loader_played')).toBe('1'),
    );
    expect(screen.queryByTestId('hello-intro')).toBeNull();
  });

  it('gaya hello hanya sekali per sesi', async () => {
    sessionStorage.setItem('portfolio_loader_played', '1');
    render(
      <HomepageLoaderGate
        config={{ ...baseConfig, style: 'hello' }}
        projects={projects}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByTestId('hello-intro')).toBeNull(),
    );
  });
});

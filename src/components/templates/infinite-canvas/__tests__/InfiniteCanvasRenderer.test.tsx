import React from 'react';
import { render as rtlRender, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import InfiniteCanvasRenderer from '../InfiniteCanvasRenderer';
import type { PortfolioTemplateData } from '@/types/template';
import type { Project } from '@/types/projects';

function render(ui: React.ReactElement) {
  return rtlRender(<LanguageProvider>{ui}</LanguageProvider>);
}

// Mock ProjectDetailWrapper so we don't load heavy subcomponents during unit tests
vi.mock('@/components/os/ui/ProjectDetailWrapper', () => ({
  default: ({ project }: { project: Project }) => (
    <div data-testid="project-detail-wrapper">Detail: {project.title}</div>
  ),
}));

let mockIsAdmin = false;
const mockCsrfToken = 'test-csrf-token';

vi.mock('@/hooks/useAdminAuth', () => ({
  useAdminAuth: () => ({
    isAdmin: mockIsAdmin,
    csrfToken: mockCsrfToken,
    isLoading: false,
  }),
}));

function createMockData(projectCount: number = 21): PortfolioTemplateData {
  const projects: Project[] = Array.from({ length: projectCount }, (_, i) => ({
    id: `project-${i + 1}`,
    title: `Proyek ${i + 1}`,
    slug: `proyek-${i + 1}`,
    client: `Klien ${i + 1}`,
    year: 2025,
    tags: ['Design', 'Web'],
    cover: `/cover-${i + 1}.jpg`,
    autoplay: false,
    muted: true,
    loop: false,
    playsInline: true,
    coverWidth: 1200,
    coverHeight: 800,
    description: `Deskripsi Proyek ${i + 1}`,
    order: i + 1,
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));

  return {
    site: {
      id: 'default-site',
      slug: 'default-site',
      title: 'Studio Kreatif',
      description: 'Portofolio interaktif',
      avatarUrl: '/avatar.jpg',
      activeTemplateKey: 'infinite-canvas',
    },
    about: {
      hero: {
        title: 'Creative Technologist',
        backgroundTrail: ['/trail-1.jpg'],
        availability: {
          status: 'available',
          text: 'Tersedia untuk proyek baru',
        },
      },
      professional: {
        motto: {
          badge: 'Creative Technologist',
          quote: 'Building digital experiences',
        },
        bio: {
          content: 'Desainer dan engineer yang berfokus pada web modern.',
        },
      },
      softSkills: {},
      lastUpdated: '2026-01-01T00:00:00.000Z',
    },
    projects,
    hardSkills: [
      {
        id: '1',
        name: 'TypeScript',
        level: 'Expert',
        iconUrl: '/icons/ts.svg',
        order: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        name: 'Next.js',
        level: 'Advanced',
        iconUrl: '/icons/next.svg',
        order: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    experiences: [
      {
        id: '1',
        position: 'Lead Designer',
        company: 'Acme Corp',
        year: '2024 - Sekarang',
        duration: '1 tahun',
        description: ['Memimpin tim desain produk.'],
        imageUrl: '/images/exp-1.jpg',
      },
    ],
    events: [],
    contact: {
      info: {
        email: 'halo@studiokreatif.com',
        phone: '+628123456789',
        address: 'Jakarta, Indonesia',
        socialMedia: {
          instagram: 'https://instagram.com/studio',
        },
      },
      formSettings: {
        enabled: true,
        fields: {
          name: { required: true, label: 'Nama' },
          email: { required: true, label: 'Email' },
          phone: { required: false, label: 'Telepon' },
          company: { required: false, label: 'Perusahaan' },
          subject: { required: false, label: 'Subjek' },
          message: { required: true, label: 'Pesan' },
        },
        submitButtonText: 'Kirim Pesan',
        successMessage: 'Pesan terkirim',
        errorMessage: 'Gagal mengirim pesan',
      },
      lastUpdated: '2026-01-01T00:00:00.000Z',
    },
    testimonials: [
      {
        id: '1',
        name: 'Budi Santoso',
        company: 'CEO Startup',
        notificationText: 'Hasil kerja sangat profesional dan memuaskan.',
        content: 'Hasil kerja sangat profesional dan memuaskan.',
      },
    ],
    lastUpdated: '2026-01-01T00:00:00.000Z',
  };
}

describe('InfiniteCanvasRenderer', () => {
  it('membatasi render menjadi tepat 10 aset proyek dari 21 proyek yang tersedia', () => {
    mockIsAdmin = false;
    const data = createMockData(21);
    render(<InfiniteCanvasRenderer data={data} />);

    // Proyek 1 sampai 10 harus ada di layar (diidentifikasi via aria-label / title kartu)
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByLabelText(`Proyek ${i}`)).toBeInTheDocument();
    }

    // Proyek ke-11 dan seterusnya tidak boleh dirender di kanvas
    expect(screen.queryByLabelText('Proyek 11')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Proyek 21')).not.toBeInTheDocument();
  });

  it('merender macOS Dock dengan 5 tombol ikon utama', () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    const dock = screen.getByRole('navigation', { name: /interactive macos dock/i });
    expect(dock).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /about me/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^wa$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hubungi saya/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /noted/i })).toBeInTheDocument();
  });

  it('tidak menampilkan CanvasAdminBar ketika user bukan admin (Visitor Mode)', () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    expect(screen.queryByLabelText(/admin mode controls/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Mode Admin')).not.toBeInTheDocument();
  });

  it('menampilkan CanvasAdminBar dengan tombol Simpan Posisi ketika user login sebagai admin', () => {
    mockIsAdmin = true;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    const adminBar = screen.getByLabelText(/admin mode controls/i);
    expect(adminBar).toBeInTheDocument();
    expect(screen.getByText('Mode Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /simpan posisi/i })).toBeInTheDocument();
    expect(within(adminBar).getByRole('button', { name: /reset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pratinjau/i })).toBeInTheDocument();
  });

  it('dapat beralih ke Mode Pratinjau Visitor dari Admin Bar', () => {
    mockIsAdmin = true;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    const previewToggleBtn = screen.getByRole('button', { name: /pratinjau/i });
    fireEvent.click(previewToggleBtn);

    // Badge status berubah menjadi Pratinjau Visitor
    expect(screen.getByText('Pratinjau Visitor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /simpan posisi/i })).not.toBeInTheDocument();

    // Toggle kembali ke Edit Posisi
    const editBtn = screen.getByRole('button', { name: /edit posisi/i });
    fireEvent.click(editBtn);

    expect(screen.getByText('Mode Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /simpan posisi/i })).toBeInTheDocument();
  });

  it('mengirimkan request PUT /api/about saat tombol Simpan Posisi diklik oleh Admin', async () => {
    mockIsAdmin = true;
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    const saveBtn = screen.getByRole('button', { name: /simpan posisi/i });
    fireEvent.click(saveBtn);

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/about',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'X-CSRF-Token': mockCsrfToken,
          }),
        })
      );
    });

    fetchSpy.mockRestore();
  });

  it('membuka slide drawer kiri ketika ikon About Me di Dock diklik', () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    const aboutBtn = screen.getByRole('button', { name: /about me/i });
    fireEvent.click(aboutBtn);

    // Verifikasi konten About Me muncul
    expect(screen.getByText('Tentang Saya')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Lead Designer')).toBeInTheDocument();
  });

  it('membuka slide drawer kiri ketika ikon Hubungi Saya di Dock diklik', () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    const contactBtn = screen.getByRole('button', { name: /hubungi saya/i });
    fireEvent.click(contactBtn);

    expect(screen.getByText('halo@studiokreatif.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/tuliskan pesan atau ide kolaborasi/i)).toBeInTheDocument();
  });

  it('membuka slide drawer kiri ketika ikon WA di Dock diklik', () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    const waBtn = screen.getByRole('button', { name: /^wa$/i });
    fireEvent.click(waBtn);

    expect(screen.getByText('Chat Langsung WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText(/hasil kerja sangat profesional/i)).toBeInTheDocument();
  });

  it('membuka slide drawer kiri ketika ikon Noted di Dock diklik', () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    const notedBtn = screen.getByRole('button', { name: /noted/i });
    fireEvent.click(notedBtn);

    expect(screen.getByText('Tambah Catatan Cepat')).toBeInTheDocument();
    expect(screen.getByText(/daftar memo/i)).toBeInTheDocument();
  });

  it('membuka right slide-over dengan layout jendela macOS ketika proyek diklik (bukan modal popup)', async () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    // Klik kartu Proyek 1 (diidentifikasi via aria-label / title)
    const projectCard = screen.getByLabelText('Proyek 1');
    fireEvent.click(projectCard);

    // Verifikasi right slide-over muncul dengan header jendela macOS
    expect(screen.getByText('Portfolio: Proyek 1')).toBeInTheDocument();
    expect(screen.getByTestId('project-detail-wrapper')).toHaveTextContent('Detail: Proyek 1');

    // Klik tombol tutup (traffic light merah)
    const closeBtn = screen.getByRole('button', { name: /tutup jendela/i });
    fireEvent.click(closeBtn);

    // Tunggu sampai elemen keluar dari DOM (AnimatePresence exit animation)
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(screen.queryByText('Portfolio: Proyek 1')).not.toBeInTheDocument();
    });
  });

  it('merender tombol translate ID / EN di pojok kanan dan mengganti bahasa saat diklik', () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    // Container language switcher di pojok kanan
    const langSwitch = screen.getByTestId('canvas-language-switch');
    expect(langSwitch).toBeInTheDocument();

    // Default bahasa adalah ID
    const enBtn = screen.getByRole('button', { name: 'EN' });
    const idBtn = screen.getByRole('button', { name: 'ID' });
    expect(enBtn).toBeInTheDocument();
    expect(idBtn).toBeInTheDocument();
    expect(idBtn).toHaveAttribute('aria-pressed', 'true');

    // Klik tombol EN untuk ganti bahasa ke Inggris
    fireEvent.click(enBtn);
    expect(enBtn).toHaveAttribute('aria-pressed', 'true');

    // Cek bahwa dock beralih ke bahasa Inggris: 'Hubungi Saya' -> 'Contact Me', 'Noted' -> 'Notes'
    expect(screen.getByRole('button', { name: 'Contact Me' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument();

    // Klik kembali tombol ID
    fireEvent.click(idBtn);
    expect(idBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Hubungi Saya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Noted' })).toBeInTheDocument();
  });

  it('merender tombol grid style switcher dan mengubah gaya latar belakang saat diklik', () => {
    mockIsAdmin = false;
    const data = createMockData(10);
    render(<InfiniteCanvasRenderer data={data} />);

    // Tombol grid style toggle
    const gridBtn = screen.getByRole('button', { name: /ganti gaya grid/i });
    expect(gridBtn).toBeInTheDocument();
    expect(gridBtn).toHaveTextContent('DOTS');

    // Klik 1x: beralih ke GRID (Blueprint lines)
    fireEvent.click(gridBtn);
    expect(gridBtn).toHaveTextContent('GRID');

    // Klik 2x: beralih ke BLANK (Polos)
    fireEvent.click(gridBtn);
    expect(gridBtn).toHaveTextContent('BLANK');

    // Klik 3x: kembali ke DOTS
    fireEvent.click(gridBtn);
    expect(gridBtn).toHaveTextContent('DOTS');
  });
});

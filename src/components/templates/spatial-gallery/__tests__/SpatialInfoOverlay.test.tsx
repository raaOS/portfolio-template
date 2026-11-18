import React from 'react';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SpatialInfoOverlay } from '../SpatialInfoOverlay';
import type { PortfolioTemplateData } from '@/types/template';

function render(ui: React.ReactElement) {
  return rtlRender(<LanguageProvider>{ui}</LanguageProvider>);
}

// Mock chat macOS (FullPageChat) — cukup verifikasi disematkan + mapping email kontak
vi.mock('@/components/chat/FullPageChat', () => ({
  default: ({ contactInfo }: { contactInfo?: { email?: string } }) => (
    <div data-testid="full-page-chat">Chat: {contactInfo?.email ?? ''}</div>
  ),
}));

function createMockData(): PortfolioTemplateData {
  return {
    site: {
      id: 'default-site',
      slug: 'default-site',
      title: 'Studio Kreatif',
      description: 'Portofolio spatial 3D',
      activeTemplateKey: 'spatial-gallery',
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
      softSkills: {
        items: [
          {
            text: 'Komunikasi',
            description: 'Menjelaskan ide dengan jelas.',
          },
        ],
      },
      lastUpdated: '2026-01-01T00:00:00.000Z',
    },
    projects: [],
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

describe('SpatialInfoOverlay', () => {
  it('merender tab bar mini dengan 5 tombol konten + language switch', () => {
    const data = createMockData();
    render(<SpatialInfoOverlay data={data} />);

    expect(screen.getByTestId('spatial-info-tabbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentang Saya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hubungi Saya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Testimoni' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keahlian' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Riwayat Karir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ID' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });

  it('tab About menampilkan profil, availability, dan bio', () => {
    const data = createMockData();
    render(<SpatialInfoOverlay data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tentang Saya' }));

    expect(screen.getByText('Studio Kreatif')).toBeInTheDocument();
    expect(screen.getByText('Tersedia untuk proyek baru')).toBeInTheDocument();
    expect(
      screen.getByText('Desainer dan engineer yang berfokus pada web modern.')
    ).toBeInTheDocument();
  });

  it('Escape menutup panel yang terbuka', async () => {
    const data = createMockData();
    render(<SpatialInfoOverlay data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tentang Saya' }));
    expect(screen.getByRole('dialog', { name: 'Tentang Saya' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    // Tunggu animasi exit AnimatePresence selesai sebelum panel hilang dari DOM
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('tab Kontak menampilkan info kontak + chat macOS dengan email ter-mapping', () => {
    const data = createMockData();
    render(<SpatialInfoOverlay data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hubungi Saya' }));

    expect(screen.getByText('halo@studiokreatif.com')).toBeInTheDocument();
    expect(screen.getByText('+628123456789')).toBeInTheDocument();
    expect(screen.getByText('Jakarta, Indonesia')).toBeInTheDocument();
    expect(screen.getByText(/instagram/i)).toBeInTheDocument();

    // Jalur pesan visitor = chat macOS (POST /api/chat/send → sistem chat admin)
    const chat = screen.getByTestId('spatial-info-chat');
    expect(chat).toBeInTheDocument();
    expect(screen.getByTestId('full-page-chat')).toHaveTextContent(
      'Chat: halo@studiokreatif.com'
    );
  });

  it('tab Testimoni menampilkan daftar testimoni klien', () => {
    const data = createMockData();
    render(<SpatialInfoOverlay data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Testimoni' }));

    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText(/hasil kerja sangat profesional/i)).toBeInTheDocument();
  });

  it('tab Skills menampilkan hard skills + soft skills', () => {
    const data = createMockData();
    render(<SpatialInfoOverlay data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Keahlian' }));

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Komunikasi')).toBeInTheDocument();
    expect(screen.getByText('Menjelaskan ide dengan jelas.')).toBeInTheDocument();
    expect(screen.getByText(/keahlian teknis/i)).toBeInTheDocument();
    expect(screen.getByText(/keahlian interpersonal/i)).toBeInTheDocument();
  });

  it('tab CV menampilkan riwayat pengalaman kerja', () => {
    const data = createMockData();
    render(<SpatialInfoOverlay data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'Riwayat Karir' }));

    expect(screen.getByText('Lead Designer')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Memimpin tim desain produk.')).toBeInTheDocument();
  });

  // Urutan terakhir: test ini mengubah locale ke EN (persist di localStorage test env)
  it('language switch EN mengubah label tab ke bahasa Inggris', () => {
    const data = createMockData();
    render(<SpatialInfoOverlay data={data} />);

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    expect(screen.getByRole('button', { name: 'About Me' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contact Me' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Testimonials' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Curriculum Vitae' })).toBeInTheDocument();
  });
});

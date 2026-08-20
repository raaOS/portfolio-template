import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { PortfolioTemplateData } from '@/types/template';
import { DEFAULT_BENTO_SETTINGS } from '@/lib/templates/bento/settings';
import { BentoStudioEditor } from './BentoStudioEditor';

vi.mock('@/hooks/useCsrfToken', () => ({
  useCsrfToken: () => 'csrf-test-token',
}));

const fetchMock = vi.fn();

const baseTemplateData: PortfolioTemplateData = {
  site: {
    id: 'site-pro-1',
    slug: 'pro-client',
    title: 'Pro Client',
    tier: 'pro',
    activeTemplateKey: 'landing-bento',
  },
  about: {
    hero: { title: 'Senior Product Designer', backgroundTrail: [] },
    professional: {
      motto: { badge: 'Motto', quote: 'Design first' },
      bio: { content: 'Building human-centered UIs.' },
    },
    softSkills: { items: [] },
    lastUpdated: '2026-01-01',
  },
  projects: [],
  experiences: [],
  events: [],
  hardSkills: [],
  contact: {
    info: { email: 'designer@example.com', phone: '', address: '', socialMedia: {} },
    formSettings: {
      enabled: true,
      fields: {
        name: { required: true, label: 'Name' },
        email: { required: true, label: 'Email' },
        phone: { required: false, label: 'Phone' },
        company: { required: false, label: 'Company' },
        subject: { required: false, label: 'Subject' },
        message: { required: true, label: 'Message' },
      },
      submitButtonText: 'Send',
      successMessage: 'Sent',
      errorMessage: 'Failed',
    },
    lastUpdated: '2026-01-01',
  },
  testimonials: [],
  lastUpdated: '2026-01-01',
};

function renderEditor({
  isPro = true,
  settings,
}: { isPro?: boolean; settings?: Record<string, unknown> } = {}) {
  const templateData: PortfolioTemplateData = settings
    ? { ...baseTemplateData, settings: { templateId: 'landing-bento', options: settings } }
    : baseTemplateData;

  return render(
    <BentoStudioEditor
      siteId="site-pro-1"
      siteSlug="pro-client"
      siteName="Pro Client"
      isPro={isPro}
      templateData={templateData}
    />
  );
}

describe('BentoStudioEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('renders a locked screen for lite plan', () => {
    renderEditor({ isPro: false });
    expect(screen.getByText('Kembali ke Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Bento Studio')).toBeInTheDocument();
    expect(screen.queryByText(/Publish/)).not.toBeInTheDocument();
  });

  it('renders the live preview and all sections in the panel', () => {
    renderEditor();

    expect(screen.getByText('Bento Studio')).toBeInTheDocument();
    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(screen.getByText('360° Sequence')).toBeInTheDocument();
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getByText('Experience & Skills')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('hides a section in the preview when toggled off', () => {
    renderEditor();

    const heroCard = screen.getByTestId('studio-section-hero');
    const eyeButton = heroCard.querySelector('button[title="Sembunyikan"]') as HTMLButtonElement;
    fireEvent.click(eyeButton);

    expect(screen.getByText('Hero')).toBeInTheDocument();
    // Preview testid section hero tidak dirender lagi
    expect(screen.queryByTestId('bento-section-hero-default')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bento-section-hero-compact')).not.toBeInTheDocument();
  });

  it('publishes draft settings via PUT with CSRF header on Publish', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, settings: DEFAULT_BENTO_SETTINGS }),
    });

    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));

    await waitFor(() => {
      expect(screen.getByText(/Tersimpan & dipublikasikan/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/client/template-settings',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'csrf-test-token',
        }),
      })
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.settings).toEqual(DEFAULT_BENTO_SETTINGS);
  });

  it('shows error message when publish fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Kustomisasi template hanya tersedia untuk paket Pro.' }),
    });

    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));

    await waitFor(() => {
      expect(screen.getByText(/hanya tersedia untuk paket Pro/i)).toBeInTheDocument();
    });
  });
});
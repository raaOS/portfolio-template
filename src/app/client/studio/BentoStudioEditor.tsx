'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Settings2,
  LayoutGrid,
  Layers,
  Palette,
  Play,
} from 'lucide-react';
import type { PortfolioTemplateData } from '@/types/template';
import {
  BENTO_ANIMATION_PRESETS,
  BENTO_SECTION_VARIANTS,
  BENTO_TEMPLATE_ID,
  normalizeBentoSettings,
  type BentoTemplateSettings,
  type BentoSectionType,
} from '@/lib/templates/bento/settings';
import {
  ACCENT_COLORS,
  FONT_PRESETS,
  BACKGROUND_PRESETS,
} from '@/components/templates/demo/DemoThemeWrapper';
import { useCsrfToken } from '@/hooks/useCsrfToken';
import BentoRenderer from '@/components/templates/landing-bento/BentoRenderer';

const SECTION_LABELS: Record<BentoSectionType, string> = {
  hero: 'Hero',
  sequence: '360° Sequence',
  projects: 'Projects',
  experience: 'Experience & Skills',
  contact: 'Contact',
};

const BACKGROUND_OPTIONS = [
  { id: 'light', label: 'Terang (Paper Light)' },
  ...BACKGROUND_PRESETS.map((bg) => ({ id: bg.id, label: bg.name })),
];

interface BentoStudioEditorProps {
  siteId: string;
  siteSlug: string;
  siteName: string;
  isPro: boolean;
  templateData: PortfolioTemplateData;
}

export function BentoStudioEditor({
  siteSlug,
  siteName,
  isPro,
  templateData,
}: BentoStudioEditorProps) {
  const csrfToken = useCsrfToken();
  const [draft, setDraft] = useState<BentoTemplateSettings>(() =>
    normalizeBentoSettings(templateData.settings?.options)
  );
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'saved' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState('');

  const previewData: PortfolioTemplateData = useMemo(
    () => ({
      ...templateData,
      settings: { templateId: BENTO_TEMPLATE_ID, options: draft },
    }),
    [templateData, draft]
  );

  if (!isPro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-100 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-900 text-white shadow-lg">
          <LayoutGrid className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-zinc-900">Bento Studio</h1>
          <p className="mt-2 max-w-md text-sm text-zinc-600">
            Kustomisasi per-section untuk template <strong>Landing Bento</strong> hanya tersedia
            untuk paket <strong>Pro</strong>.
          </p>
        </div>
        <Link
          href="/client/dashboard"
          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-600"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const updateTheme = (patch: Partial<BentoTemplateSettings['theme']>) => {
    setDraft((prev) => ({ ...prev, theme: { ...prev.theme, ...patch } }));
  };

  const updateMotion = (patch: Partial<BentoTemplateSettings['motion']>) => {
    setDraft((prev) => ({ ...prev, motion: { ...prev.motion, ...patch } }));
  };

  const updateSection = (
    id: string,
    patch: Partial<BentoTemplateSettings['sections'][number]>
  ) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const sections = [...prev.sections];
      const target = index + direction;
      if (target < 0 || target >= sections.length) return prev;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return {
        ...prev,
        sections: sections.map((s, i) => ({ ...s, order: i })),
      };
    });
  };

  const publish = async () => {
    setPublishState('publishing');
    setErrorMessage('');
    try {
      const response = await fetch('/api/client/template-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify({ settings: draft }),
      });
      const body = await response.json();
      if (!response.ok) {
        setPublishState('error');
        setErrorMessage(body?.error || 'Gagal menyimpan pengaturan.');
        return;
      }
      setDraft(normalizeBentoSettings(body?.settings));
      setPublishState('saved');
    } catch {
      setPublishState('error');
      setErrorMessage('Terjadi kesalahan jaringan. Coba lagi.');
    }
  };

  const orderedSections = [...draft.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-100 text-zinc-900">
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/client/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-sm font-extrabold leading-tight">Bento Studio</h1>
              <p className="text-[11px] font-mono text-zinc-500">
                {siteName} · /{siteSlug} · Landing Bento
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {publishState === 'saved' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              Tersimpan & dipublikasikan
            </span>
          )}
          {publishState === 'error' && (
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700">
              {errorMessage}
            </span>
          )}
          <a
            href={`/${siteSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            <Eye className="h-4 w-4" />
            Lihat Site
          </a>
          <button
            type="button"
            onClick={publish}
            disabled={publishState === 'publishing'}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishState === 'publishing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {publishState === 'publishing' ? 'Menyimpan…' : 'Publish'}
          </button>
        </div>
      </header>

      {/* ── Body: Preview + Panel ───────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Live Preview Canvas */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-200/70">
          <BentoRenderer data={previewData} isPreview />
        </main>

        {/* Control Panel */}
        <aside className="w-80 shrink-0 space-y-6 overflow-y-auto border-l border-zinc-200 bg-white p-5">
          {/* Theme */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-zinc-500" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-700">Theme</h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold text-zinc-500">Warna Aksen</p>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      title={color.name}
                      onClick={() => updateTheme({ accent: color.id })}
                      className={`h-8 w-8 rounded-full border-2 transition ${
                        draft.theme.accent === color.id
                          ? 'border-zinc-900 ring-2 ring-zinc-300'
                          : 'border-zinc-200 hover:border-zinc-400'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold text-zinc-500">Font</p>
                <div className="flex flex-wrap gap-2">
                  {FONT_PRESETS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => updateTheme({ font: font.id })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        draft.theme.font === font.id
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                      }`}
                      style={{ fontFamily: font.family }}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold text-zinc-500">Background</p>
                <select
                  value={draft.theme.background}
                  onChange={(e) => updateTheme({ background: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:border-zinc-400 focus:outline-none"
                >
                  {BACKGROUND_OPTIONS.map((bg) => (
                    <option key={bg.id} value={bg.id}>
                      {bg.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Motion */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Play className="h-4 w-4 text-zinc-500" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-700">Motion</h2>
            </div>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
                <span className="text-xs font-semibold text-zinc-700">Stagger antar child</span>
                <input
                  type="checkbox"
                  checked={draft.motion.stagger}
                  onChange={(e) => updateMotion({ stagger: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5">
                <span className="text-xs font-semibold text-zinc-700">Parallax ringan</span>
                <input
                  type="checkbox"
                  checked={draft.motion.parallax}
                  onChange={(e) => updateMotion({ parallax: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
            </div>
          </section>

          {/* Sections */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-zinc-500" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-700">
                Sections ({orderedSections.length})
              </h2>
            </div>

            <div className="space-y-3">
              {orderedSections.map((section, index) => (
                <div
                  key={section.id}
                  data-testid={`studio-section-${section.id}`}
                  className={`rounded-xl border p-3 transition ${
                    section.visible ? 'border-zinc-200 bg-white' : 'border-zinc-200 bg-zinc-50 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Settings2 className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="text-xs font-extrabold text-zinc-800">
                        {SECTION_LABELS[section.type]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Naik"
                        disabled={index === 0}
                        onClick={() => moveSection(index, -1)}
                        className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Turun"
                        disabled={index === orderedSections.length - 1}
                        onClick={() => moveSection(index, 1)}
                        className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title={section.visible ? 'Sembunyikan' : 'Tampilkan'}
                        onClick={() => updateSection(section.id, { visible: !section.visible })}
                        className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100"
                      >
                        {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <select
                      value={section.variant}
                      onChange={(e) => updateSection(section.id, { variant: e.target.value })}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-zinc-700 focus:border-zinc-400 focus:outline-none"
                    >
                      {BENTO_SECTION_VARIANTS[section.type].map((variant) => (
                        <option key={variant} value={variant}>
                          {variant.charAt(0).toUpperCase() + variant.slice(1)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={section.animation}
                      onChange={(e) =>
                        updateSection(section.id, {
                          animation: e.target.value as BentoTemplateSettings['sections'][number]['animation'],
                        })
                      }
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-zinc-700 focus:border-zinc-400 focus:outline-none"
                    >
                      {BENTO_ANIMATION_PRESETS.map((animation) => (
                        <option key={animation} value={animation}>
                          {animation.charAt(0).toUpperCase() + animation.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
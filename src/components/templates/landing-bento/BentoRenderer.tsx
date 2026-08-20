'use client';

import React from 'react';
import type { TemplateRendererProps } from '@/types/template';
import { normalizeBentoSettings } from '@/lib/templates/bento/settings';
import { resolveBentoTokens } from './bentoTheme';
import { BentoHeader } from './components/BentoHeader';
import { BentoSectionRenderer } from './BentoSectionRegistry';

/**
 * Renderer config-driven untuk template `landing-bento`.
 * Section yang dirender ditentukan oleh settings (`data.settings?.options`):
 * urutan, visibilitas, variant, dan theme diterapkan dari sana.
 * Default settings dijamin selalu ada lewat `normalizeBentoSettings`.
 */
export default function BentoRenderer({ data }: TemplateRendererProps) {
  const settings = normalizeBentoSettings(data.settings?.options);
  const themeVars = resolveBentoTokens(settings.theme);
  const sections = settings.sections.filter((s) => s.visible);

  return (
    <div
      className="min-h-screen w-full text-zinc-900 font-sans antialiased selection:bg-[var(--bento-accent)] selection:text-white"
      style={themeVars}
    >
      <BentoHeader data={data} />

      <main className="mx-auto max-w-6xl space-y-10 px-4 sm:px-6 py-8">
        {sections.map((section) => (
          <div key={section.id} data-testid={`bento-section-${section.type}-${section.variant}`}>
            <BentoSectionRenderer section={section} motion={settings.motion} data={data} />
          </div>
        ))}
      </main>

      <footer className="w-full border-t border-zinc-200 py-8 text-center text-xs text-zinc-400 font-medium">
        © {new Date().getFullYear()} {data.site.title}. Powered by Portfolio OS Multi-Template.
      </footer>
    </div>
  );
}
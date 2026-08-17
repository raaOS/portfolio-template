'use client';

import React from 'react';
import type { PortfolioTemplateData } from '@/types/template';
import { ArrowUpRight } from 'lucide-react';

export function BentoHeader({ data }: { data: PortfolioTemplateData }) {
  const { site, about } = data;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3">
          {site.avatarUrl ? (
            <img
              src={site.avatarUrl}
              alt={site.title}
              className="h-9 w-9 rounded-full object-cover border border-zinc-200 shadow-xs"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 font-extrabold text-white text-sm shadow-xs">
              {site.title.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-sm font-extrabold text-zinc-900 tracking-tight">{site.title}</h1>
            <p className="text-[11px] font-mono text-emerald-600 font-semibold">{about.hero.title || 'Portfolio'}</p>
          </div>
        </div>

        <a
          href="#contact"
          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-900 hover:bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-xs"
        >
          <span>Kontak</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </header>
  );
}

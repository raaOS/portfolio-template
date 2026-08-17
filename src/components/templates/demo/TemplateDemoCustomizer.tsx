'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import {
  ACCENT_COLORS,
  BACKGROUND_PRESETS,
  FONT_PRESETS,
  useDemoTheme,
} from './DemoThemeWrapper';

interface TemplateDemoCustomizerProps {
  templateName: string;
  templateId: string;
  tierRequired: 'lite' | 'pro';
}

export function TemplateDemoCustomizer({
  templateName,
  templateId,
  tierRequired,
}: TemplateDemoCustomizerProps) {
  const { accent, setAccent, font, setFont, background, setBackground } = useDemoTheme();
  const [isOpen, setIsOpen] = useState(false);

  const checkoutUrl = `/checkout?plan=${tierRequired}&template=${templateId}&accent=${accent.id}`;

  return (
    <>
      {/*
        Positioned at bottom-20 right-6 so it NEVER overlaps:
        1. Top macOS Menubar (top-0 h-8)
        2. Bottom OS Dock (bottom-2 center)
      */}
      <div className="fixed bottom-20 right-6 z-[99999] flex flex-col items-end gap-3">
        {/* Floating Customizer Drawer (Opens Upwards) */}
        {isOpen && (
          <div className="w-80 rounded-2xl border border-white/20 bg-[#0d0f15]/95 p-4 text-white shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Palette className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs font-bold">Kustomisasi Preview Live</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 1. Accent Color Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <span>Warna Aksen</span>
                <span className="font-mono text-xs text-white" style={{ color: accent.hex }}>
                  {accent.name}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAccent(c)}
                    className={`group relative flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                      accent.id === c.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {accent.id === c.id && <Check className="h-4 w-4 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Font Selector */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <Type className="h-3.5 w-3.5 text-indigo-400" />
                <span>Gaya Tipografi</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {FONT_PRESETS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFont(f)}
                    className={`rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all ${
                      font.id === f.id
                        ? 'border-indigo-500 bg-indigo-500/20 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                    style={{ fontFamily: f.family }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Background Preset */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Preset Latar
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {BACKGROUND_PRESETS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setBackground(bg)}
                    className={`rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all ${
                      background.id === bg.id
                        ? 'border-indigo-500 bg-indigo-500/20 text-white font-semibold shadow-sm'
                        : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {bg.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Checkout CTA */}
            <div className="border-t border-white/10 pt-3">
              <Link
                href={checkoutUrl}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-2.5 text-xs font-bold text-slate-950 shadow-lg hover:from-emerald-400 hover:to-teal-300 transition active:scale-95"
              >
                <Sparkles className="h-4 w-4 text-slate-950" />
                <span>Pilih Template Ini</span>
              </Link>
            </div>
          </div>
        )}

        {/* Compact Non-Intrusive Floating Widget Toolbar */}
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-[#0d0f15]/90 px-3.5 py-2 text-white shadow-2xl backdrop-blur-xl transition-all hover:border-white/30 hover:bg-[#0d0f15]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-semibold text-zinc-300 hidden md:inline">
              Demo: <span className="font-bold text-white">{templateName}</span>
            </span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          {/* Theme Customizer Trigger Toggle */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              isOpen
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/10 text-zinc-300 hover:bg-white/20 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
            <span>Tema & Warna</span>
          </button>

          <div className="h-4 w-px bg-white/20" />

          {/* Back to Catalog */}
          <Link
            href="/templates"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-white transition"
            title="Kembali ke Katalog Template"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Katalog</span>
          </Link>

          {/* Instant Checkout CTA */}
          <Link
            href={checkoutUrl}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition"
          >
            <Sparkles className="h-3.5 w-3.5 text-slate-950" />
            <span className="hidden sm:inline">Pilih Template</span>
          </Link>
        </div>
      </div>
    </>
  );
}

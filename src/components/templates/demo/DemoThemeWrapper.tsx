'use client';

import React, { createContext, useContext, useState } from 'react';

export type AccentColor = {
  id: string;
  name: string;
  hex: string;
  rgb: string;
  glow: string;
};

export const ACCENT_COLORS: AccentColor[] = [
  { id: 'emerald', name: 'Emerald', hex: '#10b981', rgb: '16 185 129', glow: 'rgba(16,185,129,0.3)' },
  { id: 'indigo', name: 'Indigo', hex: '#6366f1', rgb: '99 102 241', glow: 'rgba(99,102,241,0.3)' },
  { id: 'rose', name: 'Rose', hex: '#f43f5e', rgb: '244 63 94', glow: 'rgba(244,63,94,0.3)' },
  { id: 'amber', name: 'Amber', hex: '#f59e0b', rgb: '245 158 11', glow: 'rgba(245,158,11,0.3)' },
  { id: 'cyan', name: 'Cyan', hex: '#06b6d4', rgb: '6 182 212', glow: 'rgba(6,182,212,0.3)' },
  { id: 'violet', name: 'Violet', hex: '#8b5cf6', rgb: '139 92 246', glow: 'rgba(139,92,246,0.3)' },
];

export type FontPreset = {
  id: string;
  name: string;
  family: string;
};

export const FONT_PRESETS: FontPreset[] = [
  { id: 'sans', name: 'Inter (Clean)', family: 'var(--font-sans, system-ui, sans-serif)' },
  { id: 'outfit', name: 'Outfit (Modern)', family: 'Outfit, system-ui, sans-serif' },
  { id: 'serif', name: 'Playfair (Serif)', family: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', name: 'Fira Code (Tech)', family: 'ui-monospace, SFMono-Regular, monospace' },
];

export type BackgroundPreset = {
  id: string;
  name: string;
  css: string;
};

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'midnight', name: 'Midnight Dark', css: '#0a0b0e' },
  { id: 'cyber', name: 'Cyber Grid', css: 'radial-gradient(ellipse at top, #111827, #030712)' },
  { id: 'neon', name: 'Neon Glow', css: 'radial-gradient(circle at 50% 0%, #1e1b4b, #09090b)' },
  { id: 'paper', name: 'Retro Paper', css: '#18181b' },
];

interface DemoThemeContextType {
  accent: AccentColor;
  setAccent: (color: AccentColor) => void;
  font: FontPreset;
  setFont: (font: FontPreset) => void;
  background: BackgroundPreset;
  setBackground: (bg: BackgroundPreset) => void;
}

const DemoThemeContext = createContext<DemoThemeContextType | null>(null);

export function useDemoTheme() {
  const context = useContext(DemoThemeContext);
  if (!context) {
    throw new Error('useDemoTheme must be used within a DemoThemeWrapper');
  }
  return context;
}

interface DemoThemeWrapperProps {
  children: React.ReactNode;
}

export function DemoThemeWrapper({ children }: DemoThemeWrapperProps) {
  const [accent, setAccent] = useState<AccentColor>(ACCENT_COLORS[0]);
  const [font, setFont] = useState<FontPreset>(FONT_PRESETS[0]);
  const [background, setBackground] = useState<BackgroundPreset>(BACKGROUND_PRESETS[0]);

  return (
    <DemoThemeContext.Provider
      value={{
        accent,
        setAccent,
        font,
        setFont,
        background,
        setBackground,
      }}
    >
      <div
        className="h-full w-full transition-colors duration-300"
        style={{
          fontFamily: font.family,
          background: background.css,
          // CSS Variable overrides for theme elements
          ['--accent-primary' as string]: accent.hex,
          ['--accent-rgb' as string]: accent.rgb,
          ['--accent-glow' as string]: accent.glow,
        }}
      >
        {children}
      </div>
    </DemoThemeContext.Provider>
  );
}

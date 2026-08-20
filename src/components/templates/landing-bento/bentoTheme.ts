/**
 * Resolver token theme untuk renderer `landing-bento`.
 * Menerjemahkan token settings (accent/font/background) menjadi nilai CSS
 * yang diterapkan sebagai inline style + CSS variables di root renderer.
 * @module
 */

import {
  ACCENT_COLORS,
  FONT_PRESETS,
  BACKGROUND_PRESETS,
} from '@/components/templates/demo/DemoThemeWrapper';
import type { BentoTemplateSettings } from '@/lib/templates/bento/settings';

const LIGHT_BACKGROUND = '#fafafa';

export interface BentoThemeVars {
  fontFamily: string;
  background: string;
  '--bento-accent': string;
  '--bento-accent-rgb': string;
  '--bento-accent-glow': string;
  '--bento-bg': string;
  '--bento-font': string;
}

export function resolveBentoTokens(
  theme: BentoTemplateSettings['theme']
): BentoThemeVars {
  const accent = ACCENT_COLORS.find((c) => c.id === theme.accent) ?? ACCENT_COLORS[0];
  const font = FONT_PRESETS.find((f) => f.id === theme.font) ?? FONT_PRESETS[0];
  const background =
    theme.background === 'light'
      ? LIGHT_BACKGROUND
      : (BACKGROUND_PRESETS.find((b) => b.id === theme.background)?.css ?? LIGHT_BACKGROUND);

  return {
    fontFamily: font.family,
    background,
    '--bento-accent': accent.hex,
    '--bento-accent-rgb': accent.rgb,
    '--bento-accent-glow': accent.glow,
    '--bento-bg': background,
    '--bento-font': font.family,
  };
}
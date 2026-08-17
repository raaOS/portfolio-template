/**
 * Registry Terpusat Metadata Multi-Template
 * @module
 */

import type { TemplateMetadata } from '@/types/template';

export const SYSTEM_DEFAULT_TEMPLATE_ID = 'os-desktop';

export const BUILTIN_TEMPLATES: TemplateMetadata[] = [
  {
    id: 'os-desktop',
    name: 'macOS Desktop Simulator',
    description: 'Antarmuka desktop macOS interaktif lengkap dengan window management, dock, sound effects, spotlight, dan wallpaper dinamis.',
    category: 'os',
    tierRequired: 'lite',
    priceIdr: 0,
    isActive: true,
    features: [
      'Desktop windowing & focus management',
      'Interactive Dock dengan bounce physics & sound',
      'Dynamic Wallpapers & Audio Web API',
      'Integrated Chat & Contact Window',
    ],
  },
  {
    id: 'landing-bento',
    name: 'Modern Bento Landing',
    description: 'Tata letak Bento Grid modern yang sangat responsif, presisi, dan estetis untuk menampilkan karya & profil profesional.',
    category: 'landing',
    tierRequired: 'pro',
    priceIdr: 0,
    isActive: true,
    features: [
      'Bento Grid Responsive Auto-Layout',
      'Fast loading & Edge SEO Optimized',
      'Interactive Case Study Modal & Gallery',
      'Clean Typography & Glassmorphism UI',
    ],
  },
];


export function getBuiltinTemplate(id: string): TemplateMetadata | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

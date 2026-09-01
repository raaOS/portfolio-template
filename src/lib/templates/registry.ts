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

];


export function getBuiltinTemplate(id: string): TemplateMetadata | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

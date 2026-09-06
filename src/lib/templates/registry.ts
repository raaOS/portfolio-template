/**
 * Registry Terpusat Metadata Multi-Template
 * @module
 */

export const SYSTEM_DEFAULT_TEMPLATE_ID = 'os-desktop';

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
}

/**
 * Daftar semua template yang tersedia.
 * Tambahkan template baru di sini.
 */
export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'os-desktop',
    name: 'OS Desktop',
    description: 'Portfolio interaktif bergaya desktop macOS dengan window system, dock, dan efek visual.',
  },
  {
    id: 'infinite-canvas',
    name: 'Infinite Canvas',
    description: 'Infinite canvas dengan drag-to-explore dan zoom untuk melihat project.',
  },
];

/**
 * Cari metadata template berdasarkan ID.
 */
export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

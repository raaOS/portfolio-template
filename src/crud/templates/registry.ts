/**
 * Per-Template CRUD Registry
 * Setiap template register CRUD entities-nya sendiri.
 *
 * @module
 */
import type { TemplateCrudConfig } from './types';

/**
 * OS Desktop — full CRUD: about, projects, experience, skills, testimonial, contact
 */
export const osDesktopCrudConfig: TemplateCrudConfig = {
  templateId: 'os-desktop',
  entities: [
    {
      id: 'about',
      label: 'Profil & About',
      description: 'Kelola info profil, bio, headline, dan avatar.',
      apiPath: '/api/templates/os-desktop/about',
      adminPath: '/admin/content/profile',
      fields: [
        { key: 'hero.name', label: 'Nama', type: 'text', required: true },
        { key: 'hero.title', label: 'Title / Jabatan', type: 'text' },
        { key: 'hero.headline', label: 'Headline', type: 'textarea' },
        { key: 'hero.description', label: 'Deskripsi', type: 'textarea' },
        { key: 'professional.bio', label: 'Bio Lengkap', type: 'textarea' },
      ],
    },
    {
      id: 'projects',
      label: 'Projects',
      description: 'Kelola daftar project portfolio.',
      apiPath: '/api/templates/os-desktop/projects',
      adminPath: '/admin/projects',
      fields: [
        { key: 'title', label: 'Judul', type: 'text', required: true },
        { key: 'description', label: 'Deskripsi', type: 'textarea' },
        { key: 'cover_url', label: 'Cover Image', type: 'image' },
        { key: 'gallery', label: 'Gallery', type: 'array' },
        { key: 'tags', label: 'Tags', type: 'array' },
        { key: 'year', label: 'Tahun', type: 'text' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'category', label: 'Kategori', type: 'text' },
        { key: 'featured', label: 'Featured', type: 'boolean' },
        { key: 'status', label: 'Status', type: 'text' },
      ],
    },
    {
      id: 'experience',
      label: 'Pengalaman Kerja',
      description: 'Kelola riwayat pengalaman kerja.',
      apiPath: '/api/templates/os-desktop/experience',
      adminPath: '/admin/content/experience',
      fields: [
        { key: 'company', label: 'Perusahaan', type: 'text', required: true },
        { key: 'position', label: 'Posisi', type: 'text', required: true },
        { key: 'period', label: 'Periode', type: 'text' },
        { key: 'description', label: 'Deskripsi', type: 'textarea' },
      ],
    },
    {
      id: 'skills',
      label: 'Hard Skills',
      description: 'Kelola keahlian teknis.',
      apiPath: '/api/templates/os-desktop/skills',
      adminPath: '/admin/content/skills',
      fields: [
        { key: 'name', label: 'Nama Skill', type: 'text', required: true },
        { key: 'level', label: 'Level (0-100)', type: 'number' },
        { key: 'icon', label: 'Icon', type: 'text' },
        { key: 'description', label: 'Deskripsi', type: 'textarea' },
      ],
    },
    {
      id: 'testimonial',
      label: 'Testimoni',
      description: 'Kelola testimoni klien.',
      apiPath: '/api/templates/os-desktop/testimonial',
      adminPath: '/admin/communications/feedback',
      fields: [
        { key: 'name', label: 'Nama Klien', type: 'text', required: true },
        { key: 'company', label: 'Perusahaan', type: 'text' },
        { key: 'content', label: 'Isi Testimoni', type: 'textarea', required: true },
        { key: 'rating', label: 'Rating (1-5)', type: 'number' },
      ],
    },
    {
      id: 'contact',
      label: 'Kontak',
      description: 'Kelola info kontak.',
      apiPath: '/api/templates/os-desktop/contact',
      adminPath: '/admin/communications/contacts',
      fields: [
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'phone', label: 'Telepon', type: 'text' },
        { key: 'location', label: 'Lokasi', type: 'text' },
        { key: 'socialLinks', label: 'Social Links', type: 'object' },
      ],
    },
  ],
};

/**
 * Infinite Canvas — minimal CRUD: about, projects only
 */
export const infiniteCanvasCrudConfig: TemplateCrudConfig = {
  templateId: 'infinite-canvas',
  entities: [
    {
      id: 'about',
      label: 'Profil & About',
      description: 'Kelola info profil, bio, headline, dan avatar.',
      apiPath: '/api/templates/infinite-canvas/about',
      adminPath: '/admin/content/profile',
      fields: [
        { key: 'hero.name', label: 'Nama', type: 'text', required: true },
        { key: 'hero.title', label: 'Title / Jabatan', type: 'text' },
        { key: 'hero.headline', label: 'Headline', type: 'textarea' },
        { key: 'hero.description', label: 'Deskripsi', type: 'textarea' },
        { key: 'professional.bio', label: 'Bio Lengkap', type: 'textarea' },
      ],
    },
    {
      id: 'projects',
      label: 'Projects',
      description: 'Kelola daftar project portfolio.',
      apiPath: '/api/templates/infinite-canvas/projects',
      adminPath: '/admin/projects',
      fields: [
        { key: 'title', label: 'Judul', type: 'text', required: true },
        { key: 'description', label: 'Deskripsi', type: 'textarea' },
        { key: 'cover_url', label: 'Cover Image', type: 'image' },
        { key: 'tags', label: 'Tags', type: 'array' },
        { key: 'year', label: 'Tahun', type: 'text' },
        { key: 'featured', label: 'Featured', type: 'boolean' },
        { key: 'status', label: 'Status', type: 'text' },
      ],
    },
  ],
};

/** All registered CRUD configs */
export const TEMPLATE_CRUD_CONFIGS: Record<string, TemplateCrudConfig> = {
  'os-desktop': osDesktopCrudConfig,
  'infinite-canvas': infiniteCanvasCrudConfig,
};

/**
 * Get CRUD config for a template.
 */
export function getTemplateCrudConfig(templateId: string): TemplateCrudConfig | undefined {
  return TEMPLATE_CRUD_CONFIGS[templateId];
}

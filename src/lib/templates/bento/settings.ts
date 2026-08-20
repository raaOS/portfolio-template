/**
 * Kontrak Settings Template `landing-bento` (Bento Studio)
 *
 * Single source of truth untuk skema kustomisasi per-section template Bento.
 * Disimpan sebagai JSON di D1 `site_template_settings.settings_json`
 * di bawah wrapper `SiteTemplateSettings.options`.
 *
 * Aturan penting:
 * - Selalu baca lewat `normalizeBentoSettings()` agar config lama/parsial/rusak
 *   otomatis di-merge dengan defaults dan tidak pernah melempar error.
 * - Menambah field baru di masa depan WAJIB backward compatible
 *   (tambahkan default baru, jangan ubah makna field lama).
 * @module
 */

import { z } from 'zod';

export const BENTO_TEMPLATE_ID = 'landing-bento';
export const BENTO_SETTINGS_SCHEMA_VERSION = 1;

/** Preset animasi yang tersedia (implementasi visual ada di Sprint C). */
export const BENTO_ANIMATION_PRESETS = ['none', 'fade-up', 'slide-in', 'scale', 'stagger'] as const;
export type BentoAnimationPreset = (typeof BENTO_ANIMATION_PRESETS)[number];

/** Katalog section bawaan template Bento. */
export const BENTO_SECTION_TYPES = ['hero', 'sequence', 'projects', 'experience', 'contact'] as const;
export type BentoSectionType = (typeof BENTO_SECTION_TYPES)[number];

/** Dua variant per section untuk v1. */
export const BENTO_SECTION_VARIANTS: Record<BentoSectionType, readonly [string, string]> = {
  hero: ['default', 'compact'],
  sequence: ['full', 'minimal'],
  projects: ['grid', 'list'],
  experience: ['timeline', 'cards'],
  contact: ['split', 'centered'],
} as const;

/** Token id aman: huruf kecil/angka/dash, maks 32 char (anti CSS-injection). */
const idTokenSchema = z.string().regex(/^[a-z0-9-]{1,32}$/);

export const bentoSectionConfigSchema = z.object({
  id: idTokenSchema,
  type: z.enum(BENTO_SECTION_TYPES),
  order: z.number().int().min(0).max(99),
  visible: z.boolean(),
  variant: idTokenSchema,
  animation: z.enum(BENTO_ANIMATION_PRESETS),
});
export type BentoSectionConfig = z.infer<typeof bentoSectionConfigSchema>;

export const bentoSettingsSchema = z.object({
  schemaVersion: z.literal(BENTO_SETTINGS_SCHEMA_VERSION),
  theme: z.object({
    accent: idTokenSchema,
    font: idTokenSchema,
    background: idTokenSchema,
  }),
  motion: z.object({
    stagger: z.boolean(),
    parallax: z.boolean(),
  }),
  sections: z.array(bentoSectionConfigSchema).max(32),
});
export type BentoTemplateSettings = z.infer<typeof bentoSettingsSchema>;

/**
 * Skema input dari API (client boleh kirim parsial; sections selalu full array
 * karena editor selalu memegang state lengkap).
 */
export const bentoSettingsInputSchema = z.object({
  theme: bentoSettingsSchema.shape.theme.partial().optional(),
  motion: bentoSettingsSchema.shape.motion.partial().optional(),
  sections: z.array(bentoSectionConfigSchema).max(32).optional(),
});
export type BentoSettingsInput = z.infer<typeof bentoSettingsInputSchema>;

export const DEFAULT_BENTO_SETTINGS: BentoTemplateSettings = {
  schemaVersion: BENTO_SETTINGS_SCHEMA_VERSION,
  theme: {
    accent: 'emerald',
    font: 'sans',
    background: 'light',
  },
  motion: {
    stagger: true,
    parallax: false,
  },
  sections: [
    { id: 'hero', type: 'hero', order: 0, visible: true, variant: 'default', animation: 'fade-up' },
    { id: 'sequence', type: 'sequence', order: 1, visible: true, variant: 'full', animation: 'none' },
    { id: 'projects', type: 'projects', order: 2, visible: true, variant: 'grid', animation: 'fade-up' },
    { id: 'experience', type: 'experience', order: 3, visible: true, variant: 'timeline', animation: 'fade-up' },
    { id: 'contact', type: 'contact', order: 4, visible: true, variant: 'split', animation: 'fade-up' },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normalisasi settings mentah (dari D1 / input API) menjadi BentoTemplateSettings
 * yang dijamin valid & lengkap:
 * - theme/motion di-merge dengan defaults (parsial diterima)
 * - section dengan type/variant tidak dikenal dibuang (default-nya ditambahkan kembali)
 * - section bawaan yang hilang ditambahkan dengan nilai default
 * - duplikat id dibuang, hasil akhir diurutkan berdasarkan `order`
 */
export function normalizeBentoSettings(input: unknown): BentoTemplateSettings {
  const obj = isRecord(input) ? input : {};

  const themeParsed = bentoSettingsSchema.shape.theme.partial().safeParse(isRecord(obj.theme) ? obj.theme : {});
  const motionParsed = bentoSettingsSchema.shape.motion.partial().safeParse(isRecord(obj.motion) ? obj.motion : {});

  const theme = {
    ...DEFAULT_BENTO_SETTINGS.theme,
    ...(themeParsed.success ? themeParsed.data : {}),
  };
  const motion = {
    ...DEFAULT_BENTO_SETTINGS.motion,
    ...(motionParsed.success ? motionParsed.data : {}),
  };

  const rawSections = Array.isArray(obj.sections) ? obj.sections : [];
  const savedSections: BentoSectionConfig[] = [];
  const seenIds = new Set<string>();

  for (const raw of rawSections) {
    const parsed = bentoSectionConfigSchema.safeParse(raw);
    if (!parsed.success) continue;
    const section = parsed.data;
    if (seenIds.has(section.id)) continue;
    const variants = BENTO_SECTION_VARIANTS[section.type];
    if (!variants || !variants.includes(section.variant)) continue;
    seenIds.add(section.id);
    savedSections.push(section);
  }

  const merged = [...savedSections];
  for (const def of DEFAULT_BENTO_SETTINGS.sections) {
    if (!seenIds.has(def.id)) merged.push({ ...def });
  }
  merged.sort((a, b) => a.order - b.order);

  return {
    schemaVersion: BENTO_SETTINGS_SCHEMA_VERSION,
    theme,
    motion,
    sections: merged,
  };
}

/**
 * Admin CRUD Validation Schemas — Skema Zod untuk validasi operasi admin.
 *
 * Mencakup schema untuk about, experience, hard-skill, hard-skill-concept,
 * testimonial, wallpaper, dan entitas admin lainnya.
 *
 * @module validations/adminCrud
 */
import { z } from 'zod';

const shortText = (max: number) => z.string().trim().max(max);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const entityId = (max: number = 120) => z.coerce.string().trim().min(1).max(max);

export const chatHistoryMessageSchema = z.object({
  id: z.number().int(),
  text: z.string().max(5000),
  isMe: z.boolean(),
  time: shortText(100),
  type: z.enum(['text', 'image', 'project']).optional(),
  imageSrc: z.string().max(1000).optional(),
  projectId: z.string().max(200).optional(),
});

const testimonialBaseSchema = z.object({
  name: requiredText(120),
  notificationText: requiredText(280),
  isActive: z.boolean().optional(),
  messages: z.array(chatHistoryMessageSchema).max(100).optional(),
  projectId: z.string().trim().max(200).optional(),
  company: shortText(120).optional(),
  role: shortText(120).optional(),
  content: z.string().trim().max(5000).optional(),
});

export const createTestimonialSchema = testimonialBaseSchema;

export const updateTestimonialSchema = testimonialBaseSchema
  .partial()
  .extend({
    id: entityId(),
  })
  .refine(
    ({ id: _id, ...updates }) => Object.values(updates).some((value) => value !== undefined),
    'At least one testimonial field must be updated'
  );

export const deleteTestimonialSchema = z
  .object({
    id: entityId(),
  })
  .strict();

export const experienceStatisticsSchema = z.object({
  years: requiredText(50),
  projects: requiredText(50),
  designTools: requiredText(50),
  clientSatisfaction: requiredText(50),
});

export const workExperienceSchema = z.object({
  id: requiredText(120),
  year: requiredText(50),
  duration: requiredText(50),
  company: requiredText(120),
  position: requiredText(120),
  position_id: shortText(120).optional(),
  description: z.array(requiredText(500)).max(20),
  description_id: z.array(shortText(500)).max(20).optional(),
  imageUrl: z.string().trim().max(1000),
  isActive: z.boolean().optional(),
});

export const updateExperienceSchema = z
  .object({
    statistics: experienceStatisticsSchema.optional(),
    workExperience: z.array(workExperienceSchema).max(100).optional(),
  })
  .strict()
  .refine(
    (payload) => payload.statistics !== undefined || payload.workExperience !== undefined,
    'At least one experience field must be updated'
  );

const trailItemSchema = z
  .object({
    src: requiredText(1000),
    isActive: z.boolean(),
    slug: shortText(200).optional(),
  })
  .strict();

const aboutAvailabilitySchema = z
  .object({
    status: z.enum(['available', 'booked', 'limited']),
    text: requiredText(200),
    text_id: shortText(200).optional(),
  })
  .strict();

const aboutHeroSchema = z
  .object({
    title: requiredText(200),
    title_id: shortText(200).optional(),
    backgroundTrail: z.array(z.union([shortText(1000), trailItemSchema])).max(100),
    backgroundColor: shortText(50).optional(),
    textColor: shortText(50).optional(),
    ballColor: shortText(50).optional(),
    capColor: shortText(50).optional(),
    availability: aboutAvailabilitySchema.optional(),
  })
  .strict();

const aboutContactsSchema = z
  .object({
    email: shortText(200),
    whatsapp: shortText(50),
    linkedin: shortText(200),
  })
  .strict();

const aboutMottoSchema = z
  .object({
    badge: requiredText(200),
    badge_id: shortText(200).optional(),
    quote: requiredText(1000),
    quote_id: shortText(1000).optional(),
  })
  .strict();

const aboutBioSchema = z
  .object({
    content: requiredText(10000),
    content_id: shortText(10000).optional(),
  })
  .strict();

const aboutProfessionalSchema = z
  .object({
    contacts: aboutContactsSchema.optional(),
    motto: aboutMottoSchema,
    bio: aboutBioSchema,
  })
  .strict();

const softSkillItemSchema = z
  .object({
    text: requiredText(200),
    description: requiredText(1000),
    isDraft: z.boolean().optional(),
  })
  .strict();

const aboutSoftSkillsSchema = z
  .object({
    items: z.array(softSkillItemSchema).max(100).optional(),
    texts: z.array(shortText(200)).max(100).optional(),
    texts_id: z.array(shortText(200)).max(100).optional(),
    descriptions: z.array(shortText(1000)).max(100).optional(),
    descriptions_id: z.array(shortText(1000)).max(100).optional(),
  })
  .strict();

const workflowSubStepSchema = z
  .object({
    id: requiredText(120),
    title: requiredText(200),
    description: requiredText(1000),
    status: z.enum(['default', 'in-progress', 'completed', 'pending']).optional(),
  })
  .strict();

const workflowStepSchema = z
  .object({
    id: requiredText(120),
    number: requiredText(20),
    title: requiredText(200),
    subtitle: requiredText(200),
    description: requiredText(1000),
    type: z.enum(['phase', 'decision', 'terminator']),
    color: z.enum(['amber', 'blue', 'purple', 'rose', 'emerald']),
    icon: requiredText(120),
    subSteps: z.array(workflowSubStepSchema).max(50),
    nextSteps: z.array(shortText(120)).max(20),
    loopTargets: z.array(shortText(120)).max(20),
  })
  .strict();

const designPhilosophySchema = z
  .object({
    heading: requiredText(200),
    subheading: requiredText(1000),
    workflowSteps: z.array(workflowStepSchema).max(50),
  })
  .strict();

const desktopIconPositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    zIndex: z.number().optional(),
    size: z.enum(['small', 'medium', 'large']).optional(),
    // Percentage-based for responsive positioning (optional for backward compat)
    xPct: z.number().min(-100).max(200).optional(),
    yPct: z.number().min(-100).max(200).optional(),
    // Reference screen dimensions when admin saved
    refScreenWidth: z.number().positive().optional(),
    refScreenHeight: z.number().positive().optional(),
  })
  .strict();

const desktopPreferencesSchema = z
  .object({
    visibleProjectIds: z.array(shortText(200)).max(100),
    maxIcons: z.coerce.number().int().min(1).max(100),
    layout: z.enum(['grid', 'scattered']),
    iconPositions: z.record(z.string(), desktopIconPositionSchema).optional(),
  })
  .strict();

export const wallpaperSchema = z
  .object({
    id: requiredText(120),
    url: requiredText(1000),
    name: shortText(200).optional(),
    type: z.enum(['image', 'video']).optional(),
    posterUrl: shortText(1000).optional(),
    startTime: z.coerce.number().min(0).max(250).optional(),
  })
  .strict();

const wallpaperConfigSchema = z
  .object({
    // Boleh string kosong saat semua wallpaper dihapus — public site
    // akan fallback ke `DEFAULT_WALLPAPER_URL` ketika value kosong.
    // Tetap dibatasi `max(120)` untuk konsistensi storage.
    activeWallpaperId: z.string().trim().max(120),
    collection: z.array(wallpaperSchema).max(100),
    blur: z.coerce.number().min(0).max(20).optional(),
  })
  .strict();

const dockItemConfigSchema = z
  .object({
    label: shortText(120).optional(),
    iconUrl: z.string().trim().max(1000).optional(),
    isHidden: z.boolean().optional(),
    order: z.coerce.number().int().optional(),
  })
  .strict();

const windowPreferenceSchema = z
  .object({
    // Legacy pixel-based
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    zIndex: z.number().optional(),
    // Percentage-based for responsive positioning
    xPct: z.number().min(0).max(100).optional(),
    yPct: z.number().min(0).max(100).optional(),
    widthPct: z.number().min(0).max(100).optional(),
    heightPct: z.number().min(0).max(100).optional(),
    // Reference screen dimensions
    refScreenWidth: z.number().optional(),
    refScreenHeight: z.number().optional(),
    isOpenByDefault: z.boolean().optional(),
  })
  .strict();

const soundSettingSchema = z
  .object({
    path: requiredText(1000),
    volume: z.coerce.number().min(0).max(1),
  })
  .strict();

const islandChatMessageSchema = z
  .object({
    id: z.number().int(),
    text: requiredText(2000),
    isMe: z.boolean(),
    time: requiredText(100),
    status: z.enum(['sent', 'read']),
  })
  .strict();

const islandNotificationSchema = z
  .object({
    id: requiredText(120),
    name: requiredText(120),
    message: requiredText(1000),
    avatar: requiredText(1000),
    isActive: z.boolean(),
    conversation: z.array(islandChatMessageSchema).max(100),
    status: requiredText(120),
  })
  .strict();

const aboutLabelsSchema = z
  .object({
    experienceTitle: shortText(200).optional(),
    experienceSubtitle: shortText(200).optional(),
    freelanceTitle: shortText(200).optional(),
    workExperienceTitle: shortText(200).optional(),
    portfolioPreviewTitle: shortText(200).optional(),
  })
  .strict();

const spatialGalleryConfigSchema = z
  .object({
    centerModelUrl: shortText(1000).optional(),
    centerModelName: shortText(200).optional(),
    materialStyle: z.enum(['glass', 'original']).optional(),
    modelScale: z.coerce.number().min(0.1).max(10).optional(),
  })
  .strict();

const loaderConfigSchema = z
  .object({
    enabled: z.boolean(),
    style: z.enum(['deck-reveal', 'hello']),
    imageProjectIds: z.array(shortText(200)).max(10),
    durationMs: z.coerce.number().int().min(1000).max(10000).optional(),
    accentColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{3,8}$/, 'Harus berupa hex color valid')
      .optional(),
    showCounter: z.boolean().optional(),
  })
  .strict();

export const updateAboutSchema = z
  .object({
    hero: aboutHeroSchema.partial().optional(),
    professional: aboutProfessionalSchema.partial().optional(),
    softSkills: aboutSoftSkillsSchema.partial().optional(),
    designPhilosophy: designPhilosophySchema.partial().optional(),
    desktopPreferences: desktopPreferencesSchema.partial().optional(),
    wallpaperConfig: wallpaperConfigSchema.optional(),
    dockConfig: z.record(z.string(), dockItemConfigSchema).optional(),
    windowPreferences: z.record(z.string(), windowPreferenceSchema).optional(),
    islandNotifications: z.array(islandNotificationSchema).max(100).optional(),
    soundConfig: z.record(z.string(), soundSettingSchema).optional(),
    labels: aboutLabelsSchema.optional(),
    spatialGalleryConfig: spatialGalleryConfigSchema.optional(),
    loaderConfig: loaderConfigSchema.optional(),
  })
  .strict()
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    'At least one about field must be updated'
  );

export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
export type UpdateExperienceInput = z.infer<typeof updateExperienceSchema>;

export type UpdateAboutInput = z.infer<typeof updateAboutSchema>;

// ─────────────────────────────────────────────────────────────
// Hard Skills
// ─────────────────────────────────────────────────────────────

const hardSkillLevelSchema = z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']);

export const hardSkillSchema = z
  .object({
    id: requiredText(120),
    name: requiredText(120),
    iconUrl: requiredText(1000),
    level: hardSkillLevelSchema,
    order: z.coerce.number().int().min(0).max(10000),
    description: shortText(1000).optional(),
    description_id: shortText(1000).optional(),
    isActive: z.boolean().optional(),
    details: z.array(shortText(500)).max(50).optional(),
    createdAt: shortText(100),
    updatedAt: shortText(100),
  })
  .strict();

export const bulkUpdateHardSkillsSchema = z.array(hardSkillSchema).max(200);

export const updateHardSkillSchema = hardSkillSchema
  .partial()
  .omit({ id: true, createdAt: true })
  .strict()
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    'At least one hard skill field must be updated'
  );

// ─────────────────────────────────────────────────────────────
// Hard Skill Concepts
// ─────────────────────────────────────────────────────────────

const hardSkillConceptBaseSchema = z.object({
  title: requiredText(200),
  description: requiredText(2000),
  iconUrl: shortText(1000).optional(),
  order: z.coerce.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

export const createHardSkillConceptSchema = hardSkillConceptBaseSchema.strict();

export const updateHardSkillConceptSchema = hardSkillConceptBaseSchema
  .partial()
  .strict()
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    'At least one concept field must be updated'
  );

// ─────────────────────────────────────────────────────────────
// Sticky Notes
// ─────────────────────────────────────────────────────────────

export const stickyNoteSchema = z
  .object({
    id: requiredText(120),
    text: z.string().max(5000),
    date: shortText(100),
    color: requiredText(20),
    isStarred: z.boolean(),
    isDeleted: z.boolean(),
    // Legacy pixel-based
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    // Percentage-based responsive
    xPct: z.number().min(-100).max(200).optional(),
    yPct: z.number().min(-100).max(200).optional(),
    widthPct: z.number().min(0).max(100).optional(),
    heightPct: z.number().min(0).max(100).optional(),
    refScreenWidth: z.number().optional(),
    refScreenHeight: z.number().optional(),
    isPinned: z.boolean().optional(),
    isCollapsed: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    zIndex: z.number().optional(),
    fontFamily: shortText(200).optional(),
    fontSize: z.number().min(6).max(96).optional(),
  })
  .strict();

export const stickyNotesBulkSchema = z.array(stickyNoteSchema).max(200);

// ─────────────────────────────────────────────────────────────
// Gallery Featured
// ─────────────────────────────────────────────────────────────

export const galleryFeaturedSchema = z
  .object({
    featuredProjectIds: z.array(shortText(200).min(1)).max(100),
  })
  .strict();

// ─────────────────────────────────────────────────────────────
// About — Design Philosophy (sub-resource)
// ─────────────────────────────────────────────────────────────

export const updateDesignPhilosophySchema = z
  .object({
    heading: requiredText(200),
    subheading: requiredText(1000),
    workflowSteps: z.array(workflowStepSchema).max(50),
  })
  .strict();

export type HardSkillInput = z.infer<typeof hardSkillSchema>;
export type UpdateHardSkillInput = z.infer<typeof updateHardSkillSchema>;
export type StickyNoteInput = z.infer<typeof stickyNoteSchema>;
export type UpdateDesignPhilosophyInput = z.infer<typeof updateDesignPhilosophySchema>;

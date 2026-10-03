import { z } from 'zod';
import { CreateProjectSchema, UpdateProjectSchema } from './project';

/**
 * Comprehensive Zod Validation Schemas
 * Prevents injection attacks, validates data types, and enforces business rules
 */

// Helper: Limit nested object depth (reserved for future use)
// const MAX_DEPTH = 5;

// Project Schemas
export const projectTechnologySchema = z
  .string()
  .min(1, 'Technology name cannot be empty')
  .max(50, 'Technology name too long (max 50 characters)')
  .trim();

export const projectGalleryItemSchema = z
  .object({
    kind: z.enum(['image', 'video']),
    src: z.string().url('Invalid URL format').max(500, 'URL too long'),
    alt: z.string().max(200).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
    poster: z.string().url().max(500).optional(),
  })
  .strict();

export const projectComparisonSchema = z
  .object({
    beforeImage: z.string().max(500, 'Image URL too long'),
    afterImage: z.string().max(500, 'Image URL too long'),
    beforeLabel: z.string().max(100).optional(),
    afterLabel: z.string().max(100).optional(),
  })
  .strict();

export const createProjectSchema = CreateProjectSchema;

export const updateProjectSchema = UpdateProjectSchema;

// Comment Schemas
const MAX_COMMENT_DEPTH = 3;

const baseCommentSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(1000, 'Comment too long (max 1000 characters)').optional(),
  comment: z.string().max(1000, 'Comment too long').optional(),
  name: z.string().max(100, 'Name too long').optional(),
  author: z.string().max(100, 'Author name too long').optional(),
  time: z.string().optional(),
  createdAt: z.string().optional(),
  likes: z.number().int().min(0).optional(),
  likedByMe: z.boolean().optional(),
  avatar: z.string().max(500, 'Avatar URL too long').optional(),
});

type CommentType = z.infer<typeof baseCommentSchema> & {
  replies?: CommentType[];
};

export const commentSchema: z.ZodType<CommentType> = baseCommentSchema.extend({
  replies: z.lazy(() => z.array(commentSchema).max(50, 'Too many replies')).optional(),
}) as z.ZodType<CommentType>;

// Validate comment depth
export function validateCommentDepth(comment: CommentType, depth: number = 0): boolean {
  if (depth > MAX_COMMENT_DEPTH) {
    return false;
  }

  if (comment.replies && Array.isArray(comment.replies)) {
    return comment.replies.every((reply: CommentType) => validateCommentDepth(reply, depth + 1));
  }

  return true;
}

export const createCommentSchema = z
  .object({
    slug: z.string().min(1, 'Slug is required').max(200),
    comments: z.array(commentSchema).max(1000, 'Too many comments'),
    website_url: z.string().max(0, 'Honeypot triggered').optional(), // Honeypot field
  })
  .strict();

// Upload Schemas
export const uploadFileSchema = z.object({
  filename: z
    .string()
    .max(100, 'Filename too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename characters')
    .refine((name) => !name.startsWith('.'), 'Filename cannot start with dot')
    .refine((name) => !name.includes('..'), 'Path traversal not allowed')
    .optional(),

  folder: z.enum(['temp', 'comparisons', 'projects', 'wallpapers', 'icons-library']).optional(),
});

// Contact Schemas
export const updateContactSchema = z
  .object({
    content: z.record(z.string(), z.unknown()).optional(),
    info: z.record(z.string(), z.unknown()).optional(),
    formSettings: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// Settings Schemas
export const updateSettingsSchema = z
  .object({
    bannedWords: z.array(z.string().max(50)).max(1000).optional(),
    maintenanceMode: z.boolean().optional(),
    allowComments: z.boolean().optional(),
  })
  // SECURITY FIX (audit 2026-09-29): `.passthrough()` mewajibkan field
  // tak dikenal ikut tersimpan ke row `settings` (junk/overwrite tak terkontrol).
  // Hanya 3 key di atas yang disimpan.
  .strict();

// Admin Operation Schemas
export const compressFileSchema = z
  .object({
    filePath: z.string().min(1, 'File path is required'),
  })
  .strict();

export const deleteIconSchema = z
  .object({
    url: z.string().min(1, 'URL is required'),
  })
  .strict();

// Export type inference
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type CompressFileInput = z.infer<typeof compressFileSchema>;
export type DeleteIconInput = z.infer<typeof deleteIconSchema>;

// Exit-Intent Feedback Schema
// Visitor leaves a rating + optional message when they show intent to close the tab.
export const feedbackSubmissionSchema = z
  .object({
    // 1-5 bintang
    rating: z.number().int().min(1).max(5),
    // Pesan / saran / kritik singkat. Opsional, tapi kalau ada dibatasi panjang.
    message: z.string().max(500, 'Pesan terlalu panjang (max 500 karakter)').optional(),
    // Nama pengunjung — opsional untuk yang mau anonim.
    name: z.string().max(50, 'Nama terlalu panjang').optional(),
    // Konteks: page apa yang sedang dibuka saat feedback dikirim
    fromPath: z.string().max(200).optional(),
    // Client-generated stable ID (localStorage) — layer dedup tambahan di server
    clientId: z.string().min(8).max(64).optional(),
    // Device hint dari client: 'desktop' | 'tablet' | 'mobile'
    device: z.enum(['desktop', 'tablet', 'mobile']).optional(),
    // Timestamp (ms) saat form dibuka di client — untuk minimum-fill-time check
    formOpenedAt: z.number().int().positive().optional(),
    // Sumber feedback — sekarang cuma exit-intent, ke depan bisa guestbook dll
    source: z.enum(['exit-intent', 'guestbook', 'chat']).optional(),
    // Honeypot. Non-empty values must pass validation so the route can return
    // a silent success response instead of revealing bot detection.
    website_url: z.string().max(200, 'Honeypot value too long').optional(),
  })
  .strict();

export type FeedbackSubmissionInput = z.infer<typeof feedbackSubmissionSchema>;

// Status moderation untuk persistence — dipakai admin panel nanti
export type FeedbackStatus = 'pending' | 'approved' | 'hidden' | 'deleted';
export const feedbackStatusEnum = z.enum(['pending', 'approved', 'hidden', 'deleted']);

// Admin action untuk update status (akan dipakai admin panel)
export const feedbackModerationSchema = z
  .object({
    status: feedbackStatusEnum,
    isPublic: z.boolean().optional(),
  })
  .strict();

export type FeedbackModerationInput = z.infer<typeof feedbackModerationSchema>;

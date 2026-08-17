/**
 * Validation Schemas Barrel Export
 *
 * Centralized exports for all Zod validation schemas.
 * Usage: import { commentSchema, ProjectSchema } from '@/lib/validations';
 */

// Project-related validations
export {
  GalleryItemSchema,
  GalleryGroupSchema,
  NarrativeSchema,
  ComparisonSchema,
  ProjectSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  type Project,
} from './project';

// Comment and other validations from schemas.ts
export {
  projectTechnologySchema,
  projectGalleryItemSchema,
  projectComparisonSchema,
  createProjectSchema,
  updateProjectSchema,
  commentSchema,
  validateCommentDepth,
  createCommentSchema,
  uploadFileSchema,
  updateContactSchema,
  updateSettingsSchema,
  compressFileSchema,
  deleteIconSchema,
  feedbackSubmissionSchema,
  feedbackModerationSchema,
  feedbackStatusEnum,
  type CreateProjectInput,
  type UpdateProjectInput,
  type CreateCommentInput,
  type UploadFileInput,
  type CompressFileInput,
  type DeleteIconInput,
  type FeedbackSubmissionInput,
  type FeedbackModerationInput,
  type FeedbackStatus,
} from './schemas';

export {
  chatHistoryMessageSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
  deleteTestimonialSchema,
  experienceStatisticsSchema,
  workExperienceSchema,
  updateExperienceSchema,
  updateAboutSchema,
  hardSkillSchema,
  bulkUpdateHardSkillsSchema,
  updateHardSkillSchema,
  createHardSkillConceptSchema,
  updateHardSkillConceptSchema,
  stickyNoteSchema,
  stickyNotesBulkSchema,
  galleryFeaturedSchema,
  updateDesignPhilosophySchema,
  type CreateTestimonialInput,
  type UpdateTestimonialInput,
  type UpdateExperienceInput,
  type UpdateAboutInput,
  type HardSkillInput,
  type UpdateHardSkillInput,
  type StickyNoteInput,
  type UpdateDesignPhilosophyInput,
} from './adminCrud';

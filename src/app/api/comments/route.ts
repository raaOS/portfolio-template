import { NextRequest } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { db } from '@/lib/database';
import { validateCommentDepth } from '@/lib/validations';
import { success, badRequest, unauthorized, serverError, rateLimit } from '@/lib/api-response';
import { z } from 'zod';
import { sanitizeInput } from '@/lib/security/sanitization';
import { getBannedWords, findBannedWord } from '@/lib/services/bannedWordsService';
import { buildCommentPath, normalizeEngagementSiteId } from '@/lib/projectEngagement';

interface Comment {
  id: string;
  text?: string;
  comment?: string;
  author?: string;
  name?: string;
  time?: string;
  createdAt?: string;
  likes?: number;
  likedByMe?: boolean;
  replies?: Comment[];
}

const newCommentSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
  name: z.string().min(1).max(100),
  time: z.string().optional(),
  createdAt: z.string().optional(),
  likes: z.number().int().min(0).optional(),
});

const commentContextSchema = z.object({
  siteId: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(200),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (slug) {
      const context = commentContextSchema.safeParse({
        slug,
        siteId: searchParams.get('siteId') || undefined,
      });
      if (!context.success) return badRequest('Invalid comment context');
      const snap = await db.ref(buildCommentPath(context.data.siteId, context.data.slug)).once('value');
      return success({ comments: snap.val() || [] });
    }

    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return unauthorized('Admin authentication required');
    }
    const allSnap = await db.ref('comments').once('value');
    return success({ comments: allSnap.val() || {} });
  } catch (error) {
    console.error('[API /comments GET] Error:', error);
    return serverError('Failed to load comments');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, website_url } = body;
    const context = commentContextSchema.safeParse({ slug, siteId: body.siteId });
    const incomingComment =
      body.comment ?? (Array.isArray(body.comments) ? body.comments[0] : undefined);

    // --- 1. HONEYPOT VALIDATION ---
    if (website_url) {
      console.warn(`[API /comments POST] Honeypot triggered for slug ${slug}`);
      return badRequest('Spam detected');
    }

    if (!context.success || !incomingComment) {
      return badRequest('Missing slug or comment');
    }
    const siteId = normalizeEngagementSiteId(context.data.siteId);

    // --- 2. VALIDATE COMMENT STRUCTURE WITH ZOD ---
    let commentToSave: Comment;
    try {
      const parsedComment = newCommentSchema.parse(incomingComment);
      commentToSave = {
        ...parsedComment,
        text: sanitizeInput(parsedComment.text),
        name: sanitizeInput(parsedComment.name),
        createdAt: parsedComment.createdAt || parsedComment.time || new Date().toISOString(),
        time: parsedComment.createdAt || parsedComment.time || new Date().toISOString(),
        likes: parsedComment.likes ?? 0,
        replies: [],
      };

      if (!validateCommentDepth(commentToSave)) {
        return badRequest('Comment nesting too deep (max 3 levels)');
      }
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return badRequest('Invalid comment structure', validationError.format());
      }
      throw validationError;
    }

    // --- 3. CONTENT MODERATION ---
    const bannedWords = await getBannedWords();
    const payloadString = JSON.stringify(commentToSave).toLowerCase();
    const foundBadWord = findBannedWord(payloadString, bannedWords);

    if (foundBadWord) {
      return badRequest(`Comment contains restricted word: ${foundBadWord}`);
    }

    // --- 4. ATOMIC APPEND + FLOOD CONTROL ---
    const commentsRef = db.ref(buildCommentPath(siteId, context.data.slug));
    let abortReason: 'flood' | null = null;

    const transactionResult = (await commentsRef.transaction((current: Comment[] | null) => {
      const existingComments = Array.isArray(current) ? current : [];

      // Scan ALL recent comments by this author (not just the first one)
      // to prevent a flood attacker from interleaving comments.
      const COOLDOWN_MS = 5000;
      for (const existing of existingComments.slice(0, 10)) {
        const isSameAuthor =
          existing.name === commentToSave.name || existing.author === commentToSave.name;

        if (isSameAuthor) {
          const lastTimeStr = existing.createdAt || existing.time;
          if (lastTimeStr) {
            const timeDiff = Date.now() - new Date(lastTimeStr).getTime();
            if (timeDiff < COOLDOWN_MS) {
              abortReason = 'flood';
              return;
            }
          }
        }
      }

      return [commentToSave, ...existingComments].slice(0, 1000);
    })) as { committed?: boolean };

    if (abortReason === 'flood' || transactionResult?.committed === false) {
      return rateLimit(5, 'Please wait 5 seconds before posting again');
    }

    return success({ comment: commentToSave });
  } catch (error) {
    console.error('[API /comments POST] Error:', error);
    return serverError('Failed to save comments');
  }
}

// Helper: Recursively remove comment/reply by ID
function removeCommentById(comments: Comment[], idToDelete: string): Comment[] {
  return (comments || [])
    .filter((c) => c.id !== idToDelete)
    .map((c) => ({
      ...c,
      replies: c.replies ? removeCommentById(c.replies, idToDelete) : [],
    }));
}

export async function DELETE(request: NextRequest) {
  if (!(await validateAdminRequest(request))) {
    return unauthorized('Admin authentication required');
  }

  try {
    const body = await request.json();
    const { slug, commentId } = body;
    const context = commentContextSchema.safeParse({ slug, siteId: body.siteId });

    if (!context.success || !commentId) {
      return badRequest('Missing slug or commentId');
    }

    const commentsRef = db.ref(buildCommentPath(context.data.siteId, context.data.slug));
    const snap = await commentsRef.once('value');
    const projectComments = snap.val() || [];
    const updatedComments = removeCommentById(projectComments, commentId);

    await commentsRef.set(updatedComments);

    return success({ comments: updatedComments });
  } catch (error) {
    console.error('[API /comments DELETE] Error:', error);
    return serverError('Failed to delete comment');
  }
}

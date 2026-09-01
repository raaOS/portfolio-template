import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { UpdateProjectData } from '@/types/projects';
import { projectSqlService } from '@/lib/services/project/projectSqlService';
import { generateGenZComments } from '@/lib/magic';
import { db } from '@/lib/database';
import { commentSchema, UpdateProjectSchema } from '@/lib/validations';
import {
  enforceProjectUpdateQuota,
  ProjectQuotaError,
  resolveProjectSiteId,
} from '@/lib/admin/projectSiteContext';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import { validateAdminRequest } from '@/lib/auth';
import { revalidateSiteProjectPaths } from '@/lib/admin/siteRequestContext';
import { buildCommentPath } from '@/lib/projectEngagement';

const submittedCommentsSchema = commentSchema.array().max(1000, 'Too many comments');

async function moveCommentsWhenSlugChanges(siteId: string, previousSlug?: string, nextSlug?: string) {
  if (!previousSlug || !nextSlug || previousSlug === nextSlug) return;

  try {
    const previousRef = db.ref(buildCommentPath(siteId, previousSlug));
    const nextRef = db.ref(buildCommentPath(siteId, nextSlug));
    const [previousSnap, nextSnap] = await Promise.all([
      previousRef.once('value'),
      nextRef.once('value'),
    ]);

    const previousComments = previousSnap.val();
    if (!Array.isArray(previousComments) || previousComments.length === 0) return;

    const nextComments = nextSnap.val();
    const mergedComments = Array.isArray(nextComments)
      ? [...nextComments, ...previousComments]
      : previousComments;

    await nextRef.set(mergedComments);
    await previousRef.remove();
  } catch (error) {
    console.error('[API/Projects/[id]] Failed to migrate comments after slug change:', error);
  }
}

// GET - Read single project
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    // PERF FIX: Fetch langsung by id — sebelumnya load SEMUA project
    // lalu .find() yang inefficient buat banyak project.
    const siteId = resolveProjectSiteId(request);
    const project = await projectSqlService.getProjectByIdSql(siteId, id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // SECURITY FIX: Unauthenticated callers cannot view draft projects.
    if (project.status !== 'published') {
      if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error loading project:', error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}

// PUT - Update project (admin only)
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    const rawBody = await request.json();
    const siteId = resolveProjectSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const submittedCommentsResult = Array.isArray(rawBody.comments)
      ? submittedCommentsSchema.safeParse(rawBody.comments)
      : null;

    if (submittedCommentsResult && !submittedCommentsResult.success) {
      return NextResponse.json(
        { error: 'Invalid comments payload', details: submittedCommentsResult.error.format() },
        { status: 400 }
      );
    }

    // Validate with Zod schema (safeParse for user-friendly errors)
    const validationResult = UpdateProjectSchema.safeParse({ ...rawBody, id });
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation Failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { id: _validatedId, ...updateData } = validationResult.data;
    await enforceProjectUpdateQuota(siteId, validationResult.data as UpdateProjectData);

    const currentProject = await projectSqlService.getProjectByIdSql(siteId, id);
    const previousSlug = currentProject?.slug;

    const updatedProject = await projectSqlService.updateProjectSql(
      siteId,
      id,
      updateData as UpdateProjectData & { initialCommentCount?: number }
    );

    if (!updatedProject) {
      return NextResponse.json({ error: 'Project not found or update failed' }, { status: 404 });
    }

    await moveCommentsWhenSlugChanges(siteId, previousSlug, updatedProject.slug);

    // Track apakah persistensi komentar sempat gagal, supaya bisa di-bubble ke
    // response tanpa menggagalkan update project (yang sudah sukses di step 1).
    // Sebelumnya: failure ditelan console.error saja → user dapat response 200
    // tapi komentar hilang dari DB diam-diam (Schrödinbug).
    let commentsPersistWarning: string | undefined;

    if (submittedCommentsResult?.success) {
      try {
        await db.ref(buildCommentPath(siteId, updatedProject.slug)).set(submittedCommentsResult.data);
      } catch (commentError) {
        console.error('Failed to persist submitted comments:', commentError);
        commentsPersistWarning =
          'Project saved, but comments failed to persist. Please retry comments.';
      }
    } else if (rawBody.initialCommentCount && rawBody.initialCommentCount > 0) {
      try {
        const newComments = generateGenZComments(updatedProject.slug, rawBody.initialCommentCount);

        const commentsRef = db.ref(buildCommentPath(siteId, updatedProject.slug));
        const snap = await commentsRef.once('value');
        const existingComments = snap.val() || [];

        const combinedComments = [
          ...(Array.isArray(existingComments) ? existingComments : []),
          ...newComments,
        ];

        await commentsRef.set(combinedComments);
        console.log(`[API/Projects/[id]] Successfully appended comments to ${updatedProject.slug}`);
      } catch (commentError) {
        console.error('Failed to append comments:', commentError);
        commentsPersistWarning = 'Project saved, but generated comments failed to persist.';
      }
    }

    await revalidateSiteProjectPaths(siteId, [previousSlug || '', updatedProject.slug]);
    revalidatePath('/admin');

    return NextResponse.json({
      success: true,
      project: updatedProject,
      ...(commentsPersistWarning ? { commentsWarning: commentsPersistWarning } : {}),
    });
  } catch (error) {
    console.error('Error updating project:', error);
    if (error instanceof ProjectQuotaError) {
      return NextResponse.json(
        {
          error: error.message,
          errorCode: error.errorCode,
          details: error.details,
        },
        { status: error.errorCode === 'MEDIA_PER_PROJECT_EXCEEDED' ? 400 : 403 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE - Delete project (admin only)
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    const siteId = resolveProjectSiteId(request);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const success = await projectSqlService.deleteProjectSql(siteId, id);

    if (!success) {
      return NextResponse.json({ error: 'Project not found or delete failed' }, { status: 404 });
    }

    await revalidateSiteProjectPaths(siteId);
    revalidatePath('/admin');

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete project' },
      { status: 500 }
    );
  }
}

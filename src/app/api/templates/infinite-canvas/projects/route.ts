import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { projectSqlService } from '@/lib/services/project/projectSqlService';
import { generateGenZComments } from '@/lib/magic';
import { db } from '@/lib/database';
import { CreateProjectSchema, commentSchema } from '@/lib/validations';
import { success, created, unauthorized, serverError, validationError } from '@/lib/api-response';
import {
  enforceProjectCreateQuota,
  ProjectQuotaError,
  resolveProjectSiteId,
} from '@/lib/admin/projectSiteContext';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import { resolveProjectMediaUrls } from '@/lib/urlResolver';
import { validateAdminRequest } from '@/lib/auth';
import { revalidateSiteProjectPaths } from '@/lib/admin/siteRequestContext';
import { buildCommentPath } from '@/lib/projectEngagement';

const submittedCommentsSchema = commentSchema.array().max(1000, 'Too many comments');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = resolveProjectSiteId(request);
    const isAuthenticated = await validateAdminRequest(request, { checkCsrf: false });
    const status = isAuthenticated
      ? (searchParams.get('status') || undefined)
      : 'published';
    const { projects, lastUpdated } = await projectSqlService.getProjectsSql(siteId, status);
    const fixedProjects = resolveProjectMediaUrls(projects);
    return success({ projects: fixedProjects, lastUpdated });
  } catch (error) {
    console.error('[API/Templates/Infinite-Canvas/Projects GET] Error:', error);
    return serverError('Failed to load projects');
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const siteId = resolveProjectSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return unauthorized('Invalid or missing CSRF token');
    }

    const submittedCommentsResult = Array.isArray(rawBody.comments)
      ? submittedCommentsSchema.safeParse(rawBody.comments)
      : null;

    if (submittedCommentsResult && !submittedCommentsResult.success) {
      return validationError(submittedCommentsResult.error);
    }

    const validationResult = CreateProjectSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const projectData = {
      ...validationResult.data,
      year:
        typeof validationResult.data.year === 'string'
          ? parseInt(validationResult.data.year, 10)
          : validationResult.data.year,
    };

    await enforceProjectCreateQuota(
      siteId,
      projectData as unknown as import('@/types/projects').CreateProjectData
    );

    let newProject;
    try {
      newProject = await projectSqlService.createProjectSql(
        siteId,
        projectData as unknown as import('@/types/projects').CreateProjectData
      );
    } catch (innerError) {
      if (innerError instanceof z.ZodError) {
        return validationError(innerError);
      }
      throw innerError;
    }

    if (submittedCommentsResult?.success) {
      try {
        await db.ref(buildCommentPath(siteId, newProject.slug)).set(submittedCommentsResult.data);
      } catch (commentErr) {
        console.error('[API/Templates/Infinite-Canvas/Projects] Failed to persist submitted comments:', commentErr);
      }
    } else if (
      validationResult.data.initialCommentCount &&
      validationResult.data.initialCommentCount > 0
    ) {
      try {
        const generatedComments = generateGenZComments(
          newProject.slug,
          validationResult.data.initialCommentCount
        );
        await db.ref(buildCommentPath(siteId, newProject.slug)).set(generatedComments);
      } catch (commentErr) {
        console.warn('[API/Templates/Infinite-Canvas/Projects] Failed to auto-generate comments:', commentErr);
      }
    }

    await revalidateSiteProjectPaths(siteId, [newProject.slug]);
    revalidatePath('/admin');

    return created(newProject, 'Project created successfully');
  } catch (error) {
    console.error('[API/Templates/Infinite-Canvas/Projects POST] Error:', error);
    if (error instanceof ProjectQuotaError) {
      return Response.json(
        {
          success: false,
          error: error.message,
          errorCode: error.errorCode,
          details: error.details,
        },
        { status: error.errorCode === 'MEDIA_PER_PROJECT_EXCEEDED' ? 400 : 403 }
      );
    }
    if (error instanceof z.ZodError) return validationError(error);
    return serverError('Failed to create project');
  }
}

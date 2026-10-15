import { queryD1 } from '@/lib/cloudflareD1';
import { CreateProjectData, Project, UpdateProjectData } from '@/types/projects';
import {
  extractSiteProjectMediaKeys,
  purgeUnreferencedSiteProjectMediaAssets,
} from '@/lib/services/project/projectStorage';
import {
  mapSqlToProject,
  generateProjectId,
  ProjectSqlRow,
  ProjectNarrativeSqlRow,
  MediaAssetSqlRow,
} from '@/lib/mappers/projectMapper';
import { logOperationalEvent } from '@/lib/observability/operationalLog';

type D1Param = string | number | boolean | null;
type ProjectMetadata = Record<string, unknown>;

function slugifyTitle(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || `project-${Date.now()}`;
}

async function generateUniqueProjectSlug(siteId: string, desiredSlug: string, excludeId?: string) {
  const baseSlug = slugifyTitle(desiredSlug);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const rows = await queryD1<{ id: string }>(
      `SELECT id FROM projects WHERE site_id = ? AND slug = ? LIMIT 1`,
      [siteId, slug]
    );
    const collision = rows[0];
    if (!collision || collision.id === excludeId) return slug;

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function getNextProjectOrder(siteId: string) {
  const rows = await queryD1<{ next_order: number }>(
    `SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM projects WHERE site_id = ?`,
    [siteId]
  );
  return Number(rows[0]?.next_order || 1);
}

function buildProjectMetadata(
  data: Partial<CreateProjectData | UpdateProjectData>,
  existing: ProjectMetadata = {}
) {
  return {
    ...existing,
    ...Object.fromEntries(
      Object.entries({
        client: data.client,
        year: data.year,
        tags: data.tags,
        cover: data.cover,
        description: data.description,
        description_id: data.description_id,
        title_id: data.title_id,
        autoplay: data.autoplay,
        muted: data.muted,
        loop: data.loop,
        playsInline: data.playsInline,
        coverWidth: data.coverWidth,
        coverHeight: data.coverHeight,
        likes: data.likes,
        shares: data.shares,
        allowComments: data.allowComments,
        role: data.role,
        timeline: data.timeline,
        team: data.team,
        software: data.software,
        type: data.type,
        comparison: data.comparison,
        gallery: data.gallery,
        galleryGroups: data.galleryGroups,
        narrative: data.narrative,
        galleryItems: data.galleryItems,
      }).filter(([, value]) => value !== undefined)
    ),
  };
}

async function getProjectMediaR2Keys(siteId: string, projectId: string) {
  const mediaRows = await queryD1<{ r2_key: string | null }>(
    `SELECT r2_key FROM media_assets WHERE project_id = ? AND site_id = ?`,
    [projectId, siteId]
  );

  return mediaRows
    .map((row) => row.r2_key)
    .filter((key): key is string => Boolean(key));
}

async function getOtherProjectMediaKeys(siteId: string, excludeProjectId: string) {
  const projectRows = await queryD1<ProjectSqlRow>(
    `SELECT * FROM projects WHERE site_id = ? AND id != ?`,
    [siteId, excludeProjectId]
  );
  const keys = new Set<string>();

  for (const projectRow of projectRows) {
    const mediaRows = await queryD1<MediaAssetSqlRow>(
      `SELECT * FROM media_assets WHERE project_id = ? AND site_id = ? ORDER BY sort_order ASC`,
      [projectRow.id, siteId]
    );
    const project = mapSqlToProject(projectRow, null, mediaRows);
    const mediaKeys = mediaRows
      .map((row) => row.r2_key)
      .filter((key): key is string => Boolean(key));

    extractSiteProjectMediaKeys(siteId, project, mediaKeys).forEach((key) => keys.add(key));
  }

  return [...keys];
}

export const projectSqlService = {
  /**
   * READ: Dapatkan semua project berdasarkan siteId
   */
  async getProjectsSql(
    siteId: string,
    status?: string
  ): Promise<{ projects: Project[]; lastUpdated: string }> {
    let sql = `SELECT * FROM projects WHERE site_id = ?`;
    const params: D1Param[] = [siteId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY order_index ASC, created_at DESC`;

    const projectRows = await queryD1<ProjectSqlRow>(sql, params);

    if (projectRows.length === 0) {
      return { projects: [], lastUpdated: new Date().toISOString() };
    }

    // Batch, bukan N+1: queryD1 = REST per permintaan (±200 ms tiap panggilan),
    // jadi 2 query per project membuat render homepage/preview membengkak jadi
    // ±41 query ≈ 8 detik untuk portofolio 20 project. Dengan subquery IN,
    // total hanya 3 query dan jumlah parameter tidak tumbuh seiring project.
    const subquery = `SELECT id FROM projects WHERE site_id = ?${
      status ? ' AND status = ?' : ''
    }`;
    const [narrativeRows, mediaRows] = await Promise.all([
      queryD1<ProjectNarrativeSqlRow>(
        `SELECT * FROM project_narratives WHERE project_id IN (${subquery})`,
        params
      ),
      queryD1<MediaAssetSqlRow>(
        `SELECT * FROM media_assets WHERE project_id IN (${subquery}) ORDER BY sort_order ASC`,
        params
      ),
    ]);

    const narrativeByProject = new Map<string, ProjectNarrativeSqlRow>();
    for (const row of narrativeRows) {
      if (!narrativeByProject.has(row.project_id)) {
        narrativeByProject.set(row.project_id, row);
      }
    }

    const mediaByProject = new Map<string, MediaAssetSqlRow[]>();
    for (const row of mediaRows) {
      const list = mediaByProject.get(row.project_id);
      if (list) {
        list.push(row);
      } else {
        mediaByProject.set(row.project_id, [row]);
      }
    }

    const projects = projectRows.map((pRow) =>
      mapSqlToProject(
        pRow,
        narrativeByProject.get(pRow.id) || null,
        mediaByProject.get(pRow.id) || []
      )
    );

    return { projects, lastUpdated: new Date().toISOString() };
  },

  /**
   * READ: Dapatkan satu project berdasarkan slug
   */
  async getProjectBySlugSql(siteId: string, slug: string): Promise<Project | null> {
    const projectRows = await queryD1<ProjectSqlRow>(
      `SELECT * FROM projects WHERE site_id = ? AND slug = ? LIMIT 1`,
      [siteId, slug]
    );
    if (!projectRows.length) return null;

    const pRow = projectRows[0];
    const narrRows = await queryD1<ProjectNarrativeSqlRow>(
      `SELECT * FROM project_narratives WHERE project_id = ?`,
      [pRow.id]
    );
    const mediaRows = await queryD1<MediaAssetSqlRow>(
      `SELECT * FROM media_assets WHERE project_id = ? ORDER BY sort_order ASC`,
      [pRow.id]
    );

    return mapSqlToProject(pRow, narrRows[0] || null, mediaRows);
  },

  async getProjectByIdSql(siteId: string, id: string): Promise<Project | null> {
    const pRow = await this.getRawProjectRow(siteId, id);
    if (!pRow) return null;

    const narrRows = await queryD1<ProjectNarrativeSqlRow>(
      `SELECT * FROM project_narratives WHERE project_id = ? AND site_id = ? LIMIT 1`,
      [id, siteId]
    );
    const mediaRows = await queryD1<MediaAssetSqlRow>(
      `SELECT * FROM media_assets WHERE project_id = ? AND site_id = ? ORDER BY sort_order ASC`,
      [id, siteId]
    );

    return mapSqlToProject(pRow, narrRows[0] || null, mediaRows);
  },

  /**
   * CREATE: Simpan project baru ke tabel relasional
   */
  async createProjectSql(siteId: string, data: CreateProjectData, id?: string): Promise<Project> {
    const projectId = id || generateProjectId();
    const now = new Date().toISOString();
    const dataWithExtras = data as CreateProjectData & { order?: number; slug?: string };
    const slug = await generateUniqueProjectSlug(siteId, dataWithExtras.slug || data.title);
    const orderIndex =
      typeof dataWithExtras.order === 'number'
        ? dataWithExtras.order
        : await getNextProjectOrder(siteId);
    const metadata = buildProjectMetadata(data);

    // Insert into projects
    await queryD1(
      `INSERT INTO projects (id, site_id, slug, title, status, order_index, metadata_json, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId, 
        siteId, 
        slug,
        data.title, 
        data.status || 'draft',
        orderIndex,
        JSON.stringify(metadata),
        now,
        now,
      ]
    );

    // Insert into project_narratives if narrative exists
    let narrativeRow: ProjectNarrativeSqlRow | null = null;
    if (data.narrative) {
      const nId = `narr-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
      await queryD1(
        `INSERT INTO project_narratives (id, site_id, project_id, challenge, solution, impact, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nId,
          siteId,
          projectId,
          data.narrative.challenge || null,
          data.narrative.solution || null,
          data.narrative.impact || data.narrative.result || null,
          now,
          now,
        ]
      );
      narrativeRow = {
        id: nId,
        site_id: siteId,
        project_id: projectId,
        challenge: data.narrative.challenge || null,
        solution: data.narrative.solution || null,
        impact: data.narrative.impact || data.narrative.result || null,
      };
    }

    // Insert into media_assets if galleryItems exist
    const mediaRows: MediaAssetSqlRow[] = [];
    if (data.galleryItems && data.galleryItems.length > 0) {
      for (let i = 0; i < data.galleryItems.length; i++) {
        const item = data.galleryItems[i];
        const mId = `media-${Date.now()}-${crypto.randomUUID().slice(0, 4)}-${i}`;
        await queryD1(
          `INSERT INTO media_assets (id, site_id, project_id, r2_key, public_url, alt_text, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [mId, siteId, projectId, item.poster || '', item.src, item.alt || null, i, now, now]
        );
        mediaRows.push({
          id: mId,
          site_id: siteId,
          project_id: projectId,
          r2_key: item.poster || '',
          public_url: item.src,
          alt_text: item.alt || null,
          sort_order: i,
        });
      }

      // Update cover
      if (mediaRows.length > 0) {
        await queryD1(`UPDATE projects SET cover_media_id = ? WHERE id = ? AND site_id = ?`, [
          mediaRows[0].id,
          projectId,
          siteId,
        ]);
      }
    }

    const projectRow = await this.getRawProjectRow(siteId, projectId);
    if (!projectRow) throw new Error('Failed to create project SQL row');

    const project = mapSqlToProject(projectRow, narrativeRow, mediaRows);
    logOperationalEvent({
      event: project.status === 'published' ? 'project.publish' : 'project.create',
      status: 'success',
      siteId,
      entityType: 'project',
      entityId: projectId,
      message: project.status === 'published' ? 'Project created as published' : 'Project created',
      metadata: {
        slug,
        status: project.status,
        mediaAssets: mediaRows.length,
      },
    });

    return project;
  },

  /**
   * UPDATE: Update tabel relasional
   */
  async updateProjectSql(siteId: string, id: string, data: UpdateProjectData): Promise<Project | null> {
    const now = new Date().toISOString();
    const projectRow = await this.getRawProjectRow(siteId, id);
    if (!projectRow) return null;

    const currentProject = await this.getProjectByIdSql(siteId, id);
    if (!currentProject) return null;

    const previousMediaKeys = data.galleryItems ? await getProjectMediaR2Keys(siteId, id) : [];

    let metadata: ProjectMetadata = {};
    if (projectRow.metadata_json) {
      try {
        metadata = JSON.parse(projectRow.metadata_json);
      } catch (e) {
        console.error('Failed to parse metadata_json', e);
      }
    }

    const updatedMetadata = buildProjectMetadata(data, metadata);

    const updates: string[] = [];
    const params: D1Param[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.slug !== undefined) {
      const resolvedSlug = await generateUniqueProjectSlug(siteId, data.slug, id);
      if (resolvedSlug !== data.slug) {
        // FIX: Slug bisa berubah oleh suffix anti-collision — jadikan observable.
        console.warn(
          `[ProjectSqlService] Slug "${data.slug}" diubah menjadi "${resolvedSlug}" (collision) untuk project ${id}`
        );
      }
      updates.push('slug = ?');
      params.push(resolvedSlug);
    }

    updates.push('metadata_json = ?');
    params.push(JSON.stringify(updatedMetadata));

    updates.push('updated_at = ?');
    params.push(now);

    // FIX: Update cover tanpa galleryItems → lepas referensi cover_media_id
    // agar mapper membaca metadata.cover yang baru (bukan media gallery basi).
    if (data.cover !== undefined && !data.galleryItems) {
      updates.push('cover_media_id = NULL');
    }

    params.push(id, siteId);
    await queryD1(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`,
      params
    );

    // Sync narrative if provided
    if (data.narrative) {
      const narrRows = await queryD1(
        `SELECT id FROM project_narratives WHERE project_id = ? AND site_id = ? LIMIT 1`,
        [id, siteId]
      );
      if (narrRows.length > 0) {
        await queryD1(
          `UPDATE project_narratives 
           SET challenge = ?, solution = ?, impact = ?, updated_at = ? 
           WHERE project_id = ? AND site_id = ?`,
          [
            data.narrative.challenge || null,
            data.narrative.solution || null,
            data.narrative.impact || data.narrative.result || null,
            now,
            id,
            siteId,
          ]
        );
      } else {
        const nId = `narr-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
        await queryD1(
          `INSERT INTO project_narratives (id, site_id, project_id, challenge, solution, impact, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nId,
            siteId,
            id,
            data.narrative.challenge || null,
            data.narrative.solution || null,
            data.narrative.impact || data.narrative.result || null,
            now,
            now,
          ]
        );
      }
    }

    // Sync media assets if galleryItems provided
    if (data.galleryItems) {
      await queryD1(`DELETE FROM media_assets WHERE project_id = ? AND site_id = ?`, [id, siteId]);
      for (let i = 0; i < data.galleryItems.length; i++) {
        const item = data.galleryItems[i];
        const mId = `media-${Date.now()}-${crypto.randomUUID().slice(0, 4)}-${i}`;
        await queryD1(
          `INSERT INTO media_assets (id, site_id, project_id, r2_key, public_url, alt_text, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [mId, siteId, id, item.poster || '', item.src, item.alt || null, i, now, now]
        );
      }
      
      // Update cover_media_id in projects
      const mediaRows = await queryD1<{ id: string }>(
        `SELECT id FROM media_assets WHERE project_id = ? AND site_id = ? ORDER BY sort_order ASC LIMIT 1`,
        [id, siteId]
      );
      if (mediaRows.length > 0) {
        await queryD1(`UPDATE projects SET cover_media_id = ? WHERE id = ? AND site_id = ?`, [
          mediaRows[0].id,
          id,
          siteId,
        ]);
      }
    }

    const nextMediaKeys = data.galleryItems ? await getProjectMediaR2Keys(siteId, id) : [];
    const updatedProject = await this.getProjectByIdSql(siteId, id);

    if (updatedProject) {
      const retainedKeys = await getOtherProjectMediaKeys(siteId, id);
      await purgeUnreferencedSiteProjectMediaAssets({
        siteId,
        previousProject: currentProject,
        nextProject: updatedProject,
        previousAdditionalValues: previousMediaKeys,
        nextAdditionalValues: nextMediaKeys,
        retainedKeys,
      });

      logOperationalEvent({
        event: updatedProject.status === 'published' ? 'project.publish' : 'project.update',
        status: 'success',
        siteId,
        entityType: 'project',
        entityId: id,
        message:
          updatedProject.status === 'published' && currentProject.status !== 'published'
            ? 'Project published'
            : 'Project updated',
        metadata: {
          slug: updatedProject.slug,
          status: updatedProject.status,
          previousStatus: currentProject.status,
          mediaChanged: Boolean(data.galleryItems),
        },
      });
    }

    return updatedProject;
  },

  /**
   * DELETE: Hapus dari tabel relasional
   */
  async deleteProjectSql(siteId: string, id: string): Promise<boolean> {
    const project = await this.getProjectByIdSql(siteId, id);
    if (!project) return false;

    const mediaKeys = await getProjectMediaR2Keys(siteId, id);

    await queryD1(`DELETE FROM media_assets WHERE project_id = ? AND site_id = ?`, [id, siteId]);
    await queryD1(`DELETE FROM project_narratives WHERE project_id = ? AND site_id = ?`, [
      id,
      siteId,
    ]);
    const retainedKeys = await getOtherProjectMediaKeys(siteId, id);

    await queryD1(`DELETE FROM projects WHERE id = ? AND site_id = ?`, [id, siteId]);
    await purgeUnreferencedSiteProjectMediaAssets({
      siteId,
      previousProject: project,
      nextProject: {
        ...project,
        cover: '',
        comparison: undefined,
        gallery: [],
        galleryItems: [],
        galleryGroups: [],
      },
      previousAdditionalValues: mediaKeys,
      retainedKeys,
    });

    logOperationalEvent({
      event: 'project.delete',
      status: 'success',
      siteId,
      entityType: 'project',
      entityId: id,
      message: 'Project deleted',
      metadata: {
        slug: project.slug,
        mediaKeys: mediaKeys.length,
      },
    });

    return true;
  },

  async bulkUpdateProjectsSql(
    siteId: string,
    updates: {
      ids: string[];
      status?: 'published' | 'draft';
      delete?: boolean;
      reorder?: boolean;
    }
  ): Promise<boolean> {
    if (updates.ids.length === 0) return true;

    if (updates.delete) {
      const results = await Promise.all(
        updates.ids.map((id) => this.deleteProjectSql(siteId, id))
      );
      // every: kegagalan parsial HARUS dilaporkan gagal, bukan diam-diam sukses.
      return results.every(Boolean);
    }

    const now = new Date().toISOString();

    if (updates.reorder) {
      for (let i = 0; i < updates.ids.length; i += 1) {
        await queryD1(
          `UPDATE projects SET order_index = ?, updated_at = ? WHERE id = ? AND site_id = ?`,
          [i + 1, now, updates.ids[i], siteId]
        );
      }
      return true;
    }

    if (updates.status) {
      // FIX #46: Chunk IN clause agar tidak melebihi batas parameter SQL
      // saat bulk update ribuan project sekaligus.
      const CHUNK_SIZE = 500;
      for (let i = 0; i < updates.ids.length; i += CHUNK_SIZE) {
        const chunk = updates.ids.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(', ');
        await queryD1(
          `UPDATE projects SET status = ?, updated_at = ?
           WHERE site_id = ? AND id IN (${placeholders})`,
          [updates.status, now, siteId, ...chunk]
        );
      }
      logOperationalEvent({
        event: updates.status === 'published' ? 'project.publish' : 'project.update',
        status: 'success',
        siteId,
        entityType: 'project',
        message: `Project bulk status updated to ${updates.status}`,
        metadata: {
          ids: updates.ids,
          status: updates.status,
        },
      });
      return true;
    }

    return false;
  },

  // Helper: Get Raw Project
  async getRawProjectRow(siteId: string, projectId: string): Promise<ProjectSqlRow | null> {
    const rows = await queryD1<ProjectSqlRow>(
      `SELECT * FROM projects WHERE id = ? AND site_id = ? LIMIT 1`,
      [projectId, siteId]
    );
    return rows[0] || null;
  },
};

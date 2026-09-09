import { Project } from '@/types/projects';

type ProjectMetadata = Partial<Project> & Record<string, unknown>;

export interface ProjectSqlRow {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  cover_media_id: string | null;
  status: string;
  order_index: number;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectNarrativeSqlRow {
  id: string;
  site_id: string;
  project_id: string;
  challenge: string | null;
  solution: string | null;
  impact: string | null;
}

export interface MediaAssetSqlRow {
  id: string;
  site_id: string;
  project_id: string;
  r2_key: string;
  public_url: string;
  alt_text: string | null;
  sort_order: number;
}

export function mapSqlToProject(
  projectRow: ProjectSqlRow,
  narrativeRow?: ProjectNarrativeSqlRow | null,
  mediaRows?: MediaAssetSqlRow[]
): Project {
  let metadata: ProjectMetadata = {};
  if (projectRow.metadata_json) {
    try {
      metadata = JSON.parse(projectRow.metadata_json) as ProjectMetadata;
    } catch (e) {
      console.error('Failed to parse metadata_json', e);
    }
  }

  // Base project setup with defaults for legacy fields
  const project: Project = {
    id: projectRow.id,
    title: projectRow.title,
    slug: projectRow.slug,
    client: metadata.client || 'Unknown Client', // Default for legacy support if needed
    year: metadata.year || new Date(projectRow.created_at).getFullYear(),
    tags: metadata.tags || [],
    cover: metadata.cover || 'https://via.placeholder.com/800x600', // Default cover, replaced below if media matches
    autoplay: metadata.autoplay ?? false,
    muted: metadata.muted ?? true,
    loop: metadata.loop ?? false,
    playsInline: metadata.playsInline ?? true,
    coverWidth: metadata.coverWidth ?? 800,
    coverHeight: metadata.coverHeight ?? 600,
    description: metadata.description || '',
    likes: metadata.likes ?? 0,
    shares: metadata.shares ?? 0,
    allowComments: metadata.allowComments ?? true,
    order: projectRow.order_index,
    status: (projectRow.status as 'published' | 'draft') || 'draft',
    createdAt: projectRow.created_at,
    updatedAt: projectRow.updated_at,
    role: metadata.role,
    timeline: metadata.timeline,
    team: metadata.team,
    software: metadata.software,
    type: metadata.type,
    comparison: metadata.comparison,
    gallery: metadata.gallery,
    galleryGroups: metadata.galleryGroups,
  };

  // Map narrative from DB narrativeRow (with fallback to metadata narrative)
  if (narrativeRow) {
    project.narrative = {
      ...metadata.narrative,
      challenge: narrativeRow.challenge || metadata.narrative?.challenge || undefined,
      solution: narrativeRow.solution || metadata.narrative?.solution || undefined,
      impact: narrativeRow.impact || metadata.narrative?.impact || undefined,
    };
    // Prioritize metadata.description and only fallback to narrative challenge/impact
    project.description = metadata.description || narrativeRow.challenge || narrativeRow.impact || '';
  } else if (metadata.narrative) {
    project.narrative = metadata.narrative;
  }

  // Map gallery media
  if (mediaRows && mediaRows.length > 0) {
    const sortedMedia = [...mediaRows].sort((a, b) => a.sort_order - b.sort_order);
    project.galleryItems = sortedMedia.map((m) => ({
      kind: m.public_url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image',
      src: m.public_url,
      alt: m.alt_text || projectRow.title,
    }));
    
    // Set cover if cover_media_id matches
    if (projectRow.cover_media_id) {
      const coverMedia = sortedMedia.find(m => m.id === projectRow.cover_media_id);
      if (coverMedia) {
        project.cover = coverMedia.public_url;
      }
    } else if (!metadata.cover && sortedMedia.length > 0) {
      // Fallback: pakai item gallery pertama HANYA jika metadata.cover kosong.
      project.cover = sortedMedia[0].public_url;
    }
  } else if (metadata.galleryItems) {
    project.galleryItems = metadata.galleryItems;
  }

  return project;
}

export function generateProjectId(): string {
  // FIX: Date.now() saja rawan collision PK saat 2 create dalam milidetik
  // yang sama → tambahkan suffix acak.
  return `project-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

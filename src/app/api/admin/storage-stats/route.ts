import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { isR2StorageConfigured, getMissingR2EnvKeys } from '@/lib/r2Storage';
import { extractStoragePath } from '@/lib/urlResolver';
import { aboutService } from '@/lib/services/aboutService';
import { projectService } from '@/lib/services/projectService';
import { hardSkillService } from '@/lib/services/hardSkillService';
import { explorerService } from '@/lib/services/explorerService';
import { extractProjectAssets } from '@/lib/services/project/projectStorage';
import {
  buildCategory,
  countByKind,
  describeCategory,
  emptyCounts,
  type CategoryStats,
  type StorageReference,
} from './categoryStats';

/**
 * GET /api/admin/storage-stats
 *
 * Compares D1 references against R2 object listings and returns a
 * per-category breakdown of image vs video counts. Drives the storage
 * panel inside the admin Database popout, so admins can spot mismatches
 * (orphan files in R2 or dangling URLs in D1) at a glance.
 *
 * Auth:
 *   Admin-only. Read-only, so CSRF is not required.
 *
 * Caching:
 *   Listing R2 round-trips to S3, so we memoize the response in-process
 *   for 30s. Multiple admin tabs / quick popout toggles won't hammer
 *   ListObjectsV2.
 */


interface StorageStatsResponse {
  categories: CategoryStats[];
  generatedAt: number;
  cached: boolean;
  warnings: string[];
}

function extractR2IconStoragePath(url: string) {
  return url.startsWith('/assets/icons-library/') ? null : extractStoragePath(url);
}

const CACHE_TTL_MS = 30_000;
let cachedAt = 0;
let cachedPayload: StorageStatsResponse | null = null;
// Coalesce concurrent requests so two admin tabs don't both kick off
// a R2 ListObjectsV2 round-trip at the same time when the cache is cold.
let inflight: Promise<StorageStatsResponse> | null = null;

async function safeCollect<T>(
  label: string,
  warnings: string[],
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    console.warn(`[storage-stats] ${label} failed: ${msg}`);
    warnings.push(`${label}: ${msg}`);
    return fallback;
  }
}

async function runStats(): Promise<StorageStatsResponse> {
  const warnings: string[] = [];

  // Read all D1 sources in parallel; a failure in any one collector
  // becomes a warning rather than a hard 500, so the panel still
  // renders partial data.
  const [aboutData, projectsBundle, hardSkillData] = await Promise.all([
    safeCollect('aboutService', warnings, () => aboutService.getAboutData(true), null),
    safeCollect('projectService', warnings, () => projectService.getProjects(undefined, true), {
      projects: [],
      lastUpdated: '',
    }),
    safeCollect('hardSkillService', warnings, () => hardSkillService.getHardSkills(true), {
      skills: [],
      lastUpdated: '',
    } as Awaited<ReturnType<typeof hardSkillService.getHardSkills>>),
  ]);

  // ── Wallpapers ───────────────────────────────────────────────
  const wallpaperRefs: StorageReference[] = [];
  const wallpaperCollection = aboutData?.wallpaperConfig?.collection || [];
  for (const w of wallpaperCollection) {
    if (w?.url) {
      wallpaperRefs.push({ url: w.url, storagePath: extractStoragePath(w.url) });
    }
    if (w?.posterUrl) {
      wallpaperRefs.push({
        url: w.posterUrl,
        storagePath: extractStoragePath(w.posterUrl),
      });
    }
  }

  // ── Projects ─────────────────────────────────────────────────
  const projectRefs: StorageReference[] = [];
  for (const p of projectsBundle.projects) {
    const urls = extractProjectAssets(p);
    for (const url of urls) {
      projectRefs.push({ url, storagePath: extractStoragePath(url) });
    }
  }

  // ── Hard skill and Dock icons ─────────────────────────────────
  const iconRefs: StorageReference[] = [];
  for (const skill of hardSkillData.skills || []) {
    if (skill?.iconUrl) {
      iconRefs.push({
        url: skill.iconUrl,
        storagePath: extractR2IconStoragePath(skill.iconUrl),
      });
    }
  }

  const dockConfig = aboutData?.dockConfig || {};
  for (const key of Object.keys(dockConfig)) {
    const item = dockConfig[key];
    if (item?.iconUrl) {
      iconRefs.push({
        url: item.iconUrl,
        storagePath: extractR2IconStoragePath(item.iconUrl),
      });
    }
  }

  const explorerRefs: StorageReference[] = [];
  const explorerNodes = await safeCollect(
    'explorerService',
    warnings,
    () => explorerService.getAllNodes(),
    [] as Awaited<ReturnType<typeof explorerService.getAllNodes>>
  );
  for (const node of explorerNodes) {
    if (node.type !== 'file') continue;
    explorerRefs.push({
      url: node.url,
      storagePath: node.storageKey || extractStoragePath(node.url),
    });
    if (node.previewUrl || node.previewKey) {
      explorerRefs.push({
        url: node.previewUrl || node.previewKey || '',
        storagePath:
          node.previewKey || (node.previewUrl ? extractStoragePath(node.previewUrl) : null),
      });
    }
    if (node.thumbnailUrl || node.thumbnailKey) {
      explorerRefs.push({
        url: node.thumbnailUrl || node.thumbnailKey || '',
        storagePath:
          node.thumbnailKey || (node.thumbnailUrl ? extractStoragePath(node.thumbnailUrl) : null),
      });
    }
  }
  const explorerManagedRefs = explorerRefs.filter((ref) =>
    ref.storagePath?.startsWith('assets/explorer/')
  );
  const explorerLegacyRefs = explorerRefs.filter((ref) =>
    ref.storagePath?.startsWith('assets/media/')
  );

  // Build per-category stats. R2 listing is parallelized inside
  // buildCategory's await chain via Promise.all here.
  let categories: CategoryStats[];
  if (!isR2StorageConfigured()) {
    warnings.push(
      `Cloudflare R2 env tidak lengkap (${getMissingR2EnvKeys().join(', ')}). R2 counts disabled.`
    );
    categories = [
      {
        id: 'wallpapers',
        label: 'Desktop Wallpaper',
        prefix: 'assets/wallpapers/',
        d1: countByKind(wallpaperRefs),
        r2: emptyCounts(),
        orphans: 0,
        dangling: 0,
        orphanKeys: [],
        danglingPaths: [],
        sidecarCount: 0,
      },
      {
        id: 'projects',
        label: 'Project Assets',
        prefix: 'assets/projects/',
        d1: countByKind(projectRefs),
        r2: emptyCounts(),
        orphans: 0,
        dangling: 0,
        orphanKeys: [],
        danglingPaths: [],
        sidecarCount: 0,
      },
      {
        id: 'hardSkillIcons',
        label: 'Hard Skill & Dock Icons',
        prefix: 'assets/icons-library/',
        d1: countByKind(iconRefs),
        r2: emptyCounts(),
        orphans: 0,
        dangling: 0,
        orphanKeys: [],
        danglingPaths: [],
        sidecarCount: 0,
      },
      {
        id: 'explorer',
        label: 'Explorer Files',
        prefix: 'assets/explorer/',
        d1: countByKind(explorerManagedRefs),
        r2: emptyCounts(),
        orphans: 0,
        dangling: 0,
        orphanKeys: [],
        danglingPaths: [],
        sidecarCount: 0,
      },
      {
        id: 'explorerLegacy',
        label: 'Explorer Legacy Media',
        prefix: 'assets/media/',
        d1: countByKind(explorerLegacyRefs),
        r2: emptyCounts(),
        orphans: 0,
        dangling: 0,
        orphanKeys: [],
        danglingPaths: [],
        sidecarCount: 0,
      },
    ];
  } else {
    categories = await Promise.all([
      buildCategory({
        id: 'wallpapers',
        label: 'Desktop Wallpaper',
        prefix: 'assets/wallpapers/',
        references: wallpaperRefs,
        includeVideoSidecars: true,
      }),
      buildCategory({
        id: 'projects',
        label: 'Project Assets',
        prefix: 'assets/projects/',
        references: projectRefs,
        includeVideoSidecars: true,
      }),
      buildCategory({
        id: 'hardSkillIcons',
        label: 'Hard Skill & Dock Icons',
        prefix: 'assets/icons-library/',
        references: iconRefs,
      }),
      buildCategory({
        id: 'explorer',
        label: 'Explorer Files',
        prefix: 'assets/explorer/',
        references: explorerManagedRefs,
        // FIX (BUG-2): Explorer videos produce sidecar files (-preview.mp4,
        // .jpg poster) via the upload pipeline, same as projects/wallpapers.
        // Without this flag, those sidecars appear as "orphan" in the admin
        // storage dashboard and a naive cleanup would delete them.
        includeVideoSidecars: true,
      }),
      buildCategory({
        id: 'explorerLegacy',
        label: 'Explorer Legacy Media',
        prefix: 'assets/media/',
        references: explorerLegacyRefs,
        allowUnreferencedR2: true,
      }),
    ]);
  }

  // Annotate every category with a plain-language note. Big numbers
  // tucked inside a tooltip-less grid don't help an admin who hasn't
  // read the schema; the note explains the most common confusion in
  // 1–2 sentences.
  for (const cat of categories) {
    cat.note = describeCategory(cat);
  }

  return {
    categories,
    generatedAt: Date.now(),
    cached: false,
    warnings,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fresh = req.nextUrl.searchParams.get('fresh') === 'true';
    const now = Date.now();

    if (!fresh && cachedPayload && now - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ ...cachedPayload, cached: true });
    }

    if (!inflight) {
      inflight = runStats().finally(() => {
        // Clear the slot *after* the result is settled so a subsequent
        // request right after this one rolls over into the freshly
        // populated cache instead of starting another round-trip.
        inflight = null;
      });
    }
    const payload = await inflight;
    cachedPayload = payload;
    cachedAt = now;

    return NextResponse.json(payload);
  } catch (e) {
    console.error('[storage-stats] error:', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Failed to compute storage stats',
      },
      { status: 500 }
    );
  }
}

/**
 * Project Storage - utilitas ekstraksi dan pembersihan aset project dari R2.
 *
 * Mengekstrak semua URL aset (cover, gallery, comparison, poster) dari project
 * dan menyediakan fungsi hapus batch dari R2 storage.
 *
 * @module projectStorage
 */
import { deleteFromR2, isR2StorageConfigured } from '@/lib/r2Storage';
import { extractStoragePath } from '@/lib/urlResolver';
import type { Project } from '@/types/projects';

type PurgeResult = {
  requested: number;
  deleted: number;
  failed: number;
  skipped: number;
};

function addAssetUrl(assetUrls: string[], value?: string | null) {
  if (typeof value === 'string' && value.trim()) {
    assetUrls.push(value);
  }
}

export function extractProjectAssets(project: Project): string[] {
  const assetUrls: string[] = [];
  addAssetUrl(assetUrls, project.cover);
  addAssetUrl(assetUrls, project.comparison?.beforeImage);
  addAssetUrl(assetUrls, project.comparison?.afterImage);

  project.gallery?.forEach((url) => addAssetUrl(assetUrls, url));

  if (project.galleryItems && Array.isArray(project.galleryItems)) {
    project.galleryItems.forEach((item: { src?: string; poster?: string }) => {
      addAssetUrl(assetUrls, item.src);
      addAssetUrl(assetUrls, item.poster);
    });
  }

  if (project.galleryGroups && Array.isArray(project.galleryGroups)) {
    project.galleryGroups.forEach((group: { items?: Array<{ src?: string; poster?: string }> }) => {
      group.items?.forEach((item) => {
        addAssetUrl(assetUrls, item.src);
        addAssetUrl(assetUrls, item.poster);
      });
    });
  }

  return [...new Set(assetUrls)];
}

export async function purgeStorageAssets(urls: string[]): Promise<void> {
  const allAssetPathsToPurge: string[] = [];

  urls.forEach((url) => {
    const storagePath = extractStoragePath(url);

    if (storagePath && storagePath.startsWith('assets/')) {
      allAssetPathsToPurge.push(storagePath);
    }
  });

  if (allAssetPathsToPurge.length > 0) {
    console.log(`[ProjectService] Bulk purging ${allAssetPathsToPurge.length} storage assets...`);
    await Promise.allSettled(
      allAssetPathsToPurge.map(async (storagePath) => {
        try {
          await deleteFromR2IfConfigured(storagePath);
        } catch (e) {
          console.warn(`[ProjectService] Failed bulk delete asset: ${storagePath}`, e);
        }
      })
    );
  }
}

async function deleteFromR2IfConfigured(storagePath: string) {
  if (!isR2StorageConfigured()) return;
  await deleteFromR2(storagePath);
}

function normalizePotentialR2Key(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const path = /^https?:\/\//i.test(trimmed) ? new URL(trimmed).pathname : trimmed;
    const decodedPath = decodeURIComponent(path).replace(/^\/+/, '');
    return decodedPath.startsWith('r2/') ? decodedPath.substring('r2/'.length) : decodedPath;
  } catch {
    return null;
  }
}

function expandKnownProjectMediaSidecars(key: string): string[] {
  const keys = [key];
  const videoMatch = key.match(/^(.*)\.(mp4|webm|mov)$/i);

  if (videoMatch && !key.match(/-preview\.(mp4|webm|mov)$/i)) {
    const base = videoMatch[1];
    keys.push(`${base}-preview.mp4`, `${base}.jpg`, `${base}.webp`);
  }

  return keys;
}

export function extractSiteProjectMediaKey(siteId: string, value: string): string | null {
  const key = normalizePotentialR2Key(value);
  if (!key) return null;

  const expectedPrefix = `sites/${siteId}/projects/`;
  return key.startsWith(expectedPrefix) && key.length > expectedPrefix.length ? key : null;
}

export function extractSiteProjectMediaKeys(
  siteId: string,
  project: Project,
  additionalValues: string[] = []
): string[] {
  const keys = new Set<string>();
  const values = [...extractProjectAssets(project), ...additionalValues];

  values.forEach((value) => {
    const key = extractSiteProjectMediaKey(siteId, value);
    if (!key) return;

    expandKnownProjectMediaSidecars(key).forEach((expandedKey) => keys.add(expandedKey));
  });

  return [...keys];
}

async function purgeSiteProjectMediaKeys(keys: string[]): Promise<PurgeResult> {
  const uniqueKeys = [...new Set(keys)].filter(Boolean);
  if (uniqueKeys.length === 0) {
    return { requested: 0, deleted: 0, failed: 0, skipped: 0 };
  }

  if (!isR2StorageConfigured()) {
    return {
      requested: uniqueKeys.length,
      deleted: 0,
      failed: 0,
      skipped: uniqueKeys.length,
    };
  }

  const results = await Promise.allSettled(uniqueKeys.map((key) => deleteFromR2(key)));
  const failed = results.filter((result) => result.status === 'rejected').length;

  if (failed > 0) {
    console.warn(`[ProjectService] Failed to purge ${failed} project media object(s) from R2.`);
  }

  return {
    requested: uniqueKeys.length,
    deleted: uniqueKeys.length - failed,
    failed,
    skipped: 0,
  };
}

export async function purgeSiteProjectMediaAssets(
  siteId: string,
  project: Project,
  additionalValues: string[] = []
): Promise<PurgeResult> {
  return purgeSiteProjectMediaKeys(extractSiteProjectMediaKeys(siteId, project, additionalValues));
}

export async function purgeUnreferencedSiteProjectMediaAssets({
  siteId,
  previousProject,
  nextProject,
  previousAdditionalValues = [],
  nextAdditionalValues = [],
  retainedKeys = [],
}: {
  siteId: string;
  previousProject: Project;
  nextProject: Project;
  previousAdditionalValues?: string[];
  nextAdditionalValues?: string[];
  retainedKeys?: string[];
}): Promise<PurgeResult> {
  const previousKeys = new Set(
    extractSiteProjectMediaKeys(siteId, previousProject, previousAdditionalValues)
  );
  const nextKeys = new Set(extractSiteProjectMediaKeys(siteId, nextProject, nextAdditionalValues));
  const retainedKeySet = new Set(retainedKeys);
  const staleKeys = [...previousKeys].filter(
    (key) => !nextKeys.has(key) && !retainedKeySet.has(key)
  );

  return purgeSiteProjectMediaKeys(staleKeys);
}

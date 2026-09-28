/**
 * Normalize media URLs used by the UI.
 * R2 uploads are served through `/r2/...`; local bundled assets use `/assets/...`.
 */
export function resolveStorageUrl(url: string): string {
  if (!url) return url;

  if (url.startsWith('r2/') || url.startsWith('assets/') || url.startsWith('temp/')) {
    return `/${url}`;
  }

  return url;
}

/**
 * Extract an R2 object key from a public media URL/path for deletion.
 */
export function extractStoragePath(url: string): string | null {
  if (!url) return null;

  // Media URL boleh membawa cache-buster (mis. `poster.jpg?v=2`). Object key
  // R2 tidak pernah menyertakan query/fragment — buang dulu supaya key hasil
  // ekstraksi tetap valid untuk delete / storage-stats / audit orphan.
  const clean = url.split('#')[0].split('?')[0];
  if (!clean) return null;

  try {
    if (clean.startsWith('/r2/assets/') || clean.startsWith('/r2/temp/')) {
      return clean.substring('/r2/'.length);
    }

    if (clean.startsWith('r2/assets/') || clean.startsWith('r2/temp/')) {
      return clean.substring('r2/'.length);
    }

    if (clean.startsWith('/assets/') || clean.startsWith('/temp/')) {
      return clean.substring(1);
    }

    if (clean.startsWith('assets/') || clean.startsWith('temp/')) {
      return clean;
    }

    const urlObj = new URL(clean);
    const decodedPath = decodeURIComponent(urlObj.pathname.replace(/^\/+/, ''));

    if (decodedPath.startsWith('r2/assets/') || decodedPath.startsWith('r2/temp/')) {
      return decodedPath.substring('r2/'.length);
    }

    if (decodedPath.startsWith('assets/') || decodedPath.startsWith('temp/')) {
      return decodedPath;
    }

    const assetsIndex = decodedPath.indexOf('assets/');
    if (assetsIndex >= 0) return decodedPath.slice(assetsIndex);

    const tempIndex = decodedPath.indexOf('temp/');
    if (tempIndex >= 0) return decodedPath.slice(tempIndex);

    return null;
  } catch {
    return null;
  }
}

type ProjectMediaLike = {
  cover: string;
  galleryItems?: Array<{ src: string; poster?: string }>;
  gallery?: string[];
};

/**
 * Resolve all media URLs on a single project object.
 * Consolidates the repeated cover/galleryItems/gallery mapping pattern.
 */
export function resolveProjectMediaUrl<T extends ProjectMediaLike>(project: T): T {
  return {
    ...project,
    cover: resolveStorageUrl(project.cover),
    galleryItems: project.galleryItems?.map((item) => ({
      ...item,
      src: resolveStorageUrl(item.src),
      poster: resolveStorageUrl(item.poster ?? ''),
    })),
    gallery: project.gallery?.map((url) => resolveStorageUrl(url) || url),
  };
}

/**
 * Resolve media URLs for an array of projects.
 */
export function resolveProjectMediaUrls<T extends ProjectMediaLike>(projects: T[]): T[] {
  return projects.map(resolveProjectMediaUrl);
}



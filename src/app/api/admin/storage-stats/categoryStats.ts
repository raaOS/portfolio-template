import { listR2ObjectKeys } from '@/lib/r2Storage';

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico)$/i;

type MediaKind = 'image' | 'video' | 'other';

export interface KindCounts {
  total: number;
  image: number;
  video: number;
  other: number;
}

export interface CategoryStats {
  id: string;
  label: string;
  prefix: string;
  d1: KindCounts;
  r2: KindCounts;
  orphans: number;
  dangling: number;
  orphanKeys: string[];
  danglingPaths: string[];
  note?: string;
  sidecarCount: number;
}

export interface StorageReference {
  url: string;
  storagePath: string | null;
}

interface BuildCategoryArgs {
  id: string;
  label: string;
  prefix: string;
  references: StorageReference[];
  includeVideoSidecars?: boolean;
  allowUnreferencedR2?: boolean;
}

function classifyUrl(url: string | null | undefined): MediaKind {
  if (!url) return 'other';
  if (VIDEO_EXTENSIONS.test(url)) return 'video';
  if (IMAGE_EXTENSIONS.test(url)) return 'image';
  return 'other';
}

export function emptyCounts(): KindCounts {
  return { total: 0, image: 0, video: 0, other: 0 };
}

function bumpCounts(counts: KindCounts, kind: MediaKind) {
  counts.total += 1;
  counts[kind] += 1;
}

function dedupePushKind(counts: KindCounts, seen: Set<string>, url: string | null | undefined) {
  if (!url) return;
  if (seen.has(url)) return;
  seen.add(url);
  bumpCounts(counts, classifyUrl(url));
}

export function countByKind(references: StorageReference[]): KindCounts {
  const counts = emptyCounts();
  const seen = new Set<string>();
  for (const ref of references) {
    dedupePushKind(counts, seen, ref.url);
  }
  return counts;
}

export async function buildCategory({
  id,
  label,
  prefix,
  references,
  includeVideoSidecars,
  allowUnreferencedR2 = false,
}: BuildCategoryArgs): Promise<CategoryStats> {
  const d1 = countByKind(references);
  const primaryPathsInPrefix = new Set<string>();
  const derivedSidecarPaths = new Set<string>();

  for (const ref of references) {
    if (!ref.storagePath?.startsWith(prefix)) continue;

    primaryPathsInPrefix.add(ref.storagePath);

    if (!includeVideoSidecars) continue;

    const match = ref.storagePath.match(/^(.*)\.(mp4|webm|mov)$/i);
    if (!match) continue;

    const base = match[1];
    derivedSidecarPaths.add(`${base}-preview.mp4`);
    derivedSidecarPaths.add(`${base}.jpg`);
    derivedSidecarPaths.add(`${base}.webp`);
  }

  const r2 = emptyCounts();
  const r2Keys = await listR2ObjectKeys({ prefix });
  for (const key of r2Keys) {
    bumpCounts(r2, classifyUrl(key));
  }

  const orphanKeys: string[] = [];
  for (const key of r2Keys) {
    if (allowUnreferencedR2) continue;
    if (primaryPathsInPrefix.has(key)) continue;
    if (derivedSidecarPaths.has(key)) continue;
    orphanKeys.push(key);
  }

  const r2KeySet = new Set(r2Keys);
  const danglingPaths: string[] = [];
  for (const path of primaryPathsInPrefix) {
    if (!r2KeySet.has(path)) {
      danglingPaths.push(path);
    }
  }

  let sidecarCount = 0;
  for (const key of r2Keys) {
    if (derivedSidecarPaths.has(key)) sidecarCount++;
  }

  return {
    id,
    label,
    prefix,
    d1,
    r2,
    orphans: orphanKeys.length,
    dangling: danglingPaths.length,
    orphanKeys,
    danglingPaths,
    sidecarCount,
  };
}

export function describeCategory(cat: CategoryStats): string {
  if (cat.id === 'wallpapers') {
    if (cat.d1.total === 0 && cat.r2.total === 0) {
      return 'Belum ada wallpaper kustom. Site memakai DEFAULT_WALLPAPER_URL bawaan.';
    }
    if (cat.dangling > 0) {
      return `${cat.dangling} wallpaper merujuk file yang sudah tidak ada di R2 (dangling). Ini terjadi kalau file di-hapus manual dari bucket. Re-upload via admin atau hapus entry dangling lewat scripts/cloudflare/clear-dangling-wallpapers.ts.`;
    }
    if (cat.orphans > 0) {
      return `${cat.orphans} file di R2 tidak terhubung ke wallpaper manapun (orphan). Biasanya sisa upload yang gagal.`;
    }

    const videoCount = cat.d1.video;
    const imageCount = Math.max(0, cat.d1.image - videoCount);
    const parts: string[] = [];
    if (videoCount > 0) {
      parts.push(`${videoCount} video wallpaper (file utama + poster)`);
    }
    if (imageCount > 0) {
      parts.push(`${imageCount} image wallpaper`);
    }
    const summary = parts.length > 0 ? parts.join(' + ') : `${cat.d1.total} URL`;
    return `${summary}. Total ${cat.d1.total} URL di D1, ${cat.r2.total} file di R2 - angka cocok.`;
  }

  if (cat.id === 'projects') {
    if (cat.d1.total === 0 && cat.r2.total === 0) {
      return 'Belum ada project dengan media.';
    }
    if (cat.dangling > 0) {
      return `${cat.dangling} project merujuk file yang hilang dari R2 (dangling). Cek scripts/cloudflare/audit-orphan-projects.ts untuk detail.`;
    }
    if (cat.orphans > 0) {
      return `${cat.orphans} file di R2 tidak terhubung ke project manapun (orphan). Sisa upload gagal atau project yang dihapus tanpa cleanup asset.`;
    }

    if (cat.sidecarCount > 0) {
      return `D1 mencatat ${cat.d1.total} URL utama (cover, gallery, before/after - ${cat.d1.image} image + ${cat.d1.video} video). R2 menyimpan file utama plus ${cat.sidecarCount} file pendamping (preview clip + poster) yang dibuat otomatis untuk tiap video. Jadi R2 ${cat.r2.total} = D1 ${cat.d1.total} + side-car ${cat.sidecarCount}.`;
    }
    return `D1 mencatat ${cat.d1.total} URL utama (${cat.d1.image} image + ${cat.d1.video} video). R2 menyimpan file utama yang persis sama.`;
  }

  if (cat.id === 'hardSkillIcons') {
    if (cat.dangling > 0) {
      return `${cat.dangling} icon URL dirujuk di database tapi file-nya hilang dari R2.`;
    }
    if (cat.orphans > 0) {
      return `${cat.orphans} icon di R2 tidak dipakai oleh skill atau dock item manapun.`;
    }
    if (cat.d1.total > 0 && cat.r2.total === 0) {
      return `${cat.d1.total} icon URL tersimpan di database. Semuanya memakai icon bawaan lokal atau CDN eksternal, jadi R2 kosong adalah kondisi normal.`;
    }
    return `${cat.d1.total} icon URL tersimpan di database.`;
  }

  if (cat.id === 'explorer' || cat.id === 'explorerLegacy') {
    if (cat.id === 'explorerLegacy' && cat.d1.total === 0 && cat.r2.total > 0) {
      return `${cat.r2.total} legacy object masih ada di assets/media. Prefix ini tidak lagi dikelola D1 Explorer, jadi tidak dihitung sebagai mismatch.`;
    }
    if (cat.d1.total === 0 && cat.r2.total === 0) {
      return cat.id === 'explorer'
        ? 'Belum ada file Explorer di namespace baru.'
        : 'Tidak ada file Explorer legacy di assets/media.';
    }
    if (cat.dangling > 0) {
      return `${cat.dangling} file Explorer merujuk object R2 yang hilang.`;
    }
    if (cat.orphans > 0) {
      return `${cat.orphans} object R2 di prefix ini tidak punya referensi Explorer.`;
    }
    return `${cat.d1.total} URL Explorer tersinkron dengan ${cat.r2.total} object R2.`;
  }

  return '';
}

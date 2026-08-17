import { Project } from '@/types/projects';
import { getProxiedUrl } from '@/lib/utils';
import { DesktopPreferences, DesktopIconPosition } from '@/types/about';
import { getVideoPreviewSource } from '@/lib/mediaPreview';

type DesktopItem = { id: string; type: 'folder'; label: string; action?: () => void } | Project;

export const generateDesktopIcons = (
  windowSize: { width: number; height: number },
  commercialProjects: Project[],
  desktopPreferences?: DesktopPreferences,
  handleGoHome?: () => void,
  onOpenExplorer?: () => void
) => {
  if (!windowSize.width) return [];

  // 2. Define Desktop Grid
  const isMobile = windowSize.width < 768;
  let gridX = 120; // Diperlebar agar tidak overlap
  let gridY = 150; // Diperlebar untuk label teks panjang
  let margin = 32;
  let topOffset = 60; // MenuBar
  let bottomOffset = 120; // Dock

  if (isMobile) {
    gridX = 82;
    gridY = 98;
    margin = 12;
    topOffset = 50;
    bottomOffset = 95;
  }

  const cols = Math.max(0, Math.floor((windowSize.width - margin * 2) / gridX));
  const rows = Math.max(0, Math.floor((windowSize.height - topOffset - bottomOffset) / gridY));

  const availableSlots: { x: number; y: number }[] = [];

  // Urutan pengisian: Atas ke Bawah, lalu Kiri ke Kanan (Column-first)
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = margin + c * gridX;
      const y = topOffset + margin / 2 + r * gridY;
      availableSlots.push({ x, y });
    }
  }

  // 3. Stable Slot Assignment
  // Slot sudah diurutkan dari Atas->Bawah dan Kiri->Kanan secara natural dari loop.

  const safeProjects = Array.isArray(commercialProjects) ? commercialProjects : [];
  let visibleProjects = safeProjects.filter((p) => p.status !== 'draft');

  if (desktopPreferences?.maxIcons) {
    visibleProjects = visibleProjects.slice(0, desktopPreferences.maxIcons);
  }

  // 4. Combine Projects with specialized shortcuts
  // NOTE: Jangan override type dari Project, gunakan type asli ('commercial' | 'visual_art')
  const desktopItems = [
    {
      id: 'shortcut-home',
      type: 'folder' as const,
      label: 'My Projects',
      action: onOpenExplorer || handleGoHome,
    },
    ...visibleProjects,
  ];

  const generatedIcons = (desktopItems as DesktopItem[]).map((item, index: number) => {
    const itemId = item?.id || `icon-${index}`;
    // 1. Check if we have a saved position for this ID (Admin Saved)
    const savedPos: DesktopIconPosition | undefined = desktopPreferences?.iconPositions?.[itemId];

    // Clamp icon ke viewport aktif (safe margin untuk menu bar atas & dock bawah)
    // supaya icon yang di-save admin di layar besar nggak ke-cut di layar kecil.
    const SIDE_SAFE = 8;
    const TOP_SAFE = topOffset;
    const BOTTOM_SAFE = bottomOffset;
    const ICON_BOX = 80;
    const clampIcon = (cx: number, cy: number) => ({
      x: Math.max(
        SIDE_SAFE,
        Math.min(cx, Math.max(SIDE_SAFE, windowSize.width - ICON_BOX - SIDE_SAFE))
      ),
      y: Math.max(TOP_SAFE, Math.min(cy, Math.max(TOP_SAFE, windowSize.height - BOTTOM_SAFE))),
    });

    let slotIndex, slot, finalX, finalY;

    if (savedPos) {
      // Resolusi posisi — prioritas percentage (responsive), baru pixel legacy.
      let resolvedX: number;
      let resolvedY: number;

      if (typeof savedPos.xPct === 'number' && typeof savedPos.yPct === 'number') {
        resolvedX = (savedPos.xPct / 100) * windowSize.width;
        resolvedY = (savedPos.yPct / 100) * windowSize.height;
      } else if (
        typeof savedPos.refScreenWidth === 'number' &&
        typeof savedPos.refScreenHeight === 'number' &&
        savedPos.refScreenWidth > 0 &&
        savedPos.refScreenHeight > 0
      ) {
        // Legacy pixel + ref screen → scale proporsional ke viewport saat ini.
        resolvedX = (savedPos.x / savedPos.refScreenWidth) * windowSize.width;
        resolvedY = (savedPos.y / savedPos.refScreenHeight) * windowSize.height;
      } else {
        // Legacy pixel tanpa ref → pakai langsung, tapi tetap di-clamp.
        resolvedX = savedPos.x;
        resolvedY = savedPos.y;
      }

      const clamped = clampIcon(resolvedX, resolvedY);
      finalX = clamped.x;
      finalY = clamped.y;
    } else {
      // FALLBACK TO GRID (Simetris & Rapi)
      slotIndex = index % Math.max(1, availableSlots.length);
      slot =
        availableSlots.length > 0
          ? availableSlots[slotIndex] // STABLE PICK
          : {
              x: margin + index * gridX,
              y: topOffset + margin / 2 + index * gridY,
            };

      // Tidak ada efek jitter (acak), letakkan ikon sejajar sempurna
      finalX = Math.max(10, Math.min(windowSize.width - 80, slot.x));
      finalY = Math.max(topOffset, Math.min(windowSize.height - bottomOffset, slot.y));
    }

    if (item.type === 'folder') {
      return {
        id: item.id,
        type: 'folder',
        label: item.label,
        x: finalX,
        y: finalY,
        zIndex: savedPos?.zIndex,
        size: savedPos?.size,
        action: item.action,
      };
    }

    const project = item;

    // Video Detection Logic
    let videoUrl: string | undefined;
    // isVideo helper logic duplicated or moved?
    // We will do simple regex here as in original file
    // UPDATED: Support query parameters at the end of the URL (e.g. ?alt=media)
    const isVideo = (url?: string) => url && /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

    if (isVideo(project.cover)) {
      videoUrl = project.cover;
    } else if (
      project.galleryItems?.some((i: { kind: string; src: string }) => i.kind === 'video')
    ) {
      videoUrl = project.galleryItems?.find(
        (i: { kind: string; src: string }) => i.kind === 'video'
      )?.src;
    }

    // Calculate aspect ratio from project dimensions, default to 16:9 for videos or 4:5 for others
    const aspectRatio =
      project.coverWidth && project.coverHeight
        ? project.coverWidth / project.coverHeight
        : videoUrl
          ? 1.77
          : 0.8;

    // Generate poster URL for video (swap .mp4/.webm to .jpg for faster load)
    // PROTECTIVE: If it's a video, we try the .jpg poster but the component will still have the ID/Data
    // to show a fallback if the image fails.
    const posterUrl = videoUrl
      ? getProxiedUrl(project.cover.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.jpg$2'))
      : getProxiedUrl(project.cover);

    return {
      id: project.id,
      type: project.type || 'commercial',
      data: project,
      label: project.title,
      videoUrl: videoUrl ? getProxiedUrl(getVideoPreviewSource(videoUrl)) : undefined,
      imageUrl: posterUrl, // Use poster image for faster initial load
      aspectRatio: aspectRatio,
      x: finalX,
      y: finalY,
      zIndex: savedPos?.zIndex,
      size: savedPos?.size,
      priority: index < 4, // Prioritize the first 4 icons for LCP
    };
  });

  // Ensure the first few folders also get priority if they are at the top
  const optimizedIcons = generatedIcons.map((icon, idx) => ({
    ...icon,
    priority: idx < 4,
  }));

  return optimizedIcons;
};

import { memo, useRef } from 'react';
import Image from 'next/image';
import { useTransitionRouter } from 'next-view-transitions';
import { usePathname } from 'next/navigation';
import { getCoverPosterUrl, getPreviewCoverUrl, isVideoUrl } from '@/utils/canvas-helpers';
import { saveCameraState } from '@/lib/canvasCameraPersistence';
import {
  prepareProjectCoverTransition,
  PROJECT_COVER_TRANSITION_NAME,
  PROJECT_COVER_TRANSITION_ATTRIBUTE,
} from '@/lib/projectCoverTransition';
import type { CanvasItem } from './infiniteCanvasEngine';
import type { Project } from '@/types/projects';
import { buildTenantProjectDetailHref } from '@/lib/routing/tenantRoutes';

const CARD_WIDTH = 700;

type CanvasCardProps = {
  item: CanvasItem;
  isPriority: boolean;
  registerCardRef: (key: string, element: HTMLDivElement | null) => void;
  registerVideoRef: (key: string, element: HTMLVideoElement | null) => void;
  initialStyle?: React.CSSProperties;
  onHoverChange?: (project: Project | null) => void;
  isTransitionTarget?: boolean;
  getCamera?: () => { x: number; y: number; z: number };
  onSelectProject?: (project: Project) => void;
};

export function CanvasCardInner({
  item,
  isPriority,
  registerCardRef,
  registerVideoRef,
  initialStyle,
  onHoverChange,
  isTransitionTarget,
  getCamera,
  onSelectProject,
}: CanvasCardProps) {
  const router = useTransitionRouter();
  const pathname = usePathname();

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragDistance = useRef(0);
  const transitionElementRef = useRef<HTMLDivElement>(null);

  const coverUrl = getPreviewCoverUrl(item.project);
  const posterUrl = getCoverPosterUrl(item.project);
  const isVideo = isVideoUrl(coverUrl);
  const aspectRatio =
    item.project.coverWidth && item.project.coverHeight
      ? item.project.coverWidth / item.project.coverHeight
      : 16 / 9;

  const innerMediaStyle: React.CSSProperties = {};

  return (
    <div
      ref={(element) => registerCardRef(item.key, element)}
      data-canvas-card={item.key}
      className="group pointer-events-auto absolute left-1/2 top-1/2 cursor-pointer"
      style={{
        width: CARD_WIDTH,
        height: CARD_WIDTH / aspectRatio,
        display: 'block',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        contain: 'layout paint style',
        borderRadius: '0px',
        visibility: 'hidden', // Start hidden, rAF loop will reveal
        opacity: 0,
        ...initialStyle,
      }}
      onPointerDown={(e) => {
        pointerStart.current = { x: e.clientX, y: e.clientY };
        dragDistance.current = 0;
      }}
      onPointerUp={(e) => {
        if (!pointerStart.current) return;
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        dragDistance.current = Math.sqrt(dx * dx + dy * dy);
        pointerStart.current = null;
      }}
      onClick={(e) => {
        // Ignore clicks if the user dragged the canvas more than 10 pixels
        if (dragDistance.current > 10) {
          e.preventDefault();
          return;
        }

        if (onSelectProject) {
          onSelectProject(item.project);
          return;
        }

        const camera = getCamera?.();
        if (camera) {
          saveCameraState(camera, item.project.slug, item.key);
        }

        // Prepare shared element transition: set view-transition-name on
        // this card's inner media div so the browser morphs it to the
        // detail page cover during the View Transition slide.
        if (transitionElementRef.current) {
          prepareProjectCoverTransition(transitionElementRef.current);
        }

        router.push(buildTenantProjectDetailHref(pathname, item.project.slug));
      }}
      onPointerEnter={() => onHoverChange?.(item.project)}
      onPointerLeave={() => onHoverChange?.(null)}
    >
      <div
        ref={transitionElementRef}
        className="relative h-full w-full overflow-hidden bg-black/5"
        style={{
          ...innerMediaStyle,
          // Back navigation: browser needs this name on the new page snapshot
          // to morph from detail-page cover back to this canvas card.
          ...(isTransitionTarget ? { viewTransitionName: PROJECT_COVER_TRANSITION_NAME } : {}),
        }}
        {...(isTransitionTarget ? { [PROJECT_COVER_TRANSITION_ATTRIBUTE]: '' } : {})}
      >
        {isVideo ? (
          <video
            ref={(element) => registerVideoRef(item.key, element)}
            data-src={coverUrl}
            poster={posterUrl}
            muted
            loop
            playsInline
            preload="none"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <Image
            src={coverUrl}
            alt={item.project.title}
            fill
            className="pointer-events-none absolute inset-0 object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 700px"
            priority={isPriority}
            loading={isPriority ? 'eager' : 'lazy'}
            fetchPriority={isPriority ? 'high' : 'auto'}
          />
        )}

        <div className="pointer-events-none absolute inset-0 bg-black/[0.02] transition-colors duration-300 group-hover:bg-black/[0.06]" />
        <div className="ring-white/12 pointer-events-none absolute inset-0 ring-1 ring-inset transition-all duration-300 group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_16px_40px_rgba(0,0,0,0.12)] group-hover:ring-white/45" />
      </div>
    </div>
  );
}

export const CanvasCard = memo(CanvasCardInner, (prevProps, nextProps) => {
  return (
    prevProps.item.key === nextProps.item.key &&
    prevProps.isPriority === nextProps.isPriority &&
    prevProps.registerCardRef === nextProps.registerCardRef &&
    prevProps.registerVideoRef === nextProps.registerVideoRef &&
    prevProps.onHoverChange === nextProps.onHoverChange &&
    prevProps.isTransitionTarget === nextProps.isTransitionTarget &&
    prevProps.getCamera === nextProps.getCamera &&
    // Shallow compare style properties we care about
    prevProps.initialStyle?.opacity === nextProps.initialStyle?.opacity &&
    prevProps.initialStyle?.visibility === nextProps.initialStyle?.visibility &&
    prevProps.initialStyle?.transform === nextProps.initialStyle?.transform &&
    prevProps.initialStyle?.zIndex === nextProps.initialStyle?.zIndex &&
    prevProps.initialStyle?.filter === nextProps.initialStyle?.filter
  );
});

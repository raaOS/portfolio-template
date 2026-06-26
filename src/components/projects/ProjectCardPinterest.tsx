'use client';

import { useRef, type MouseEvent } from 'react';
import { Link } from 'next-view-transitions';
import { Project } from '@/types/projects';
import Media from '@/components/shared/Media';
import { resolvePreviewCover } from '@/lib/images';
import { Heart, Share2 } from 'lucide-react';
import { useImageProtection } from '@/hooks/useImageProtection';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizeText } from '@/lib/i18n/contentLocalization';
import {
  prepareProjectCoverTransition,
  type ProjectCoverTransitionOrigin,
} from '@/lib/projectCoverTransition';

interface ProjectCardPinterestProps {
  project: Project;
  priority?: boolean;
  eager?: boolean;
  videoEnabled?: boolean;
  interactive?: boolean;
  highlightedTag?: string;
  transitionOrigin?: ProjectCoverTransitionOrigin;
}

export default function ProjectCardPinterest({
  project,
  priority = false,
  eager = false,
  videoEnabled = true,
  interactive = true,
  highlightedTag,
  transitionOrigin,
  onClick,
}: ProjectCardPinterestProps & { onClick?: () => void }) {
  const { slug, title, tags, likes, shares } = project;
  const { locale } = useLanguage();
  const localizedTitle = localizeText(title, locale);
  const cover = resolvePreviewCover(project);
  const shouldAutoplay = videoEnabled && (project.autoplay ?? true);
  const { toast, handleContextMenu } = useImageProtection();
  const shouldEagerLoad = cover.kind === 'image' ? priority || eager : priority;
  const transitionElementRef = useRef<HTMLDivElement>(null);

  // Calculate aspect ratio for the image/video container
  const width = project.coverWidth || 800;
  const height = project.coverHeight && project.coverHeight > 0 ? project.coverHeight : 600;
  const ratio = width > 0 && height > 0 ? width / height : 4 / 3;

  // SMART TAG DISPLAY LOGIC:
  // This logic ensures that if the user is filtering by a specific tag (e.g., "Design"),
  // that specific tag is the one displayed on the card, rather than just the first tag
  // in the list. This provides better feedback to the user on why the card matches.
  // - If highlightedTag matches one of the project's tags -> Show it.
  // - Else -> Show the first tag (default).
  const displayTag =
    highlightedTag && tags?.some((t) => t.toLowerCase() === highlightedTag.toLowerCase())
      ? tags.find((t) => t.toLowerCase() === highlightedTag.toLowerCase())
      : tags?.[0];

  const Component: React.ElementType = onClick ? 'div' : interactive ? Link : 'div';
  const hrefProps = !onClick && interactive ? { href: `/projects/${slug}` } : {};
  const isInteractive = interactive || !!onClick;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (onClick || !interactive || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    if (transitionElementRef.current) {
      const sourceCard = transitionElementRef.current.closest(
        '[data-project-card]'
      ) as HTMLElement | null;
      prepareProjectCoverTransition(transitionElementRef.current, {
        origin: transitionOrigin,
        sourceCard,
      });
    }
  };

  return (
    <Component
      {...hrefProps}
      onClick={handleClick}
      onClickCapture={handleClickCapture}
      data-project-card
      className={`project-card relative z-0 mb-0 block md:mb-6 ${isInteractive ? 'group cursor-pointer hover:z-10' : ''}`}
    >
      {/* Outer: scale saja (tanpa overflow-hidden agar rounded tidak hilang saat hover)
                Inner: overflow-hidden + rounded untuk clip gambar */}
      <div
        className={`backface-hidden relative transform-gpu transition-transform duration-300 ${isInteractive ? 'hover:scale-[1.02]' : ''}`}
        style={{ aspectRatio: ratio }}
        onContextMenu={handleContextMenu}
      >
        <div
          ref={transitionElementRef}
          className="absolute inset-0 overflow-hidden rounded-none bg-neutral-200 dark:bg-neutral-900"
        >
          <Media
            kind={cover.kind}
            src={cover.src}
            poster={cover.poster}
            posterPriority={cover.kind === 'video' ? priority : undefined}
            eager={shouldEagerLoad}
            alt={localizedTitle}
            // Optimized: Request 256px for thumbnails (closer to actual display size ~170-200px)
            width={256}
            height={Math.round(256 / ratio)}
            priority={cover.kind === 'image' ? priority : false}
            lazy={!shouldEagerLoad}
            quality={75}
            autoplay={shouldAutoplay}
            muted={project.muted ?? true}
            loop={project.loop ?? true}
            playsInline={project.playsInline ?? true}
            className="h-full w-full object-cover"
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
          />
        </div>

        {/* Overlay hitam solid menutupi seluruh gambar saat right-click */}
        {toast && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-none bg-black">
            <span className="text-3xl">{toast.emoji}</span>
            <p className="px-3 text-center text-xs font-bold leading-snug text-white">
              {toast.text}
            </p>
          </div>
        )}
      </div>

      {/* Project Info */}
      <div className="mt-3 hidden space-y-1 px-1 md:block">
        <div className="flex items-baseline justify-between gap-4">
          <p className="truncate text-sm font-medium leading-tight text-gray-900 transition-colors group-hover:text-indigo-600 group-active:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-400 dark:group-active:text-indigo-300">
            {localizedTitle}
          </p>
          {displayTag && (
            <p className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {displayTag}
            </p>
          )}
        </div>

        {/* Metrics bar */}
        <div className="flex items-center gap-3 text-gray-500">
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3 fill-current text-rose-500" />
            <span className="text-[10px] font-medium">{likes || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Share2 className="h-3 w-3 text-sky-500" />
            <span className="text-[10px] font-medium">{shares || 0}</span>
          </div>
        </div>
      </div>
    </Component>
  );
}

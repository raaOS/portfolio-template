import React, { useState, useEffect, useRef } from 'react';
import { m, useMotionValue, type PanInfo, type Transition } from 'motion/react';
import Image from 'next/image';
import { soundManager } from '../../utils/SoundManager';
import type { DesktopIconSize } from '@/types/about';

interface DesktopIconProps {
  id: string;
  label: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  videoUrl?: string;
  onClick: () => void;
  x?: number;
  y?: number;
  size?: DesktopIconSize;
  aspectRatio?: number;
  children?: React.ReactNode;
  priority?: boolean;
  isMobile?: boolean;
  onPositionChange?: (id: string, x: number, y: number) => void;
  onFocus?: () => void;
  onSizeChange?: (size: DesktopIconSize) => void;

  isSelected?: boolean;
  onDoubleClick?: (e: React.MouseEvent) => void;
  activeScale?: number;
  activeTransition?: Transition;
}

export default function DesktopIcon({
  id,
  label,
  icon,
  imageUrl,
  videoUrl,
  onClick,
  x = 0,
  y = 0,
  size = 'medium',
  aspectRatio = 1,
  children,
  priority = false,
  isMobile = false,
  onPositionChange,
  onFocus,
  onSizeChange,

  isSelected = false,
  onDoubleClick,
  activeScale = 1,
  activeTransition,
}: DesktopIconProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [failedVideoUrl, setFailedVideoUrl] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewTimerRef = useRef<number | null>(null);
  const imageError = Boolean(imageUrl && failedImageUrl === imageUrl);
  const videoError = Boolean(videoUrl && failedVideoUrl === videoUrl);

  // Handle video playback on hover
  useEffect(() => {
    if (videoRef.current) {
      if (hovering && previewActive && !isMobile) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        // videoRef.current.currentTime = 0; // Optional: reset to start
      }
    }
  }, [hovering, previewActive, isMobile]);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== null) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  // Motion Values for smooth coordinate handling (avoids jump on drag end)
  const iconX = useMotionValue(x);
  const iconY = useMotionValue(y);

  const [isDragging, setIsDragging] = useState(false);

  const requestSizeStep = (direction: 1 | -1) => {
    if (!onSizeChange) return;
    const sizes: DesktopIconSize[] = ['small', 'medium', 'large'];
    const currentIndex = sizes.indexOf(size);
    const nextIndex = Math.max(0, Math.min(sizes.length - 1, currentIndex + direction));
    const nextSize = sizes[nextIndex];
    if (nextSize !== size) onSizeChange(nextSize);
  };

  // Sync MotionValues with props when parent updates them (e.g. initial load or reset)
  useEffect(() => {
    if (isDragging) return; // Don't snap back mid-drag
    iconX.set(x);
    iconY.set(y);
  }, [x, y, iconX, iconY, isDragging]);

  const baseHeight = {
    small: isMobile ? 58 : 64, // ~10% smaller
    medium: isMobile ? 72 : 80, // ~10% smaller
    large: isMobile ? 86 : 96, // ~10% smaller
  }[size];

  const handleDragStart = () => {
    setIsDragging(true);
    soundManager.play('drag');
  };

  const handleDragEnd = (info: PanInfo) => {
    setTimeout(() => setIsDragging(false), 50); // Small delay to prevent click firing immediately after drag

    if (onPositionChange) {
      onPositionChange(id, info.offset.x, info.offset.y);

      // Instantly reset motion values to avoid double-jump jitter
      // The parent will re-render with new left/top immediately.
      iconX.set(x);
      iconY.set(y);
    }
  };

  const clearPreviewTimer = () => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (isMobile) return;
    setHovering(true);
    clearPreviewTimer();
    previewTimerRef.current = window.setTimeout(() => {
      setPreviewActive(true);
      previewTimerRef.current = null;
    }, 160);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    clearPreviewTimer();
    setPreviewActive(false);
    setHovering(false);
  };

  const hasImage = Boolean(imageUrl && !imageError);
  const hasVideo = Boolean(videoUrl && !videoError);
  const shouldRenderVideo = Boolean(hasVideo && !isMobile && (previewActive || !hasImage));
  const showMedia = hasImage || hasVideo;

  return (
    <m.div
      drag={!isMobile} // Hanya bisa di-drag di Desktop (mouse), di HP matikan agar mudah di-tap
      dragMomentum={false}
      dragElastic={0.05}
      onDragStart={handleDragStart}
      onDragEnd={(_e, info) => {
        handleDragEnd(info);
      }}
      data-lenis-prevent
      onClick={(_e) => {
        if (!isDragging) {
          soundManager.play('click');
          onClick();
        }
      }}
      onDoubleClick={(e) => {
        if (!isDragging && onDoubleClick) {
          onDoubleClick(e);
        }
      }}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        x: iconX,
        y: iconY,
      }}
      layout={false}
      className={`group pointer-events-auto flex w-auto cursor-pointer flex-col items-center gap-1 rounded-none outline-none will-change-transform ${isSelected ? 'z-50' : 'z-auto'}`}
      role="button"
      aria-label={label}
      tabIndex={0}
      onPointerDown={() => {
        onFocus?.();
      }}
      onFocus={() => {
        onFocus?.();
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
          e.preventDefault();
          onFocus?.();
          requestSizeStep(1);
          return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
          e.preventDefault();
          onFocus?.();
          requestSizeStep(-1);
          return;
        }

        if ((e.key === 'Enter' || e.key === ' ') && !isDragging) {
          e.preventDefault();
          soundManager.play('click');
          onClick();
        }
      }}
      onMouseEnter={() => {
        handleMouseEnter();
      }}
      onMouseLeave={() => {
        handleMouseLeave();
      }}
    >
      {/* Icon Media Wrapper - Only this part scales during open/close animations */}
      <m.div
        animate={{ scale: activeScale }}
        transition={activeTransition}
        style={{ transformOrigin: 'center center' }}
        className="relative"
      >
        {children ? (
          <div
            className={`relative transition-transform duration-200 ${isSelected ? 'scale-[1.05]' : ''}`}
          >
            {children}
          </div>
        ) : showMedia ? (
          <div
            style={{
              height: baseHeight,
              width: baseHeight * aspectRatio,
              minWidth: baseHeight * aspectRatio,
              minHeight: baseHeight,
            }}
            className={`relative overflow-hidden rounded-none bg-white/20 transition-transform duration-200 ${isSelected ? 'scale-[1.02]' : ''}`}
          >
            {/* Always render Image as base layer if available and not error */}
            {imageUrl && !imageError && (
              <Image
                src={imageUrl}
                alt={label}
                fill
                className={`pointer-events-none object-cover transition-opacity duration-300 ${shouldRenderVideo ? 'opacity-0' : 'opacity-100'}`}
                sizes="(max-width: 768px) 96px, 128px"
                draggable={false}
                onError={() => setFailedImageUrl(imageUrl ?? '__missing__')}
                priority={priority} // Important for LCP
                loading="eager"
                fetchPriority={priority ? 'high' : 'auto'}
                quality={60} // Thumbnails don't need 100% quality
              />
            )}

            {/* Render preview video only while it is useful to avoid metadata churn on idle icons. */}
            {shouldRenderVideo && (
              <video
                ref={videoRef}
                src={videoUrl + '#t=0.1'}
                muted
                loop
                playsInline
                preload="metadata"
                className={`pointer-events-none absolute inset-0 h-full w-full rounded-none object-cover transition-opacity duration-300 ${!hovering && imageUrl && !imageError ? 'opacity-0' : 'opacity-100'}`}
                draggable={false}
                onError={() => setFailedVideoUrl(videoUrl ?? '__missing__')}
              />
            )}

            {/* Show simple loading/placeholder if everything fails */}
            {imageError && (!videoUrl || videoError) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/20">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  No Media
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-none bg-white/20 transition-colors group-hover:bg-white/30">
            <div className="text-black/80 transition-colors group-hover:text-black">{icon}</div>
          </div>
        )}
      </m.div>

      {/* Label with macOS-style selection */}
      <div className="relative mt-1 rounded-[4px] px-2 py-0.5 transition-transform duration-200 group-active:scale-95">
        {/* Background for contrast */}
        <div
          className={`absolute inset-0 rounded-[4px] transition-colors transition-opacity duration-200 ${
            isSelected
              ? 'bg-[rgba(0,122,255,0.85)] opacity-100'
              : 'bg-black/30 opacity-100 backdrop-blur-[2px]'
          }`}
        />

        {/* Label Text */}
        <span className="relative block max-w-[80px] select-none truncate text-center text-[11px] font-medium leading-tight text-white transition-colors duration-200">
          {label}
        </span>
      </div>
    </m.div>
  );
}

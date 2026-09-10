'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, forwardRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getProxiedUrl } from '@/lib/utils';
import { sharedMediaObserver } from '../utils/MediaObserver';

export type MediaVideoProps = {
  src: string;
  alt?: string;
  poster?: string;
  posterPriority?: boolean;
  eager?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  blurDataURL?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  controls?: boolean;
  lazy?: boolean;
  quality?: number;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
};

const generateBlurDataURL = (_width: number = 8, _height: number = 6): string => {
  return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAGAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';
};

const MediaVideo = forwardRef<HTMLVideoElement, MediaVideoProps>(
  (
    {
      src,
      alt = '',
      poster,
      posterPriority,
      eager = false,
      className,
      sizes,
      priority = false,
      width = 1600,
      height = 1000,
      blurDataURL,
      autoplay = true,
      muted = true,
      loop = true,
      playsInline = true,
      controls = false,
      lazy = false,
      quality,
      objectFit = 'cover',
    },
    ref
  ) => {
    const pathname = usePathname();
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);
    const [canPlay, setCanPlay] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [shouldLoad, setShouldLoad] = useState(!lazy);
    const [isMounted, setIsMounted] = useState(false);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    // Mute state ditarik dari props ke local state supaya saat user pakai
    // controls untuk unmute (atau saat caller minta muted=false eksplisit),
    // kita tidak overwrite preferensi user setiap re-render.
    const [isMuted, setIsMuted] = useState(autoplay ? true : muted);
    // Track manual interaction supaya autoplay logic tidak menimpa user yang
    // sudah pause / unmute via native controls.
    const userInteractedRef = useRef(false);
    const [isMobile, setIsMobile] = useState(() => {
      if (typeof window !== 'undefined') return window.innerWidth < 768;
      return false;
    });

    const manualPlayRef = useRef(false);
    const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const effectivePosterPriority = posterPriority ?? priority;
    const shouldLoadPosterEagerly = effectivePosterPriority || eager;

    useEffect(() => {
      let timeoutId: ReturnType<typeof setTimeout>;
      const checkMobile = () => {
        const mobile = window.innerWidth < 768;
        setIsMobile((prev) => (prev === mobile ? prev : mobile));
      };
      const debouncedResize = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(checkMobile, 150);
      };
      window.addEventListener('resize', debouncedResize);
      return () => {
        window.removeEventListener('resize', debouncedResize);
        clearTimeout(timeoutId);
      };
    }, []);

    useEffect(() => {
      requestAnimationFrame(() => setIsMounted(true));
      return () => setIsMounted(false);
    }, []);

    const setVideoRef = useCallback(
      (node: HTMLVideoElement | null) => {
        internalVideoRef.current = node;
        if (!ref) return;
        if (typeof ref === 'function') ref(node);
        else (ref as React.MutableRefObject<HTMLVideoElement | null>).current = node;
      },
      [ref]
    );

    const effectiveAutoplay = autoplay && shouldLoad;

    const playIfPossible = useCallback(() => {
      if (!effectiveAutoplay) return;
      // Hormati pause manual dari user — jangan paksa play lagi dari intersection
      // observer / pathname change kalau user sudah interact dengan controls.
      if (userInteractedRef.current) return;
      const el = internalVideoRef.current;
      if (!el || !el.isConnected) return;
      if (isMuted) {
        el.muted = true;
        el.defaultMuted = true;
      }
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          if (error.name !== 'AbortError' && error.name !== 'NotSupportedError') {
            setAutoplayBlocked(true);
          }
        });
      }
    }, [effectiveAutoplay, isMuted]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      let isPlaying = false;
      const handleIntersect = (entry: IntersectionObserverEntry) => {
        if (entry.isIntersecting) {
          if (!shouldLoad && !loadTimerRef.current) {
            const jitter = Math.random() * 200;
            loadTimerRef.current = setTimeout(() => {
              setShouldLoad(true);
            }, 100 + jitter);
          }
          if (entry.intersectionRatio > 0 && effectiveAutoplay) {
            if (!isPlaying && internalVideoRef.current) {
              isPlaying = true;
              playIfPossible();
            }
          }
        } else {
          if (loadTimerRef.current) {
            clearTimeout(loadTimerRef.current);
            loadTimerRef.current = null;
          }
          if (isPlaying && internalVideoRef.current) {
            isPlaying = false;
            // Hanya pause kalau bukan user-controlled — kalau user sedang nonton
            // dengan controls dan scroll sebentar, jangan ganggu sesi mereka.
            if (!userInteractedRef.current) {
              internalVideoRef.current.pause();
            }
          }
        }
      };
      sharedMediaObserver.observe(el, handleIntersect);
      return () => {
        sharedMediaObserver.unobserve(el);
        if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      };
    }, [effectiveAutoplay, shouldLoad, playIfPossible]);

    useEffect(() => {
      if (!isMounted || !effectiveAutoplay) return;
      const t = setTimeout(playIfPossible, 200);
      return () => clearTimeout(t);
    }, [isMounted, effectiveAutoplay, playIfPossible]);

    useEffect(() => {
      if (effectiveAutoplay && document.visibilityState === 'visible') playIfPossible();
    }, [pathname, effectiveAutoplay, playIfPossible]);

    // Jika caller toggle prop muted (mis. parent state), sinkronkan ke local
    // state — kecuali user sudah interact (dia yang pegang kendali).
    useEffect(() => {
      if (userInteractedRef.current) return;
      setIsMuted(autoplay ? true : muted);
    }, [autoplay, muted]);

    // Manual play handler dari overlay button. Saat overlay di-click berarti
    // user sudah interact secara eksplisit.
    const handleManualPlay = useCallback(() => {
      userInteractedRef.current = true;
      if (!shouldLoad) {
        manualPlayRef.current = true;
        setShouldLoad(true);
        return;
      }
      const el = internalVideoRef.current;
      if (!el) return;
      setAutoplayBlocked(false);
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Last-resort: kalau browser masih blokir, biarkan dia mute lalu retry.
          el.muted = true;
          setIsMuted(true);
          el.play().catch(() => {
            /* give up silently */
          });
        });
      }
    }, [shouldLoad]);

    // Saat video native controls di-pakai, set userInteracted supaya logic
    // autoplay re-arm tidak mengganggu pause / mute toggle.
    const markUserInteraction = useCallback(() => {
      userInteractedRef.current = true;
    }, []);

    return (
      <div ref={containerRef} className="relative h-full w-full bg-neutral-200 dark:bg-neutral-900">
        <video
          ref={setVideoRef}
          // When controls are disabled (e.g. background/card/preview video), disable pointer events
          // so clicks propagate cleanly to parent cards, links, and triggers.
          className={`${className || 'h-full w-full object-cover'} ${!controls || (autoplayBlocked && !canPlay) ? 'pointer-events-none' : ''}`}
          src={shouldLoad ? getProxiedUrl(src) : undefined}
          aria-label={controls ? alt || 'Video content' : undefined}
          title={controls ? alt || 'Video content' : undefined}
          aria-hidden={!controls ? 'true' : undefined}
          tabIndex={!controls ? -1 : undefined}
          autoPlay={effectiveAutoplay}
          // @ts-expect-error - fetchPriority attribute exists in modern browsers
          fetchPriority={priority ? 'high' : 'auto'}
          muted={isMuted}
          loop={loop}
          playsInline={playsInline}
          controls={controls}
          // Performance: poster image sudah dirender di atas; metadata cukup
          // untuk progress bar. Fallback ke "none" saat lazy & belum visible.
          preload={shouldLoad ? 'metadata' : 'none'}
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5"
          onCanPlay={() => {
            setCanPlay(true);
            setHasError(false);
            if (manualPlayRef.current) {
              playIfPossible();
              manualPlayRef.current = false;
            } else if (effectiveAutoplay && !userInteractedRef.current) {
              playIfPossible();
            }
          }}
          onLoadStart={() => {
            setHasError(false);
          }}
          onError={() => {
            setHasError(true);
          }}
          onPlay={() => {
            setCanPlay(true);
            setAutoplayBlocked(false);
            setHasError(false);
          }}
          onPause={markUserInteraction}
          onVolumeChange={() => {
            const el = internalVideoRef.current;
            if (!el) return;
            // User toggle mute via native controls — sync state.
            if (el.muted !== isMuted) {
              userInteractedRef.current = true;
              setIsMuted(el.muted);
            }
          }}
        />

        {poster && (
          <div
            className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${canPlay ? 'opacity-0' : 'opacity-100'}`}
          >
            <Image
              src={getProxiedUrl(poster)}
              alt={alt}
              unoptimized={true}
              width={width}
              height={height}
              priority={effectivePosterPriority}
              loading={shouldLoadPosterEagerly ? 'eager' : 'lazy'}
              fetchPriority={effectivePosterPriority ? 'high' : 'auto'}
              sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
              className={className || 'h-full w-full object-cover'}
              placeholder="blur"
              blurDataURL={blurDataURL || generateBlurDataURL()}
              quality={quality || 75}
              style={{
                objectFit: objectFit,
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        )}

        {((autoplayBlocked && !hasError) || ((isMobile as boolean) && !shouldLoad)) && (
          <div
            className="group absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/40 transition-colors hover:bg-black/50"
            onClick={(e) => {
              e.stopPropagation();
              handleManualPlay();
            }}
          >
            <div
              className={`rounded-full bg-white/95 shadow-2xl transition-transform ${shouldLoad ? 'p-5 group-hover:scale-110' : 'scale-110 p-6'}`}
            >
              <svg
                className={`${shouldLoad ? 'h-12 w-12' : 'h-16 w-16'} text-black`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-200 p-4 text-center text-gray-400 dark:bg-neutral-900">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">
              {alt || 'Media Unavailable'}
            </span>
          </div>
        )}
      </div>
    );
  }
);

MediaVideo.displayName = 'MediaVideo';
export default MediaVideo;

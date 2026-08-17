'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useOptimistic,
  useTransition,
  startTransition,
} from 'react';
import type { Project, GalleryGroup } from '@/types/projects';
import type { Comment } from '@/lib/magic';
import { collectProjectTranslationFields } from '../utils/translations';

interface UseProjectDetailProps {
  project: Project;
  siteId?: string;
}

interface ProjectMetrics {
  likes: number;
  shares: number;
}

interface MetricsMutationResponse {
  success?: boolean;
  metrics?: ProjectMetrics;
  error?: string;
}

interface OptimisticLikeState {
  isLiked: boolean;
  likes: number;
}

interface UseProjectDetailReturn {
  // States
  comments: Comment[];
  setComments: (comments: Comment[]) => void;
  isProjectLiked: boolean;
  setIsProjectLiked: (liked: boolean) => void;
  metrics: ProjectMetrics;
  setMetrics: React.Dispatch<React.SetStateAction<ProjectMetrics>>;
  isLikePending: boolean;
  translations: Record<string, string> | null;
  setTranslations: (translations: Record<string, string> | null) => void;
  translateLoading: boolean;
  activeGalleryGroup: GalleryGroup | null;
  setActiveGalleryGroup: (group: GalleryGroup | null) => void;
  activeNarrativeTab: 'challenge' | 'solution' | 'impact';
  setActiveNarrativeTab: (tab: 'challenge' | 'solution' | 'impact') => void;
  observerTarget: React.RefObject<HTMLDivElement | null>;

  // Actions
  handleProjectLike: () => Promise<void>;
  handleProjectShare: () => Promise<void>;
  translateAll: () => Promise<void>;
}

function isInterruptedFetch(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || /failed to fetch/i.test(error.message);
}

export function useProjectDetail({ project, siteId = 'default-site' }: UseProjectDetailProps): UseProjectDetailReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isProjectLiked, setIsProjectLiked] = useState(false);
  const [metrics, setMetrics] = useState({ likes: 0, shares: 0 });
  const [isLikePending, startLikeTransition] = useTransition();
  const likeRequestInFlightRef = useRef(false);
  const committedLikeState = useMemo(
    () => ({ isLiked: isProjectLiked, likes: metrics.likes }),
    [isProjectLiked, metrics.likes]
  );
  const [optimisticLikeState, updateOptimisticLike] = useOptimistic<OptimisticLikeState, boolean>(
    committedLikeState,
    (current, nextIsLiked) => ({
      isLiked: nextIsLiked,
      likes:
        nextIsLiked === current.isLiked
          ? current.likes
          : nextIsLiked
            ? current.likes + 1
            : Math.max(0, current.likes - 1),
    })
  );
  const [, setIsLoaded] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string> | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const CACHE_KEY = `ai_proj_v2_${siteId}_${project.slug}`;

  const [activeGalleryGroup, setActiveGalleryGroup] = useState<GalleryGroup | null>(null);
  const [activeNarrativeTab, setActiveNarrativeTab] = useState<'challenge' | 'solution' | 'impact'>(
    'challenge'
  );

  const observerTarget = useRef<HTMLDivElement>(null);

  // Restore cached translations on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        startTransition(() => {
          setTranslations(JSON.parse(cached));
        });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.slug]);

  const translateAll = useCallback(async () => {
    if (translations) {
      setTranslations(null);
      return;
    } // toggle off (cache stays)

    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setTranslations(JSON.parse(cached));
        return;
      }
    } catch {
      /* ignore */
    }

    setTranslateLoading(true);
    try {
      const fields = collectProjectTranslationFields(project);
      if (Object.keys(fields).length === 0) return;

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (res.ok && data.translations) {
        setTranslations(data.translations);
        // Cache to localStorage
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data.translations));
        } catch {
          /* ignore */
        }
      } else {
        console.warn('[useProjectDetail] Translation failed:', data.error || res.statusText);
      }
    } catch (error) {
      console.warn('[useProjectDetail] Translation failed:', error);
    } finally {
      setTranslateLoading(false);
    }
  }, [project, translations, CACHE_KEY]);

  // Load like status immediately (local storage only)
  useEffect(() => {
    // BUG FIX #6: try-catch untuk localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedLike = localStorage.getItem(`like-${siteId}-${project.slug}`);
        if (savedLike === 'true') {
          requestAnimationFrame(() => setIsProjectLiked(true));
        }
      } catch (e) {
        console.warn('[useProjectDetail] Failed to load like status:', e);
      }
    }
    requestAnimationFrame(() => setIsLoaded(true));
  }, [project.slug, siteId]);

  // Defer non-critical API calls to improve initial load time
  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const timer = setTimeout(async () => {
      try {
        const [metricsRes, commentsRes] = await Promise.all([
          fetch(`/api/metrics?slug=${encodeURIComponent(project.slug)}&siteId=${encodeURIComponent(siteId)}`, { signal: controller.signal }),
          fetch(`/api/comments?slug=${encodeURIComponent(project.slug)}&siteId=${encodeURIComponent(siteId)}`, { signal: controller.signal }),
        ]);

        if (!isActive) return;

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }

        if (commentsRes.ok) {
          const commentsData = await commentsRes.json();
          const loadedComments = commentsData?.data?.comments ?? commentsData?.comments;
          if (Array.isArray(loadedComments)) {
            setComments(loadedComments);
          }
        }
      } catch (error) {
        if (!isActive || controller.signal.aborted || isInterruptedFetch(error)) return;
        console.warn('[useProjectDetail] Failed to load non-critical project data:', error);
      }
    }, 1500); // Defer 1.5s to prioritize first paint

    return () => {
      isActive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [project.slug, siteId]);

  const handleProjectLike = useCallback(async () => {
    if (likeRequestInFlightRef.current) return;

    likeRequestInFlightRef.current = true;
    const nextIsLiked = !optimisticLikeState.isLiked;

    await new Promise<void>((resolve) => {
      startLikeTransition(async () => {
        updateOptimisticLike(nextIsLiked);

        try {
          const response = await fetch('/api/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: project.slug,
              siteId,
              action: nextIsLiked ? 'like' : 'unlike',
            }),
          });
          const data = (await response.json().catch(() => null)) as MetricsMutationResponse | null;
          const serverMetrics = data?.metrics;

          if (
            !response.ok ||
            data?.success !== true ||
            !serverMetrics ||
            !Number.isFinite(serverMetrics.likes) ||
            !Number.isFinite(serverMetrics.shares)
          ) {
            throw new Error(data?.error || `Metrics request failed (${response.status})`);
          }

          startTransition(() => {
            setIsProjectLiked(nextIsLiked);
            setMetrics(serverMetrics);
          });

          try {
            localStorage.setItem(`like-${siteId}-${project.slug}`, String(nextIsLiked));
          } catch (error) {
            console.warn('[useProjectDetail] Failed to save like status:', error);
          }
        } catch (error) {
          console.error('[useProjectDetail] Failed to update like metric:', error);
        } finally {
          likeRequestInFlightRef.current = false;
          resolve();
        }
      });
    });
  }, [optimisticLikeState.isLiked, project.slug, siteId, startLikeTransition, updateOptimisticLike]);

  const handleProjectShare = async () => {
    setMetrics((prev) => ({ ...prev, shares: prev.shares + 1 }));
    // Fire-and-log: kirim metrics share ke server, tapi jangan blokir UI.
    // Gunakan .catch() agar rejection tidak menjadi unhandled promise rejection
    // (sebelumnya fetch() tanpa await + catch kosong sync = reject tertelan diam-diam).
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: project.slug, siteId, action: 'share' }),
      keepalive: true,
    }).catch((error) => {
      console.error('[useProjectDetail] Failed to record share metric:', error);
    });

    if (navigator.share) {
      navigator
        .share({
          title: project.title,
          text: project.description,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return {
    comments,
    setComments,
    isProjectLiked: optimisticLikeState.isLiked,
    setIsProjectLiked,
    metrics: { ...metrics, likes: optimisticLikeState.likes },
    setMetrics,
    isLikePending,
    translations,
    setTranslations,
    translateLoading,
    activeGalleryGroup,
    setActiveGalleryGroup,
    activeNarrativeTab,
    setActiveNarrativeTab,
    observerTarget,
    handleProjectLike,
    handleProjectShare,
    translateAll,
  };
}

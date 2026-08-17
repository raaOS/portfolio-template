'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useDictionary } from '@/contexts/LanguageContext';
import { useMusicPlayer, MusicTrack } from '@/contexts/MusicPlayerContext';
import {
  closedPopoverWidth,
  getPopoverTransition,
  getPopoverExitTransition,
  getPopoverContentVariants,
} from './animations';
import { getTrackArtwork as getTrackArtworkUtil } from './utils';
import MusicTrigger from './MusicTrigger';
import SearchMode from './SearchMode';
import PlayerMode from './PlayerMode';

type MusicSearchResponse = {
  results?: MusicTrack[];
};

export default function MusicPlayerWidget() {
  const t = useDictionary();
  const prefersReducedMotion = useReducedMotion();
  const {
    tracks,
    currentTrack,
    isPlaying,
    position,
    duration,
    progress,
    toggle,
    next,
    previous,
    selectTrack,
    selectCustomTrack,
    isLooping,
    isShuffling,
    toggleLoop,
    toggleShuffle,
  } = useMusicPlayer();

  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'init' | 'results' | 'player'>('init');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [direction, setDirection] = useState<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [thumbnailErrorTrackId, setThumbnailErrorTrackId] = useState<string | null>(null);

  const trimmedSearchQuery = searchQuery.trim();
  const isSearchMode = trimmedSearchQuery.length > 0;
  const hasSearchResults = isSearchMode && searchResults.length > 0;
  const visibleTracks = isSearchMode ? searchResults : tracks;
  
  const activeIndex = useMemo(() => {
    if (visibleTracks.length === 0) return -1;
    const matchingIndex = currentTrack
      ? visibleTracks.findIndex((track) => track.id === currentTrack.id)
      : -1;
    return matchingIndex >= 0 ? matchingIndex : 0;
  }, [currentTrack, visibleTracks]);
  
  const activeTrack = activeIndex >= 0 ? visibleTracks[activeIndex] : currentTrack;
  const activeArtwork = getTrackArtworkUtil(activeTrack);
  const activeArtworkFailed = Boolean(activeTrack?.id && thumbnailErrorTrackId === activeTrack.id);
  const isActiveTrackPlaying = Boolean(isPlaying && activeTrack && currentTrack?.id === activeTrack.id);
  const activeProgress = activeTrack && currentTrack?.id === activeTrack.id ? progress : 0;
  const activeDuration = activeTrack && currentTrack?.id === activeTrack.id ? duration : activeTrack?.duration || duration;
  const titleText = activeTrack?.title || t.music.idle;
  const artistText = activeTrack?.artist || 'Portfolio OS';

  const popoverSize = useMemo(
    () => ({
      width: viewMode === 'init' ? 300 : viewMode === 'results' ? 360 : 320,
      height: viewMode === 'init' ? (currentTrack ? 136 : 68) : 380,
    }),
    [currentTrack, viewMode]
  );

  const popoverTransition = getPopoverTransition(!!prefersReducedMotion);
  const popoverExitTransition = getPopoverExitTransition(!!prefersReducedMotion);
  const popoverContentVariants = getPopoverContentVariants(!!prefersReducedMotion);

  const resetWidgetState = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setViewMode('init');
    setSelectedTrackId(null);
  }, []);

  const closeWidget = useCallback(() => {
    resetWidgetState();
    setIsOpen(false);
  }, [resetWidgetState]);

  useEffect(() => {
    if (!trimmedSearchQuery) return;

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(trimmedSearchQuery)}`);
        const data = (await res.json()) as MusicSearchResponse;
        if (data.results) {
          setSearchResults(data.results);
          setViewMode('results');
        } else {
          setSearchResults([]);
          setViewMode('results');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [trimmedSearchQuery]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeWidget();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [closeWidget]);

  const handleTrackSelect = useCallback(
    (track: MusicTrack, index: number) => {
      setSelectedTrackId(track.id);
      if (hasSearchResults && selectCustomTrack) {
        selectCustomTrack(track, searchResults);
      } else {
        selectTrack(index);
      }
      setViewMode('player');
    },
    [hasSearchResults, searchResults, selectCustomTrack, selectTrack]
  );

  const handlePrimaryToggle = useCallback(() => {
    if (hasSearchResults && activeTrack && currentTrack?.id !== activeTrack.id && selectCustomTrack) {
      selectCustomTrack(activeTrack, searchResults);
      return;
    }
    toggle();
  }, [activeTrack, currentTrack?.id, hasSearchResults, searchResults, selectCustomTrack, toggle]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    if (!value.trim()) {
      setViewMode('init');
      setSearchResults([]);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setViewMode('init');
  }, []);

  const handleNext = useCallback(() => {
    setDirection(1);
    next();
  }, [next]);

  const handlePrevious = useCallback(() => {
    setDirection(-1);
    previous();
  }, [previous]);

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <MusicTrigger
        isOpen={isOpen}
        isPlaying={isPlaying}
        currentTrack={currentTrack}
        onToggle={(event) => {
          event.stopPropagation();
          if (isOpen) {
            closeWidget();
            return;
          }
          setIsOpen(true);
        }}
      />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label={t.music.nowPlaying}
            variants={{
              initial: {
                opacity: 0,
                width: prefersReducedMotion ? popoverSize.width : closedPopoverWidth,
                height: prefersReducedMotion ? popoverSize.height : closedPopoverWidth,
                filter: prefersReducedMotion ? 'blur(0px)' : 'blur(4px)',
                borderRadius: 20,
                pointerEvents: 'none',
              },
              animate: {
                opacity: 1,
                ...popoverSize,
                filter: 'blur(0px)',
                borderRadius: 20,
                pointerEvents: 'auto',
              },
              exit: {
                opacity: 0,
                width: prefersReducedMotion ? popoverSize.width : closedPopoverWidth,
                height: prefersReducedMotion ? popoverSize.height : closedPopoverWidth,
                filter: prefersReducedMotion ? 'blur(0px)' : 'blur(4px)',
                borderRadius: 20,
                pointerEvents: 'none',
                transition: popoverExitTransition,
              },
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={popoverTransition}
            style={{
              transformOrigin: 'right top',
              willChange: 'opacity, filter, width, height, border-radius',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
              WebkitFontSmoothing: 'antialiased',
            }}
            className="absolute right-0 top-full z-[1000] mt-2 overflow-hidden border border-zinc-200/50 bg-white/80 p-4 text-zinc-900 shadow-2xl shadow-black/15 backdrop-blur-2xl dark:border-zinc-800/50 dark:bg-zinc-950/80 dark:text-zinc-100 dark:shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <motion.div
              animate={{ width: popoverSize.width, height: popoverSize.height }}
              transition={popoverTransition}
              className="absolute right-0 top-0 p-4"
            >
              <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {activeArtwork && !activeArtworkFailed && (
                  <img
                    src={activeArtwork}
                    alt=""
                    onError={() => activeTrack?.id && setThumbnailErrorTrackId(activeTrack.id)}
                    className="absolute inset-0 h-full w-full scale-125 object-cover opacity-15 blur-3xl dark:opacity-25"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/50 to-zinc-100/50 dark:from-zinc-900/50 dark:to-zinc-950/50" />
              </motion.div>

              <motion.div className="relative flex h-full w-full flex-col" variants={popoverContentVariants}>
                <AnimatePresence mode="popLayout">
                  {viewMode !== 'player' ? (
                    <SearchMode
                      viewMode={viewMode}
                      searchQuery={searchQuery}
                      isSearching={isSearching}
                      visibleTracks={visibleTracks}
                      currentTrack={currentTrack}
                      activeTrack={activeTrack}
                      isActiveTrackPlaying={isActiveTrackPlaying}
                      activeProgress={activeProgress}
                      titleText={titleText}
                      artistText={artistText}
                      activeArtwork={activeArtwork}
                      activeArtworkFailed={activeArtworkFailed}
                      selectedTrackId={selectedTrackId}
                      onSearchChange={handleSearchChange}
                      onClearSearch={handleClearSearch}
                      onTrackSelect={handleTrackSelect}
                      onPrimaryToggle={handlePrimaryToggle}
                      onSetViewMode={setViewMode}
                      onSetSelectedTrackId={setSelectedTrackId}
                      onSetThumbnailErrorTrackId={setThumbnailErrorTrackId}
                    />
                  ) : (
                    <PlayerMode
                      currentTrack={currentTrack}
                      activeTrack={activeTrack}
                      direction={direction}
                      activeArtwork={activeArtwork}
                      activeArtworkFailed={activeArtworkFailed}
                      titleText={titleText}
                      artistText={artistText}
                      activeProgress={activeProgress}
                      position={position}
                      activeDuration={activeDuration}
                      isShuffling={isShuffling}
                      isLooping={isLooping}
                      isActiveTrackPlaying={isActiveTrackPlaying}
                      onSetViewMode={setViewMode}
                      onCloseWidget={closeWidget}
                      onSetThumbnailErrorTrackId={setThumbnailErrorTrackId}
                      onToggleShuffle={toggleShuffle}
                      onPrevious={handlePrevious}
                      onPrimaryToggle={handlePrimaryToggle}
                      onNext={handleNext}
                      onToggleLoop={toggleLoop}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

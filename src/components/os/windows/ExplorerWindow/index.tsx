// ═══════════════════════════════════════════════════════════════════
// SECTION MAP (ExplorerWindow/index.tsx — 666 lines)
// L1-29:    Imports, types
// L30-311:  ExplorerWindow component — state, tree loading, navigation
// L312-400: handleNodeClick, handleNodeDoubleClick — gesture detection
// L401-500: QuickLook modal (PDF viewer, Markdown renderer)
// L501-666: JSX render — sidebar tree, content grid, breadcrumbs
// ═══════════════════════════════════════════════════════════════════
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Search, Grid, RefreshCw, Home } from 'lucide-react';
import { m, AnimatePresence, type Variants } from 'motion/react';
import { ExplorerFormatBadge } from '@/components/ui/ExplorerFormatBadge';
import type { AnyExplorerNode, ExplorerFolder, ExplorerFile } from '@/types/explorer';
import type { ResolvedEventPage } from '@/types/event-page';
import {
  getExplorerActualFormat,
  getExplorerFileDisplayName,
  getExplorerNodeDisplayName,
} from '@/lib/utils/explorerName';
import MacFolder from '../MacFolder';
import { useDesktopWindowContext } from '../../context/DesktopWindowContext';
import type { GalleryItem } from '@/types/projects';

// Subcomponents
import EventLandingPage from './EventLandingPage';
import InlineFilePreview from './InlineFilePreview';
import FileThumbnail from './FileThumbnail';
import WindowImagePreview from './WindowImagePreview';

interface ExplorerWindowProps {
  initialParentId?: string | null;
  isAdmin?: boolean;
  onOpenFile?: (file: ExplorerFile) => void;
}

export default function ExplorerWindow({
  initialParentId = null,
  isAdmin: _isAdmin,
  onOpenFile,
}: ExplorerWindowProps) {
  // Single atomic state for the entire explorer view
  const [state, setState] = useState<{
    history: (string | null)[];
    historyIndex: number;
    displayedParentId: string | null;
    nodes: AnyExplorerNode[];
    pathNodes: ExplorerFolder[];
    isLoading: boolean;
  }>({
    history: [initialParentId],
    historyIndex: 0,
    displayedParentId: initialParentId,
    nodes: [],
    pathNodes: [],
    isLoading: true,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode] = useState<'grid'>('grid');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<ExplorerFile | null>(null);
  const [activeEventPage, setActiveEventPage] = useState<ResolvedEventPage | null>(null);
  const [eventPageLoadingId, setEventPageLoadingId] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isNavigatingRef = useRef(false);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxItems, setLightboxItems] = useState<GalleryItem[]>([]);

  const { setWindows, maximizeWindow, windows } = useDesktopWindowContext();
  const explorerWindow = windows.find((w) => w.id === 'explorer');
  const isMaximized = explorerWindow?.isMaximized || false;

  useEffect(() => {
    if (activeEventPage) {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id === 'explorer') {
            return {
              ...w,
              width: 720,
              height: 740,
            };
          }
          return w;
        })
      );
    } else {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id === 'explorer') {
            return {
              ...w,
              width: 900,
              height: 600,
            };
          }
          return w;
        })
      );
    }
  }, [activeEventPage, setWindows]);

  // Animation Variants
  const openEase = [0.16, 1, 0.3, 1] as const;
  const openTransition = { duration: 0.25, ease: openEase };

  const containerVariants: Variants = {
    hidden: { opacity: 0, scale: 0.98, y: 10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: openTransition,
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      y: 10,
      transition: { duration: 0.16, ease: openEase },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: openEase },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.12 },
    },
  };

  const { history, historyIndex, displayedParentId, nodes, pathNodes, isLoading } = state;
  const currentParentId = useMemo(() => history[historyIndex] ?? null, [history, historyIndex]);

  const fetchNodes = useCallback(async (parentId: string | null) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const effectiveId = parentId || 'root';
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(`/api/explorer?parentId=${effectiveId}&path=true&_t=${Date.now()}`, {
        signal: controller.signal,
      });
      const result = await res.json();

      if (result.success && !controller.signal.aborted) {
        setHasLoadedOnce(true);
        setState((prev) => ({
          ...prev,
          displayedParentId: parentId ?? null,
          nodes: result.data?.nodes || [],
          pathNodes: result.data?.path || [],
          isLoading: false,
        }));
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('[Explorer] Fetch failed:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Reset scroll only when the displayed folder actually changes.
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [displayedParentId, activeFile?.id, activeEventPage?.id]);

  // Effect to handle data fetching based on currentParentId
  useEffect(() => {
    const t = window.setTimeout(() => {
      fetchNodes(currentParentId);
    }, 0);
    return () => {
      window.clearTimeout(t);
      abortControllerRef.current?.abort();
    };
  }, [currentParentId, fetchNodes]);

  // Navigation actions
  const navigateTo = useCallback((id: string | null, addToHistory = true) => {
    if (isNavigatingRef.current) return;

    setActiveFile(null);
    setActiveEventPage(null);

    if (addToHistory) {
      isNavigatingRef.current = true;
      setSelectedNodeId(null);
      setState((prev) => {
        const currentPid = prev.history[prev.historyIndex] ?? null;
        if (currentPid === id) {
          isNavigatingRef.current = false;
          return prev;
        }
        const newHistory = prev.history.slice(0, prev.historyIndex + 1);
        newHistory.push(id);
        return {
          ...prev,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          isLoading: true,
        };
      });
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => {
        isNavigatingRef.current = false;
      }, 300);
    }
  }, []);

  const goBack = useCallback(() => {
    if (activeEventPage) {
      setActiveEventPage(null);
      return;
    }

    if (activeFile) {
      setActiveFile(null);
      return;
    }

    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    setSelectedNodeId(null);
    setState((prev) => {
      if (prev.historyIndex <= 0) {
        isNavigatingRef.current = false;
        return prev;
      }
      return {
        ...prev,
        historyIndex: prev.historyIndex - 1,
        isLoading: true,
      };
    });
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 300);
  }, [activeEventPage, activeFile]);

  const goForward = useCallback(() => {
    if (activeFile || activeEventPage) return;
    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    setSelectedNodeId(null);
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) {
        isNavigatingRef.current = false;
        return prev;
      }
      return {
        ...prev,
        historyIndex: prev.historyIndex + 1,
        isLoading: true,
      };
    });
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 300);
  }, [activeFile, activeEventPage]);

  // Cleanup navigation timeout on unmount
  useEffect(() => {
    return () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, []);

  // Derived filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) =>
      getExplorerNodeDisplayName(node).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [nodes, searchQuery]);

  const openEventPageForFolder = useCallback(async (folderId: string) => {
    setEventPageLoadingId(folderId);
    try {
      const res = await fetch(
        `/api/event-pages?folderId=${encodeURIComponent(folderId)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      const result = await res.json();
      const page = result.success ? result.data?.page : null;

      if (res.ok && page) {
        setActiveFile(null);
        setActiveEventPage(page);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('[Explorer] Failed to open event page:', error);
      return false;
    } finally {
      setEventPageLoadingId(null);
    }
  }, []);

  const handleNodeClick = (node: AnyExplorerNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    void handleNodeDoubleClick(node, e);
  };

  const handleNodeDoubleClick = useCallback(
    async (node: AnyExplorerNode, e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation();
      if (node.type === 'folder') {
        const openedEventPage = await openEventPageForFolder(node.id);
        if (openedEventPage) return;
        navigateTo(node.id);
      } else if (node.type === 'file') {
        setActiveEventPage(null);
        setActiveFile(node);
        onOpenFile?.(node);
      }
    },
    [navigateTo, onOpenFile, openEventPageForFolder]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (activeFile || activeEventPage)) {
        e.preventDefault();
        setActiveFile(null);
        setActiveEventPage(null);
        return;
      }

      // Space to preview
      if (e.code === 'Space' && selectedNodeId && !activeFile) {
        const node = nodes.find((n) => n.id === selectedNodeId);
        if (node && node.type === 'file') {
          e.preventDefault();
          setActiveFile(node as ExplorerFile);
        }
      }

      // Enter to open/navigate
      if (e.key === 'Enter' && selectedNodeId) {
        const node = nodes.find((n) => n.id === selectedNodeId);
        if (node) {
          e.preventDefault();
          void handleNodeDoubleClick(node);
        }
      }

      // Arrow keys navigation
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !activeFile) {
        e.preventDefault();
        const currentIndex = filteredNodes.findIndex((n) => n.id === selectedNodeId);
        let nextIndex = currentIndex;

        if (currentIndex === -1) {
          nextIndex = 0;
        } else {
          if (e.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
          if (e.key === 'ArrowRight')
            nextIndex = Math.min(filteredNodes.length - 1, currentIndex + 1);

          if (viewMode === 'grid' && contentRef.current) {
            const columns = Math.floor(contentRef.current.clientWidth / 120) || 1;
            if (e.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - columns);
            if (e.key === 'ArrowDown')
              nextIndex = Math.min(filteredNodes.length - 1, currentIndex + columns);
          }
        }

        const nextNode = filteredNodes[nextIndex];
        if (nextNode) setSelectedNodeId(nextNode.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeId,
    nodes,
    activeFile,
    activeEventPage,
    handleNodeDoubleClick,
    filteredNodes,
    viewMode,
  ]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#f6f6f6] font-sans text-gray-800 dark:bg-[#1a1a1a] dark:text-gray-200">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md dark:border-white/10 dark:bg-black/80">
        <div className="flex items-center gap-4">
          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              disabled={historyIndex <= 0 && !activeFile && !activeEventPage}
              onClick={goBack}
              className="p-1.5 text-gray-500 transition-all hover:text-gray-700 active:scale-95 active:text-[#03AC0E] disabled:opacity-20 dark:hover:text-gray-300 dark:active:text-[#03AC0E]"
              title="Back"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              disabled={!!activeFile || historyIndex >= history.length - 1}
              onClick={goForward}
              className="p-1.5 text-gray-500 transition-all hover:text-gray-700 active:scale-95 active:text-[#03AC0E] disabled:opacity-20 dark:hover:text-gray-300 dark:active:text-[#03AC0E]"
              title="Forward"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Breadcrumbs */}
          <div className="flex max-w-md items-center overflow-hidden text-xs font-medium text-gray-500">
            <button
              onClick={() => navigateTo(null)}
              className="flex shrink-0 items-center gap-1.5 hover:text-black dark:hover:text-white"
            >
              <Home size={14} /> Root
            </button>
            {pathNodes.map((node) => (
              <React.Fragment key={node.id}>
                <span className="mx-1 opacity-50">/</span>
                <button
                  onClick={() => navigateTo(node.id)}
                  className="truncate hover:text-black dark:hover:text-white"
                >
                  {node.name}
                </button>
              </React.Fragment>
            ))}
            {activeFile && (
              <>
                <span className="mx-1 opacity-50">/</span>
                <span className="truncate text-slate-900 dark:text-white">
                  {getExplorerFileDisplayName(activeFile)}
                </span>
              </>
            )}
            {activeEventPage && (
              <>
                <span className="mx-1 opacity-50">/</span>
                <span className="truncate text-slate-900 dark:text-white">
                  {activeEventPage.title}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={() => fetchNodes(currentParentId)}
            disabled={isLoading || !!activeFile || !!activeEventPage}
            className="flex items-center justify-center rounded p-1.5 text-gray-400 transition-all hover:text-black active:scale-90 dark:hover:text-white"
            title="Refresh folder content"
          >
            <RefreshCw size={16} className={isLoading ? 'origin-center animate-spin' : ''} />
          </button>

          {/* Search */}
          {!activeFile && !activeEventPage && (
            <div className="group relative hidden sm:block">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-32 rounded-md border border-transparent bg-black/5 py-1 pl-8 pr-3 text-xs outline-none transition-all focus:w-48 focus:border-black/20 dark:bg-white/5 dark:focus:border-white/20"
              />
            </div>
          )}

          {/* View Modes */}
          {!activeFile && !activeEventPage && (
            <div className="flex items-center gap-1">
              <div className="rounded p-1 opacity-100">
                <Grid size={14} className="text-black dark:text-white" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div
        ref={contentRef}
        onClick={() => setSelectedNodeId(null)}
        className="about-scrollbar relative flex-1 overflow-y-auto overscroll-contain scroll-smooth p-6"
      >
        {/* Global Fetch Progress Spinner (Very Subtle) */}
        <AnimatePresence>
          {(isLoading || eventPageLoadingId) && (
            <m.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-none absolute left-1/2 top-2 z-[20] flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/5 bg-white/90 px-3 py-1 shadow-sm dark:border-white/10 dark:bg-black/90"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                {eventPageLoadingId ? 'Opening' : 'Loading'}
              </span>
              <RefreshCw
                size={12}
                className="origin-center animate-spin text-gray-500 dark:text-gray-400"
              />
            </m.div>
          )}
        </AnimatePresence>

        <div className="h-full">
          <AnimatePresence mode="wait" initial={false}>
            {activeFile ? (
              <m.div
                key={`file:${activeFile.id}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="h-full"
              >
                <InlineFilePreview file={activeFile} />
              </m.div>
            ) : activeEventPage ? (
              <m.div
                key={`event:${activeEventPage.id}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="h-full"
              >
                <EventLandingPage
                  page={activeEventPage}
                  onOpenLightbox={(items, index) => {
                    setLightboxItems(items);
                    setLightboxIndex(index);
                  }}
                />
              </m.div>
            ) : !hasLoadedOnce && isLoading && nodes.length === 0 ? null : filteredNodes.length ===
              0 ? (
              <m.div
                key="empty"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="flex h-full flex-col items-center justify-center gap-4 text-slate-400"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">
                  <Search size={32} strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium">No files found</p>
              </m.div>
            ) : (
              <m.div
                key={`grid:${displayedParentId ?? 'root'}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-4 gap-y-10"
              >
                {filteredNodes.map((node) => (
                  <m.div
                    key={node.id}
                    variants={itemVariants}
                    layout
                    className={`group relative flex cursor-pointer flex-col items-center ${
                      selectedNodeId === node.id ? 'z-10' : 'z-0'
                    }`}
                    onClick={(e) => handleNodeClick(node, e)}
                    onDoubleClick={(e) => void handleNodeDoubleClick(node, e)}
                  >
                    <div className="pointer-events-none relative mb-2 flex h-[98px] w-full items-end justify-center">
                      <div className="relative flex h-full items-end justify-center">
                        {node.type === 'folder' ? (
                          <MacFolder size={0.9} isStatic={true} label="" />
                        ) : (
                          <FileThumbnail file={node as ExplorerFile} />
                        )}
                      </div>
                    </div>
                    <div
                      className={`max-w-full rounded px-2 py-1 text-center transition-colors ${
                        selectedNodeId === node.id
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-700 group-hover:text-blue-600 dark:text-slate-300 dark:group-hover:text-blue-400'
                      }`}
                    >
                      <span className="line-clamp-2 block break-words text-[11px] font-medium">
                        {getExplorerNodeDisplayName(node)}
                      </span>
                      {node.type === 'file' && (
                        <ExplorerFormatBadge
                          format={getExplorerActualFormat(node)}
                          variant={selectedNodeId === node.id ? 'selected' : 'default'}
                          className={
                            selectedNodeId === node.id
                              ? 'mt-1 text-[9px]'
                              : 'mt-1 bg-black/5 text-[9px] text-slate-500 dark:bg-white/10 dark:text-slate-300'
                          }
                        />
                      )}
                    </div>
                  </m.div>
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style jsx>{`
        .about-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .about-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .about-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .about-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.2);
        }
        :global(.dark) .about-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
        }
        :global(.dark) .about-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {lightboxIndex !== null && (
        <WindowImagePreview
          items={lightboxItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          groupName={activeEventPage?.title}
          isWindowMaximized={isMaximized}
          onToggleWindowMaximize={() => maximizeWindow('explorer')}
        />
      )}
    </div>
  );
}

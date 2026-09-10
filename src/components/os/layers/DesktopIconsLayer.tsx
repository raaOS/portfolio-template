'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { m, type Variants } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import DesktopIcon from '../ui/elements/DesktopIcon';

import QuickLookModal from '@/components/ui/QuickLookModal';
import { resolveCover } from '@/lib/images';
import type { DesktopIconSize } from '@/types/about';
import type { Project } from '@/types/projects';
import { useDesktopWindowContext } from '../context/DesktopWindowContext';
import { useUnifiedZIndex } from '../context/UnifiedZIndexContext';

const MacFolder = dynamic(() => import('../windows/MacFolder'), {
  loading: () => <div className="h-16 w-16 animate-pulse rounded-lg bg-gray-200/50" />,
  ssr: false,
});

interface ProjectIcon {
  id: string;
  x: number;
  y: number;
  label: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  videoUrl?: string;
  aspectRatio?: number;
  type?: 'project' | 'folder' | string;
  data?: Project;
  action?: () => void;
  priority?: boolean;
  zIndex?: number;
  size?: DesktopIconSize;
}

interface DesktopIconsLayerProps {
  projectIcons: ProjectIcon[];
  isMobile: boolean;
  isAdmin: boolean;
  isReady?: boolean;
  handleIconPositionChange: (id: string, x: number, y: number) => void;
  handleIconZIndexChange: (id: string, zIndex: number, position: { x: number; y: number }) => void;
  handleIconSizeChange: (
    id: string,
    size: DesktopIconSize,
    position: { x: number; y: number }
  ) => void;
  openProjectWindow: (
    project: Project,
    originRect?: { x: number; y: number; width: number; height: number }
  ) => void;
  isDimmed?: boolean;
}

function DesktopIconsLayer({
  projectIcons,
  isMobile,
  isAdmin,
  isReady = true,
  handleIconPositionChange,
  handleIconZIndexChange,
  handleIconSizeChange,
  openProjectWindow,
  isDimmed = false,
}: DesktopIconsLayerProps) {
  const { windows } = useDesktopWindowContext();
  const { getZIndex, bringToFront, registerElement, unregisterElement } = useUnifiedZIndex();

  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [quickLookIcon, setQuickLookIcon] = useState<ProjectIcon | null>(null);
  // Track icon currently scaling up (open animation)
  const [openingIconId, setOpeningIconId] = useState<string | null>(null);
  // Track icon receiving a collapsing window (close/minimize animation) — detected LOCALLY
  const [closingToIconId, setClosingToIconId] = useState<string | null>(null);
  // Refs to each icon's wrapper m.div for accurate getBoundingClientRect
  const iconRefs = useRef<Record<string, HTMLElement | null>>({});
  const registeredIconIdsRef = useRef<Set<string>>(new Set());
  // Ref to previous window states for diffing
  const prevWindowsRef = useRef(windows);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nextIds = new Set<string>();

    projectIcons.forEach((icon) => {
      nextIds.add(icon.id);
      if (!registeredIconIdsRef.current.has(icon.id)) {
        registerElement(icon.id, 'desktopIcon', icon.zIndex);
      }
    });

    registeredIconIdsRef.current.forEach((id) => {
      if (!nextIds.has(id)) {
        unregisterElement(id);
      }
    });

    registeredIconIdsRef.current = nextIds;
  }, [projectIcons, registerElement, unregisterElement]);

  useEffect(() => {
    return () => {
      registeredIconIdsRef.current.forEach((id) => unregisterElement(id));
      registeredIconIdsRef.current.clear();
    };
  }, [unregisterElement]);

  const bringIconToFront = React.useCallback(
    (icon: ProjectIcon) => {
      const nextZIndex = bringToFront(icon.id, 'desktopIcon');
      handleIconZIndexChange(icon.id, nextZIndex, { x: icon.x, y: icon.y });
    },
    [bringToFront, handleIconZIndexChange]
  );

  const handleIconSizeRequest = React.useCallback(
    (icon: ProjectIcon, size: DesktopIconSize) => {
      if (!isAdmin) return;
      handleIconSizeChange(icon.id, size, { x: icon.x, y: icon.y });
    },
    [handleIconSizeChange, isAdmin]
  );

  // Detect window close/minimize in the SAME render cycle (no parent propagation delay)
  useEffect(() => {
    const prev = prevWindowsRef.current;
    const curr = windows;

    for (const currW of curr) {
      if (!currW.id.startsWith('project-')) continue;
      const prevW = prev.find((w) => w.id === currW.id);
      if (!prevW) continue;

      const justClosed = prevW.isOpen && !currW.isOpen;
      const justMinimized = !prevW.isMinimized && currW.isMinimized;

      if (justClosed || justMinimized) {
        const projectId = currW.id.replace('project-', '');
        setClosingToIconId(projectId);
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = setTimeout(() => {
          closeTimeoutRef.current = null;
          setClosingToIconId(null);
        }, 700);
        break;
      }
    }

    prevWindowsRef.current = curr;
  }, [windows]);

  // Clean up all pending animation timeouts on unmount
  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Parent container animation variants for staggering
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.12,
      },
    },
  };

  // Very iOS-like spring animation, but tuned to be bouncy like a popup
  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      scale: 0.4,
      y: 20, // Start slightly lower
    },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 450,
        damping: 12, // Medium damping for a balanced bounce
        mass: 1,
        opacity: { duration: 0.1 }, // Fast fade so the bounce is visible
      },
    },
  };

  return (
    <>
      <div
        className={`absolute inset-0 ${isDimmed ? 'pointer-events-none opacity-30' : 'pointer-events-auto'}`}
        onClick={() => setSelectedIconId(null)}
      >
        <m.div
          className="pointer-events-none relative h-full w-full"
          variants={containerVariants}
          initial="hidden"
          animate={isReady ? 'show' : 'hidden'}
        >
          {projectIcons.map((icon) => {
            const isSelected = selectedIconId === icon.id;
            const isOpen = windows.some((w) => w.id === icon.id || w.id.includes(icon.id));
            const zIndex = getZIndex(icon.id);
            const iconSize = icon.size ?? 'medium';
            const folderSize = {
              small: 0.75,
              medium: 0.85,
              large: 1,
            }[iconSize];

            return (
              <m.div
                key={icon.id}
                ref={(el) => {
                  if (el) iconRefs.current[icon.id] = el;
                }}
                variants={itemVariants}
                className="pointer-events-none"
                style={{
                  position: 'absolute',
                  left: icon.x,
                  top: icon.y,
                  zIndex,
                }}
              >
                <DesktopIcon
                  {...icon}
                  x={0}
                  y={0}
                  size={iconSize}
                  icon={!icon.type || icon.type !== 'folder' ? icon.icon : undefined}
                  isMobile={isMobile}
                  priority={icon.priority}
                  isSelected={isSelected}
                  onPositionChange={(id, relX, relY) => {
                    handleIconPositionChange(id, icon.x + relX, icon.y + relY);
                  }}
                  onFocus={() => bringIconToFront(icon)}
                  onSizeChange={isAdmin ? (size) => handleIconSizeRequest(icon, size) : undefined}
                  onClick={() => {
                    setSelectedIconId(icon.id);
                    if (icon.data) {
                      const el = iconRefs.current[icon.id];
                      const rect = el?.getBoundingClientRect();

                      setOpeningIconId(icon.id);

                      openProjectWindow(
                        icon.data!,
                        rect
                          ? {
                              x: rect.left,
                              y: rect.top,
                              width: rect.width,
                              height: rect.height,
                            }
                          : undefined
                      );

                      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
                      openTimeoutRef.current = setTimeout(() => {
                        openTimeoutRef.current = null;
                        setOpeningIconId(null);
                      }, 700);
                    } else if (icon.action) {
                      icon.action();
                    }
                  }}
                  activeScale={
                    openingIconId === icon.id
                      ? 1.35 // Expand before window opens
                      : closingToIconId === icon.id
                        ? 1.22 // Pulse when window flies into icon
                        : 1
                  }
                  activeTransition={{
                    scale: {
                      type: 'spring',
                      stiffness: 500,
                      damping: 10,
                      mass: 0.8,
                    },
                  }}
                  onDoubleClick={() => {
                    if (icon.data) {
                      const el = iconRefs.current[icon.id];
                      const rect = el?.getBoundingClientRect();

                      // 1. Scale up icon immediately
                      setOpeningIconId(icon.id);

                      // 2. Open window immediately (Zero-latency for iOS feel)
                      openProjectWindow(
                        icon.data!,
                        rect
                          ? {
                              x: rect.left,
                              y: rect.top,
                              width: rect.width,
                              height: rect.height,
                            }
                          : undefined
                      );

                      // 3. Return icon to normal after window expansion is well underway
                      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
                      openTimeoutRef.current = setTimeout(() => {
                        openTimeoutRef.current = null;
                        setOpeningIconId(null);
                      }, 700);
                    } else if (icon.action) {
                      icon.action();
                    }
                  }}
                >
                  {icon.type === 'folder' && (
                    <MacFolder size={folderSize} isStatic={true} open={isOpen} />
                  )}
                </DesktopIcon>
              </m.div>
            );
          })}
        </m.div>
      </div>

      {/* Global Quick Look Modal for Desktop */}
      {quickLookIcon &&
        (() => {
          let type = 'project';
          let url = '';

          if (quickLookIcon.data) {
            const cover = resolveCover(quickLookIcon.data);
            type = cover.kind;
            url = cover.src;
          } else if (quickLookIcon.videoUrl) {
            type = 'video';
            url = quickLookIcon.videoUrl;
          } else if (quickLookIcon.imageUrl) {
            type = 'image';
            url = quickLookIcon.imageUrl;
          }

          return (
            <QuickLookModal
              isOpen={!!quickLookIcon}
              onClose={() => setQuickLookIcon(null)}
              title={quickLookIcon.data?.title || quickLookIcon.label || 'Quick Look'}
              type={type as 'image' | 'video' | 'pdf' | 'text' | 'project'}
              url={url}
              metadata={quickLookIcon.data?.tags?.join(', ') || quickLookIcon.type}
              onGoToDetail={() => {
                setQuickLookIcon(null);
                if (quickLookIcon.data) {
                  openProjectWindow(quickLookIcon.data);
                } else if (quickLookIcon.action) {
                  quickLookIcon.action();
                }
              }}
            />
          );
        })()}
    </>
  );
}

export default React.memo(DesktopIconsLayer);

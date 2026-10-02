'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import MenuBar from '../core/MenuBar';
import { OSDock } from '../core/OSDock';
import { DockPortal } from '@/components/layout/GlobalDockSlot';

import type { AboutData } from '@/types/about';
import type { Project } from '@/types/projects';
import type { ContactProfile } from '../data/mockChats';
import { useDesktopWindowContext } from '../context/DesktopWindowContext';
import { useUnifiedZIndex } from '../context/UnifiedZIndexContext';
import { useOSOverlays, useOSBoot } from '../context/OSSystemContext';
import { Z_LAYERS } from '../utils/zIndexLayers';

const Spotlight = dynamic(() => import('../core/Spotlight'), {
  loading: () => null,
  ssr: false,
});

const ControlCenter = dynamic(() => import('../ui/ControlCenter'), {
  loading: () => null,
  ssr: false,
});

const CalendarPopout = dynamic(() => import('../ui/CalendarPopout'), {
  ssr: false,
});

const ExitIntentFeedback = dynamic(() => import('../ui/ExitIntentFeedback'), {
  loading: () => null,
  ssr: false,
});

const MissionControl = dynamic(() => import('../core/MissionControl'), {
  loading: () => null,
  ssr: false,
});

interface UIOverlaysLayerProps {
  siteId?: string;
  navToChat: (chatId?: string) => void;
  openWhatsAppList: () => void;
  testimonialContacts: ContactProfile[];
  aboutData?: AboutData | null;
  isWhatsAppEnabled?: boolean;
  isAdmin: boolean;
  logout: () => void;
  toggleNotesVisibility: () => void;
  isMobile: boolean;
  commercialProjects: Project[];
  openProjectWindow: (project: Project) => void;
  needsPowerOn: boolean;
  isBooting: boolean;
  showMissionControl?: boolean;
  onMissionControlDismiss?: () => void;
}

export default function UIOverlaysLayer({
  siteId,
  navToChat: _navToChat,
  openWhatsAppList,
  testimonialContacts: _testimonialContacts,
  aboutData,
  isWhatsAppEnabled = true,
  isAdmin,
  logout,
  toggleNotesVisibility,
  isMobile,
  commercialProjects,
  openProjectWindow,
  needsPowerOn,
  isBooting,
  showMissionControl: _showMissionControl,
  onMissionControlDismiss: _onMissionControlDismiss,
}: UIOverlaysLayerProps) {
  const {
    showSpotlight,
    setShowSpotlight,
    notesVisible,
    showControlCenter,
    setShowControlCenter,
    showCalendar,
    setShowCalendar,
  } = useOSOverlays();
  const { isRevealed } = useOSBoot();
  // Saat hollow-O mulai membesar (`isRevealed = true`), dock & menubar sudah
  // boleh render di belakang StartScreen supaya terlihat dari dalam lubang.
  const isBootSequenceActive = isBooting || needsPowerOn;
  const isBootingOrStarting = isBootSequenceActive && !isRevealed;

  const { windows, openWindow, bouncingDocId } = useDesktopWindowContext();
  const { getZIndex } = useUnifiedZIndex();

  const isWindowOpen = (id: string) => windows?.find((w) => w.id === id)?.isOpen ?? false;
  const activeWindows = (windows || []).filter((w) => w.isOpen && !w.isMinimized);
  const topWindow = activeWindows.reduce<(typeof activeWindows)[number] | null>(
    (currentTop, candidate) => {
      if (!currentTop) {
        return candidate;
      }
      return getZIndex(candidate.id) > getZIndex(currentTop.id) ? candidate : currentTop;
    },
    null
  );
  const topWindowTitle = topWindow?.title || null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence mode="wait">
        {/* MenuBar - hidden during boot */}
        {!isBootingOrStarting && (
          <motion.div
            key="menubar"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <MenuBar
              activeWindow={topWindowTitle || 'Finder'}
              onAbout={() => openWindow('about')}
              onSearch={() => setShowSpotlight(true)}
              availability={aboutData?.hero?.availability}
              isAdmin={isAdmin}
              onLogout={logout}
              onToggleControlCenter={() => setShowControlCenter(!showControlCenter)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* Dock Container - hidden during boot */}
        {!isBootingOrStarting && (
          <DockPortal>
            <motion.div
              key="dock"
              className="pointer-events-auto"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 0.8 }}
            >
              {aboutData && (
                <OSDock
                  aboutData={aboutData}
                  siteId={siteId}
                  onOpenWindow={openWindow}
                  onOpenWhatsApp={openWhatsAppList}
                  onOpenContact={() => openWindow('contact')}
                  onOpenNotes={toggleNotesVisibility}
                  isWindowOpen={isWindowOpen}
                  notesVisible={notesVisible}
                  bouncingId={bouncingDocId}
                  isMobile={isMobile}
                />
              )}
            </motion.div>
          </DockPortal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSpotlight && (
          <div
            className="pointer-events-auto absolute inset-0"
            style={{ zIndex: Z_LAYERS.POPOUT }}
            onClick={() => setShowSpotlight(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Spotlight
                isOpen={showSpotlight}
                onClose={() => setShowSpotlight(false)}
                projects={commercialProjects}
                hiddenAppIds={isWhatsAppEnabled ? undefined : ['whatsapp']}
                onOpenProject={(project: Project) => {
                  setShowSpotlight(false);
                  openProjectWindow(project);
                }}
                onOpenApp={(id) => {
                  if (id === 'whatsapp' && !isWhatsAppEnabled) return;
                  openWindow(id);
                }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControlCenter && (
          <div
            className="pointer-events-auto absolute inset-0"
            style={{ zIndex: Z_LAYERS.POPOUT }}
            onClick={() => setShowControlCenter(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <ControlCenter
                isOpen={showControlCenter}
                onClose={() => setShowControlCenter(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
      {/* Global Calendar Popout */}
      <AnimatePresence>
        {showCalendar && (
          <div
            className="pointer-events-auto fixed inset-0"
            style={{ zIndex: Z_LAYERS.POPOUT }}
            onClick={() => setShowCalendar(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <CalendarPopout isOpen={showCalendar} onClose={() => setShowCalendar(false)} />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Mission Control */}
      <MissionControl />

      {/* Exit-intent feedback — visitor only, appears on tab close attempt */}
      {!isAdmin && !isBootSequenceActive && <ExitIntentFeedback />}
    </div>
  );
}

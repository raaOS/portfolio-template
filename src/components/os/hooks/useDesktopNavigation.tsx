import React, { useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/types/projects';
import type { ContactProfile } from '../data/mockChats';
import type { NoteData } from '../ui/elements/StickyNoteItem';
import { WindowState } from '@/components/os/hooks/useWindowManager';
import dynamic from 'next/dynamic';
import { useOSOverlays } from '../context/OSSystemContext';

const ProjectDetailWrapper = dynamic(() => import('../ui/ProjectDetailWrapper'), {
  loading: () => (
    <div className="h-full w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
  ),
  ssr: false,
});

interface UseDesktopNavigationProps {
  openWindow: (id: string, options?: Partial<WindowState>) => void;
  resetWindows: () => void;
  dynamicContacts: Record<string, ContactProfile>;
  ChatWindow: React.ComponentType<{
    activeChatId?: string | null;
    customContacts?: Record<string, ContactProfile>;
    initialProjects?: Project[];
  }>;
  _notes: NoteData[];
  projects: Project[];
  siteId?: string;
  _restoreNote: (id: string) => void;
  _addNote: () => void;
  _isAdmin: boolean;
  setNotesDockBouncing: (bouncing: boolean) => void;
  isWhatsAppEnabled?: boolean;
}

export function useDesktopNavigation({
  openWindow,
  resetWindows,
  dynamicContacts,
  ChatWindow,
  _notes,
  projects,
  siteId = 'default-site',
  _restoreNote,
  _addNote,
  _isAdmin,
  setNotesDockBouncing,
  isWhatsAppEnabled = true,
}: UseDesktopNavigationProps) {
  const { notesVisible, setNotesVisible, hiddenNoteIds, unhideAllNotes } = useOSOverlays();
  const router = useRouter();
  const bounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
    };
  }, []);

  const debouncedBounce = useCallback(() => {
    setNotesDockBouncing(true);
    if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
    bounceTimerRef.current = setTimeout(() => setNotesDockBouncing(false), 600);
  }, [setNotesDockBouncing]);

  const handleGoHome = useCallback(() => router.push('/'), [router]);
  const resetDesktopAndClose = useCallback(() => resetWindows(), [resetWindows]);

  const openProjectWindow = useCallback(
    (project: Project, originRect?: { x: number; y: number; width: number; height: number }) => {
      openWindow(`project-${project.id}`, {
        title: `Portfolio: ${project.title}`,
        content: <ProjectDetailWrapper project={project} projects={projects} siteId={siteId} />,
        originRect,
        width: 900,
        height: 620,
        noPadding: true,
      });
    },
    [openWindow, projects, siteId]
  );

  // Klik Dynamic Island (dengan chatId spesifik) -> langsung buka chat
  const navToChat = useCallback(
    (chatId?: string) => {
      if (!isWhatsAppEnabled) return;

      openWindow('whatsapp', {
        content: (
          <ChatWindow
            activeChatId={chatId || null}
            customContacts={dynamicContacts}
            initialProjects={projects}
          />
        ),
      });
    },
    [isWhatsAppEnabled, openWindow, dynamicContacts, ChatWindow, projects]
  );

  // Klik Dock WA -> buka list view (tanpa activeChatId)
  const openWhatsAppList = useCallback(() => {
    if (!isWhatsAppEnabled) return;

    openWindow('whatsapp', {
      content: (
        <ChatWindow
          activeChatId={null}
          customContacts={dynamicContacts}
          initialProjects={projects}
        />
      ),
    });
  }, [isWhatsAppEnabled, openWindow, dynamicContacts, ChatWindow, projects]);

  const openContactWindow = useCallback(() => {
    openWindow('contact');
  }, [openWindow]);

  /**
   * Behavior dock icon Notes:
   *  - Kalau ada note yang sedang di-"hide" (tombol X header) → unhide
   *    semuanya supaya note kembali muncul. Ini juga otomatis pastikan
   *    `notesVisible=true`.
   *  - Kalau tidak ada hidden notes → toggle visibility seperti biasa
   *    (show ↔ hide all).
   *
   * Pattern ini cocok dengan UX macOS: klik icon di dock = "buka kembali".
   */
  const toggleNotesVisibility = useCallback(() => {
    if (hiddenNoteIds.size > 0) {
      unhideAllNotes();
      if (!notesVisible) setNotesVisible(true);
    } else {
      setNotesVisible(!notesVisible);
    }
    debouncedBounce();
  }, [notesVisible, setNotesVisible, hiddenNoteIds, unhideAllNotes, debouncedBounce]);

  const showNotes = useCallback(() => {
    unhideAllNotes();
    setNotesVisible(true);
    debouncedBounce();
  }, [setNotesVisible, unhideAllNotes, debouncedBounce]);

  return {
    handleGoHome,
    resetDesktopAndClose,
    openProjectWindow,
    navToChat,
    openWhatsAppList,
    openContactWindow,
    toggleNotesVisibility,
    showNotes,
  };
}

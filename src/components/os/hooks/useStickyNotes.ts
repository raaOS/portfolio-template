import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import type { NoteData } from '../ui/elements/StickyNoteItem';
import { useLayoutPersistence } from '../contexts/LayoutPersistenceContext';
import type { ElementType } from '../context/UnifiedZIndexContext';

// BUG FIX #5: Gunakan function untuk lazy initialization agar tidak SSR leak
// HYDRATION FIX: Generate client-specific values only when function is called (client-side)
const getInitialNotes = (): NoteData[] => {
  // Generate timestamp and position only on client to prevent hydration mismatch
  const isClient = typeof window !== 'undefined';
  const width = 320;
  const height = 380;
  const vp = getViewport();
  const x = isClient ? Math.max(20, vp.width - width - 60) : 1060;
  const y = isClient ? 100 : 100;

  return [
    {
      id: 'welcome-note',
      text: 'Halo! Selamat datang di Portfolio OS Template.\n\nIni adalah sticky note demo. Client bisa mengubah teks, posisi, warna, dan visibilitasnya dari dashboard.\n\nQuick Start:\n1. Buka folder "Projects" untuk melihat karya demo.\n2. Klik "Contact" untuk melihat form kontak.\n3. Drag note ini ke posisi yang diinginkan.\n\nSilakan ganti konten ini sebelum publikasi.',
      date: isClient ? new Date().toISOString() : '2024-01-01T00:00:00.000Z', // Static date for SSR
      color: '#fef08a',
      isStarred: true,
      isDeleted: false,
      x,
      y,
      width,
      height,
      xPct: (x / vp.width) * 100,
      yPct: (y / vp.height) * 100,
      widthPct: (width / vp.width) * 100,
      heightPct: (height / vp.height) * 100,
      refScreenWidth: vp.width,
      refScreenHeight: vp.height,
      zIndex: 100,
      isPinned: false,
    },
  ];
};

// Helper debounce function - prefixed with _ to indicate it's reserved for future use
const _debounce = <T extends (...args: unknown[]) => ReturnType<T>>(func: T, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/** SSR-safe viewport helper */
const getViewport = () => {
  if (typeof window === 'undefined') return { width: 1440, height: 900 };
  return { width: window.innerWidth, height: window.innerHeight };
};

/** Convert note pixel values to percentages for responsive positioning */
const convertNoteToPercentages = (note: NoteData): NoteData => {
  const vp = getViewport();
  const x = note.x ?? 100;
  const y = note.y ?? 100;
  const width = note.width ?? 280;
  const height = note.height ?? 280;

  return {
    ...note,
    // Keep legacy pixel values
    x,
    y,
    width,
    height,
    // Add percentage values
    xPct: (x / vp.width) * 100,
    yPct: (y / vp.height) * 100,
    widthPct: (width / vp.width) * 100,
    heightPct: (height / vp.height) * 100,
    // Reference screen dimensions
    refScreenWidth: vp.width,
    refScreenHeight: vp.height,
  };
};

export const useStickyNotes = (
  mounted: boolean,
  isAdmin: boolean = false,
  csrfToken?: string,
  requestNextZIndex?: (id?: string, type?: ElementType) => number,
  isAuthLoading: boolean = false,
  siteId = 'default-site'
) => {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const isModified = useRef(false);
  const notesRef = useRef(notes);

  // Sync notesRef with state
  useLayoutEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const { registerFlush, unregisterFlush } = useLayoutPersistence();

  // Load notes from server
  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadNotes = async () => {
      try {
        // Cache-busting strategy split by role:
        //
        // - Admin: tetap force-fresh (`t=...&force=true`) supaya admin
        //   yang baru ngedit di panel langsung lihat hasilnya saat
        //   navigasi balik ke desktop, tanpa harus full reload.
        // - Visitor (non-admin): biarkan response dapat di-cache di
        //   browser. /api/sticky-notes saat ini set
        //   `Cache-Control: no-cache` di header global (lihat
        //   `next.config.mjs` headers `/api/(.*)`), tapi tanpa query
        //   bust kita masih dapat HTTP-level dedup di SWR-style mounts
        //   (kembali ke /, navigasi internal) dan menghindari D1 round
        //   trip yang tidak perlu setiap mount desktop.
        //
        // Net effect untuk visitor: 1 D1 read per page load (bukan per
        // mount) dan TTFB sticky-notes panel turun saat refresh.
        const params = new URLSearchParams({ siteId });
        if (isAdmin) {
          params.set('t', String(Date.now()));
          params.set('force', 'true');
        }
        const url = `/api/sticky-notes?${params.toString()}`;
        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[StickyNotes] API Error (${response.status}):`, text.slice(0, 200));
          throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();
        if (!isActive) return;

        if (Array.isArray(data) && data.length > 0) {
          // Responsive positioning: use percentage if available, fallback to pixels
          const vp =
            typeof window !== 'undefined'
              ? { width: window.innerWidth, height: window.innerHeight }
              : { width: 1440, height: 900 };
          const isMobile = vp.width < 768;

          const adjustedData = data.map((n, i) => {
            // Calculate dimensions - prefer percentage if available
            let width: number;
            let height: number;

            if (n.widthPct !== undefined && n.heightPct !== undefined) {
              // Use percentage-based sizing
              width = (n.widthPct / 100) * vp.width;
              height = (n.heightPct / 100) * vp.height;
            } else {
              // Legacy pixel fallback
              width = n.width || 280;
              height = n.height || 280;
            }

            // Clamp dimensions
            if (isMobile) {
              width = Math.min(width, vp.width * 0.9);
              height = Math.min(height, vp.height * 0.8);
            } else {
              width = Math.min(width, vp.width * 0.95);
              height = Math.min(height, vp.height * 0.95);
            }
            width = Math.max(width, 200);
            height = Math.max(height, 150);

            // Calculate position - prefer percentage if available
            let x: number;
            let y: number;

            if (n.xPct !== undefined && n.yPct !== undefined) {
              // Use percentage-based positioning
              x = (n.xPct / 100) * vp.width;
              y = (n.yPct / 100) * vp.height;
            } else if (n.x !== undefined && n.y !== undefined && !isMobile) {
              // Legacy pixel fallback (desktop only)
              x = n.x;
              y = n.y;
            } else {
              // Default: stack with offset or center
              if (isMobile) {
                x = Math.max(0, (vp.width - width) / 2) + i * 10;
                y = Math.max(50, (vp.height - height) / 2) + i * 10;
              } else {
                x = (vp.width - width) / 2;
                y = (vp.height - height) / 2;
              }
            }

            // Clamp position to viewport
            const margin = 20;
            x = Math.max(margin, Math.min(x, vp.width - width - margin));
            y = Math.max(margin, Math.min(y, vp.height - height - margin));

            return {
              ...n,
              x,
              y,
              width,
              height,
            };
          });

          setNotes(adjustedData);
          setHasLoaded(true);
        } else {
          // BUG FIX: If auth is still loading, wait before assuming guest!
          if (isAuthLoading) {
            return; // Will re-run when isAuthLoading becomes false
          }

          // Show welcome note ONLY for guests.
          // Admins should see an empty state if they cleared it in CRUD.
          try {
            // FIX #56: Persist flag selamat datang menggunakan localStorage
            // (bukan sessionStorage) agar tidak muncul berulang di tab/sesi baru.
            const hasSeenWelcome = localStorage.getItem('portfolio_os_welcome_seen');
            if (!hasSeenWelcome && !isAdmin) {
              setNotes(getInitialNotes());
              localStorage.setItem('portfolio_os_welcome_seen', 'true');
            } else {
              setNotes([]);
            }
          } catch (e) {
            console.warn('[StickyNotes] Failed to access localStorage:', e);
            // Fallback: only show welcome to guests on failure
            if (!isAdmin) {
              setNotes(getInitialNotes());
            } else {
              setNotes([]);
            }
          }
          setHasLoaded(true);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;

        if (!isActive) return;
        console.error(
          'Failed to load notes from server:',
          error instanceof Error ? error.message : error
        );

        if (isAuthLoading) return; // Wait for auth before showing error fallback

        if (!isAdmin) {
          setNotes(getInitialNotes());
        } else {
          setNotes([]);
        }
        setHasLoaded(true);
      }
    };

    loadNotes();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [isAuthLoading, isAdmin, siteId]); // Re-runs when auth check finishes to resolve empty state

  // Auto-sync for Admins ONLY
  useEffect(() => {
    if (!mounted || !hasLoaded || !isAdmin || !csrfToken || !isModified.current) return;

    const controller = new AbortController();

    const saveNotes = async () => {
      try {
        // SAVE FLOW FIX: Hilangkan GET-before-save yang memicu fetch tiap
        // drag/resize di admin. Local state sudah jadi source of truth
        // setelah initial load karena admin-lah yang mengedit (text,
        // color, dll.). "Ghost bug" dari dua tab admin konkuren tetap
        // diproteksi karena save menggunakan timestamp dan
        // `revalidatePath` pasca-save.
        const notesWithPercentages = notesRef.current.map(convertNoteToPercentages);

        const response = await fetch('/api/sticky-notes', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify(notesWithPercentages),
        });

        if (!response.ok && response.status !== 304) {
          console.warn(`[StickyNotes] Save returned ${response.status}`);
          return; // Jangan clear isModified kalau gagal, biar retry di debounce berikutnya
        }

        isModified.current = false;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Failed to auto-save notes:', error instanceof Error ? error.message : error);
      }
    };

    const debouncedSave = setTimeout(saveNotes, 1500);
    return () => {
      clearTimeout(debouncedSave);
      controller.abort();
    };
  }, [notes, mounted, hasLoaded, isAdmin, csrfToken, siteId]);

  // Flusher for logout/exit
  // BUG FIX #3: Capture notes data di awal untuk mencegah race condition
  const flushNotes = useCallback(async () => {
    if (!isAdmin || !csrfToken || !isModified.current) return;

    // Capture current notes state immediately
    const notesToFlush = notesRef.current;

    try {
      // Convert to percentages for responsive positioning before saving
      const notesWithPercentages = notesToFlush.map(convertNoteToPercentages);

      await fetch('/api/sticky-notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(notesWithPercentages),
      });
      isModified.current = false;
    } catch (error) {
      console.error('[StickyNotes] Failed to flush notes:', error);
    }
  }, [isAdmin, csrfToken]);

  useEffect(() => {
    registerFlush('stickyNotes', flushNotes);
    return () => unregisterFlush('stickyNotes');
  }, [registerFlush, unregisterFlush, flushNotes]);

  const addNote = useCallback(() => {
    // HYDRATION FIX: Generate client-specific values only on client
    const isClient = typeof window !== 'undefined';
    const noteId =
      'note-' +
      (isClient ? Date.now() : 0) +
      '-' +
      (isClient ? Math.random().toString(36).substr(2, 9) : 'xxxxxxxx');
    // Get z-index from unified system, passing the note ID
    const nextZ = requestNextZIndex ? requestNextZIndex(noteId, 'stickyNote') : 100;

    // HYDRATION FIX: Use consistent SSR-safe defaults, then update on client
    const newNote: NoteData = {
      id: noteId,
      text: '',
      date: isClient ? new Date().toISOString() : '2024-01-01T00:00:00.000Z',
      color: '#fef08a',
      isStarred: false,
      isDeleted: false,
      x: isClient
        ? window.innerWidth < 768
          ? (window.innerWidth - 280) / 2
          : Math.random() * (window.innerWidth - 300)
        : 100, // Consistent SSR fallback
      y: isClient
        ? window.innerWidth < 768
          ? (window.innerHeight - 280) / 2
          : Math.random() * (window.innerHeight - 300)
        : 100, // Consistent SSR fallback
      width: 280,
      height: 280,
      isPinned: false,
      isCollapsed: false,
      opacity: 1,
      zIndex: nextZ,
      fontFamily: 'inherit',
    };
    setNotes((prev) => [newNote, ...prev]);
    isModified.current = true;
  }, [requestNextZIndex]);

  const updateNote = useCallback(
    (id: string, updates: Partial<NoteData>) => {
      setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...updates } : note)));
      isModified.current = true;

      // Simpan posisi/size ke positionSync buffer jika admin
      if (
        isAdmin &&
        (updates.x !== undefined ||
          updates.y !== undefined ||
          updates.width !== undefined ||
          updates.height !== undefined)
      ) {
        import('../utils/positionSync').then(({ saveNotePosition }) => {
          saveNotePosition(id, updates, isAdmin);
        });
      }
    },
    [isAdmin]
  );

  const deleteNote = useCallback(
    (id: string) => {
      updateNote(id, { isDeleted: true });
    },
    [updateNote]
  );

  const permanentDeleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    isModified.current = true;
  }, []);

  const restoreNote = useCallback(
    (id: string) => {
      updateNote(id, { isDeleted: false });
    },
    [updateNote]
  );

  const bringToFrontNote = useCallback(
    (id: string) => {
      // Get z-index from unified system, passing the note ID
      // The actual z-index is managed by UnifiedZIndexContext
      if (requestNextZIndex) {
        const nextZ = requestNextZIndex(id, 'stickyNote');
        updateNote(id, { zIndex: nextZ });
      }
    },
    [updateNote, requestNextZIndex]
  );

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    permanentDeleteNote,
    restoreNote,
    bringToFrontNote,
    setNotes,
    hasLoaded,
  };
};

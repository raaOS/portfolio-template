'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, FileText, AppWindow, Command } from 'lucide-react';
import type { Project } from '@/types/projects';
import { Z_LAYERS } from '../utils/zIndexLayers';
import { useDictionary } from '@/contexts/LanguageContext';

type SystemApp = { id: string; title: string; type: 'app' };
type SpotlightResult = SystemApp | { id: string; title: string; type: 'project'; project: Project };

interface SpotlightProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onOpenApp: (id: string) => void;
  hiddenAppIds?: string[];
}

/**
 * Lightweight fuzzy scorer: checks if all query characters appear in order.
 * Returns a simple score (higher = better match). Returns 0 for no match.
 * This replaces exact `.includes()` to support typos and partial matches.
 */
function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact substring match → highest priority
  if (t.includes(q)) return 100;

  // Subsequence match: all query chars appear in order
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      score += 1;
      // Bonus for consecutive matches
      if (ti > 0 && q[qi - 2] !== undefined && t[ti - 1] === q[qi - 2]) score += 2;
    }
  }

  // All query characters matched in order
  return qi === q.length ? score : 0;
}

export default function Spotlight({
  isOpen,
  onClose,
  projects,
  onOpenProject,
  onOpenApp,
  hiddenAppIds,
}: SpotlightProps) {
  const t = useDictionary();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const systemApps = useMemo<SystemApp[]>(() => {
    const hidden = new Set(hiddenAppIds || []);
    const apps: SystemApp[] = [
      { id: 'about', title: t.dock.about, type: 'app' },
      { id: 'whatsapp', title: 'WhatsApp', type: 'app' },
      { id: 'contact', title: t.dock.contact, type: 'app' },
      { id: 'trash-bin', title: t.dock.trash, type: 'app' },
    ];
    return apps.filter((app) => !hidden.has(app.id));
  }, [hiddenAppIds, t]);

  const results = useMemo<SpotlightResult[]>(() => {
    if (!query.trim()) {
      return [
        ...systemApps,
        ...projects.slice(0, 8 - systemApps.length).map((project) => ({
          id: project.id,
          title: project.title,
          type: 'project' as const,
          project,
        })),
      ];
    }

    const scored: Array<{ item: SpotlightResult; score: number }> = [];

    for (const app of systemApps) {
      const score = fuzzyMatch(query, app.title);
      if (score > 0) scored.push({ item: app, score });
    }

    for (const project of projects) {
      const score = fuzzyMatch(query, project.title);
      if (score > 0) {
        scored.push({
          item: {
            id: project.id,
            title: project.title,
            type: 'project' as const,
            project,
          },
          score,
        });
      }
    }

    // Sort by score descending, take top 8
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((s) => s.item);
  }, [query, projects, systemApps]);

  const safeSelectedIndex = results.length === 0 ? 0 : Math.min(selectedIndex, results.length - 1);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = setTimeout(() => {
      setSelectedIndex(0);
      setQuery('');
      inputRef.current?.focus();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const openResult = (result: (typeof results)[number]) => {
    if (result.type === 'app') {
      onOpenApp(result.id);
      onClose();
      return;
    }

    onOpenProject(result.project);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      setSelectedIndex((prev) => (prev + 1) % results.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      return;
    }

    if (event.key === 'Enter') {
      const selected = results[safeSelectedIndex];
      if (selected) {
        openResult(selected);
      }
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-label={t.spotlight.ariaLabel}
      aria-modal="true"
      initial={{ opacity: 0, width: 46, height: 46, filter: 'blur(4px)' }}
      animate={{ opacity: 1, width: 380, height: 'auto', filter: 'blur(0px)' }}
      exit={{ opacity: 0, width: 46, height: 46, filter: 'blur(4px)' }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 34,
        mass: 0.85,
        opacity: { duration: 0.16 },
        filter: { duration: 0.16 },
        width: { type: 'spring', stiffness: 430, damping: 34, mass: 0.85 },
        height: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 },
      }}
      className="pointer-events-auto fixed right-4 top-11 flex flex-col items-end overflow-hidden rounded-2xl border border-white/20 bg-white/80 text-black shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-black/70 dark:text-white print:hidden"
      style={{ zIndex: Z_LAYERS.POPOUT_CONTENT }}
    >
      <motion.div
        className="w-[380px] shrink-0"
        initial={{ opacity: 0, x: 8, filter: 'blur(2px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: 8, filter: 'blur(2px)' }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center border-b border-black/5 px-4 py-3 dark:border-white/5">
          <Search className="mr-3 text-black/40 dark:text-white/40" size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t.spotlight.placeholder}
            aria-label={t.spotlight.searchApplications}
            aria-autocomplete="list"
            aria-controls="spotlight-results"
            className="flex-1 border-none bg-transparent text-lg text-black outline-none placeholder:text-black/40 dark:text-white dark:placeholder:text-white/40"
          />
          <div className="flex items-center gap-1 rounded bg-black/5 px-2 py-1 text-[10px] font-medium text-black/40 dark:bg-white/10 dark:text-white/40">
            <Command size={10} />
            <span>K</span>
          </div>
        </div>

        <div id="spotlight-results" role="listbox" className="max-h-[360px] overflow-y-auto py-2">
          {results.length > 0 ? (
            results.map((result, index) => (
              <div
                key={result.id}
                role="option"
                aria-selected={index === safeSelectedIndex}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
                  index === safeSelectedIndex
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5'
                }`}
                onClick={() => openResult(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {result.type === 'app' ? (
                  <AppWindow
                    size={16}
                    className={
                      index === safeSelectedIndex
                        ? 'text-white dark:text-black'
                        : 'text-black/40 dark:text-white/40'
                    }
                  />
                ) : (
                  <FileText
                    size={16}
                    className={
                      index === safeSelectedIndex ? 'text-white dark:text-black' : 'text-orange-500'
                    }
                  />
                )}
                <span className="flex-1 text-sm font-medium">{result.title}</span>
                {index === safeSelectedIndex && (
                  <span className="text-[10px] opacity-70">{t.spotlight.enterToOpen}</span>
                )}
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-black/40 dark:text-white/40">
              {t.spotlight.noResultsPrefix} &quot;{query}&quot;
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-black/5 bg-black/5 px-4 py-2 text-[10px] text-black/40 dark:border-white/5 dark:bg-white/5 dark:text-white/40">
          <div className="flex gap-3">
            <span>
              <span className="font-bold">{t.spotlight.upDownHint}</span> {t.spotlight.navigateHint}
            </span>
            <span>
              <span className="font-bold">{t.spotlight.enterHint}</span> {t.spotlight.openHint}
            </span>
            <span>
              <span className="font-bold">{t.spotlight.escHint}</span> {t.spotlight.closeHint}
            </span>
          </div>
          <div className="hidden items-center gap-1 sm:flex">{t.spotlight.poweredBy}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

'use client';

import React from 'react';
import { Activity, Dices, Loader2, Sparkles } from 'lucide-react';

interface AIViralSectionProps {
  cover: string;
  pendingFile: File | null;
  isGeneratingViral: boolean;
  existingCommentCount: number;
  viralOptions: {
    tone: string;
    likes: number;
    comments: number;
    shares: number;
    reply: boolean;
  };
  setViralOptions: React.Dispatch<
    React.SetStateAction<{
      tone: string;
      likes: number;
      comments: number;
      shares: number;
      reply: boolean;
    }>
  >;
  handleRandomizeViralStats: () => void;
  handleGenerateViral: () => Promise<void>;
}

export function AIViralSection({
  cover,
  pendingFile,
  isGeneratingViral,
  existingCommentCount,
  viralOptions,
  setViralOptions,
  handleRandomizeViralStats,
  handleGenerateViral,
}: AIViralSectionProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/20 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/10">
      <div className="relative z-10 space-y-3.5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          <div className="rounded bg-slate-200 p-1 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Viral Stats AI Simulator
            </h3>
            <p className="font-mono text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Metrik Populer & Komentar
            </p>
          </div>
        </div>

        {/* Viral Configuration Inputs Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Gaya Bahasa
            </label>
            <select
              value={viralOptions.tone}
              onChange={(e) => setViralOptions((prev) => ({ ...prev, tone: e.target.value }))}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
            >
              <option value="casual">Gen-Z / Casual</option>
              <option value="aesthetic">Estetik / Pujian</option>
              <option value="tech">Teknis / Mendalam</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex cursor-pointer items-center justify-between rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Balas Komentar
              </span>
              <input
                type="checkbox"
                checked={viralOptions.reply}
                onChange={(e) =>
                  setViralOptions((prev) => ({ ...prev, reply: e.target.checked }))
                }
                className="h-3.5 w-3.5 rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-offset-slate-900"
              />
            </label>
          </div>
        </div>

        <div className="flex items-end gap-1.5">
          <div className="grid flex-1 grid-cols-3 gap-2">
            <div>
              <label className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Likes
              </label>
              <input
                type="number"
                value={viralOptions.likes}
                onChange={(e) =>
                  setViralOptions((prev) => ({ ...prev, likes: parseInt(e.target.value) || 0 }))
                }
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-slate-800 focus:ring-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
                min="0"
              />
            </div>

            <div>
              <label className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Komentar
              </label>
              <input
                type="number"
                value={viralOptions.comments}
                onChange={(e) =>
                  setViralOptions((prev) => ({
                    ...prev,
                    comments: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-slate-800 focus:ring-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
                min="0"
                max="10"
              />
            </div>

            <div>
              <label className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Share
              </label>
              <input
                type="number"
                value={viralOptions.shares}
                onChange={(e) =>
                  setViralOptions((prev) => ({
                    ...prev,
                    shares: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-slate-800 focus:ring-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
                min="0"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRandomizeViralStats}
            className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600 focus:outline-none active:scale-90 active:text-indigo-800 dark:text-slate-500 dark:hover:text-indigo-400 dark:active:text-indigo-300"
            title="Randomize Stats"
            aria-label="Randomize Stats"
          >
            <Dices className="h-4.5 w-4.5 transition-colors active:text-indigo-700 dark:active:text-indigo-300" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerateViral()}
          disabled={isGeneratingViral}
          className={`flex w-full items-center justify-center gap-1.5 rounded border py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95 ${
            (!cover && !pendingFile) || isGeneratingViral
              ? 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-600'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-800 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-white'
          }`}
        >
          {isGeneratingViral ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              <span>
                {existingCommentCount > 0 ? 'Regenerate Viral Stats' : 'Generate Viral Stats'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

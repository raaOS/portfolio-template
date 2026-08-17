'use client';

import React from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';

interface AIContentSectionProps {
  cover: string;
  pendingFile: File | null;
  isGenerating: boolean;
  existingContentFieldCount: number;
  aiOptions: {
    style: string;
    maxTitleWords: number;
    sentenceCount: number;
  };
  setAiOptions: React.Dispatch<
    React.SetStateAction<{
      style: string;
      maxTitleWords: number;
      sentenceCount: number;
    }>
  >;
  handleGenerate: () => Promise<void>;
}

export function AIContentSection({
  cover,
  pendingFile,
  isGenerating,
  existingContentFieldCount,
  aiOptions,
  setAiOptions,
  handleGenerate,
}: AIContentSectionProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-100/80 bg-indigo-50/5 p-4 shadow-sm">
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-indigo-500/10 blur-2xl"></div>

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2 border-b border-indigo-50/60 pb-2.5 dark:border-indigo-950/40">
          <div className="rounded bg-indigo-600/10 p-1 text-indigo-600">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Project AI Assistant
            </h3>
            <p className="font-mono text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Konten & Salin Proyek
            </p>
          </div>
        </div>

        {/* Style Configuration */}
        <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Gaya Bahasa
            </label>
            <select
              value={aiOptions.style}
              onChange={(e) => setAiOptions((prev) => ({ ...prev, style: e.target.value }))}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
            >
              <option value="estetik & profesional">Estetik & Profesional</option>
              <option value="minimalis & elegan">Minimalis & Elegan</option>
              <option value="kreatif & berapi-api">Kreatif & Berapi-api</option>
              <option value="poetis & mendalam">Poetis & Mendalam</option>
              <option value="santai & trendi">Santai & Trendi</option>
              <option value="Gen-Z (Casual/Chill)">Gen-Z (Casual/Chill)</option>
            </select>
          </div>

          <div>
            <label className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Max Kata
            </label>
            <input
              type="number"
              value={aiOptions.maxTitleWords}
              onChange={(e) =>
                setAiOptions((prev) => ({
                  ...prev,
                  maxTitleWords: parseInt(e.target.value) || 5,
                }))
              }
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-slate-800 focus:ring-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
              min="1"
              max="15"
            />
          </div>

          <div>
            <label className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Kalimat
            </label>
            <input
              type="number"
              value={aiOptions.sentenceCount}
              onChange={(e) =>
                setAiOptions((prev) => ({
                  ...prev,
                  sentenceCount: parseInt(e.target.value) || 2,
                }))
              }
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-slate-800 focus:ring-0 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
              min="1"
              max="5"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          className={`flex w-full items-center justify-center gap-1.5 rounded py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all ${
            (!cover && !pendingFile) || isGenerating
              ? 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Wand2 className="h-3 w-3" />
              <span>
                {existingContentFieldCount > 0 ? 'Regenerate Konten' : 'Generate Konten'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

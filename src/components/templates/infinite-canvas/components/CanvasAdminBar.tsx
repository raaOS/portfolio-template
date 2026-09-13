'use client';

import React from 'react';
import { Save, RotateCcw, Eye, EyeOff, LogOut, Check, Loader2, Move } from 'lucide-react';

interface CanvasAdminBarProps {
  isVisitorPreview: boolean;
  onToggleVisitorPreview: () => void;
  onSavePositions: () => Promise<void>;
  onResetPositions: () => void;
  onLogout: () => void;
  isSaving: boolean;
  isSaved: boolean;
  hasUnsavedChanges: boolean;
}

/**
 * CanvasAdminBar — Floating Control Bar khusus Mode Admin pada Infinite Canvas.
 * Memungkinkan admin mengatur posisi kartu proyek secara langsung, menyimpannya ke database D1,
 * mereset ke posisi awal, dan mengintip pratinjau visitor.
 */
export function CanvasAdminBar({
  isVisitorPreview,
  onToggleVisitorPreview,
  onSavePositions,
  onResetPositions,
  onLogout,
  isSaving,
  isSaved,
  hasUnsavedChanges,
}: CanvasAdminBarProps) {
  return (
    <div
      aria-label="Admin Mode Controls"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-neutral-900/90 dark:bg-black/90 backdrop-blur-xl border border-white/15 text-white select-none transition-all duration-200"
    >
      {/* Admin Mode Badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] font-mono">
        <span
          className={`h-2 w-2 rounded-full ${
            isVisitorPreview
              ? 'bg-neutral-400'
              : 'bg-amber-400 animate-pulse ring-2 ring-amber-400/30'
          }`}
        />
        <span className="font-semibold tracking-wide">
          {isVisitorPreview ? 'Pratinjau Visitor' : 'Mode Admin'}
        </span>
      </div>

      {/* Drag Guidance info (only when not in preview) */}
      {!isVisitorPreview && (
        <div className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-neutral-300 px-1">
          <Move className="w-3 h-3 text-amber-400" />
          <span>Tarik kartu untuk atur posisi</span>
        </div>
      )}

      {/* Divider */}
      <div className="h-4 w-px bg-white/15 mx-0.5" />

      {/* Save Positions Button */}
      {!isVisitorPreview && (
        <button
          type="button"
          onClick={onSavePositions}
          disabled={isSaving}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            hasUnsavedChanges
              ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold animate-bounce-short'
              : isSaved
              ? 'bg-emerald-600/80 text-white hover:bg-emerald-600'
              : 'bg-white/15 hover:bg-white/25 text-white'
          }`}
          title="Simpan posisi kartu ke database Cloudflare D1"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : isSaved ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Tersimpan</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Posisi{hasUnsavedChanges ? ' *' : ''}</span>
            </>
          )}
        </button>
      )}

      {/* Reset Positions Button */}
      {!isVisitorPreview && (
        <button
          type="button"
          onClick={onResetPositions}
          disabled={isSaving}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Kembalikan posisi kartu ke formasi awal"
        >
          <RotateCcw className="w-3 h-3" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      )}

      {/* Toggle Visitor Preview Button */}
      <button
        type="button"
        onClick={onToggleVisitorPreview}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
          isVisitorPreview
            ? 'bg-amber-500 text-neutral-950 font-bold hover:bg-amber-400'
            : 'text-neutral-300 hover:text-white hover:bg-white/10'
        }`}
        title={isVisitorPreview ? 'Kembali ke Mode Edit Posisi' : 'Lihat tampilan seperti pengunjung'}
      >
        {isVisitorPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">
          {isVisitorPreview ? 'Edit Posisi' : 'Pratinjau'}
        </span>
      </button>

      {/* Logout Button */}
      <button
        type="button"
        onClick={onLogout}
        className="flex items-center gap-1 p-1 sm:px-2 py-1 rounded-full text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 transition-colors cursor-pointer"
        title="Keluar dari sesi Admin"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Keluar</span>
      </button>
    </div>
  );
}

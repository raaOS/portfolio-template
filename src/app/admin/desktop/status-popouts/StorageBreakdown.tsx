'use client';

import React, { useRef, useEffect } from 'react';
import {
  HardDrive,
  HelpCircle,
  RefreshCw,
  AlertTriangle,
  Image as ImageIcon,
  Film,
  Info,
} from 'lucide-react';
import type { StorageCategoryStats, StorageStatsState } from '../../hooks/useStorageStats';

interface StorageBreakdownSectionProps {
  state: StorageStatsState;
  onRefresh: () => void;
}

export function StorageBreakdownSection({ state, onRefresh }: StorageBreakdownSectionProps) {
  const data =
    state.status === 'ready'
      ? state.data
      : state.status === 'loading' || state.status === 'error'
        ? state.data
        : null;

  const isLoading = state.status === 'loading';
  const isError = state.status === 'error';
  const [showGlossary, setShowGlossary] = React.useState(false);

  return (
    <div className="rounded-lg border border-black/5 bg-white/40 p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
          <HardDrive className="h-3.5 w-3.5 text-zinc-500" />
          Storage breakdown
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowGlossary((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${
              showGlossary ? 'text-blue-600' : 'text-zinc-500 hover:text-blue-600'
            }`}
            title="Bantuan istilah"
            aria-label="Toggle istilah"
            aria-expanded={showGlossary}
          >
            <HelpCircle className="h-3 w-3" />
            Help
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:text-blue-600 disabled:opacity-50 disabled:hover:text-zinc-500"
            title="Refresh stats"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {showGlossary && <StorageGlossary />}

      {isError && (
        <div
          className={`mx-1 mb-2 rounded-md px-2 py-1.5 text-[10px] ${
            state.message === 'AUTH_REQUIRED'
              ? 'bg-zinc-100 text-zinc-600'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {state.message === 'AUTH_REQUIRED'
            ? 'Login admin diperlukan untuk melihat storage stats.'
            : state.message}
        </div>
      )}

      {!data && !isLoading && !isError && (
        <div className="px-1 py-1 text-[10px] text-zinc-500">
          Buka popout untuk memuat ringkasan storage.
        </div>
      )}

      {data && data.categories.length === 0 && (
        <div className="px-1 py-1 text-[10px] text-zinc-500">
          Belum ada kategori yang terdaftar.
        </div>
      )}

      {data && data.categories.length > 0 && (
        <ul className="space-y-1.5">
          {data.categories.map((cat) => (
            <StorageCategoryRow key={cat.id} category={cat} />
          ))}
        </ul>
      )}

      {data && data.warnings.length > 0 && (
        <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
          <div className="flex items-center gap-1 font-medium">
            <AlertTriangle className="h-3 w-3" />
            Warnings
          </div>
          <ul className="mt-0.5 list-disc pl-3">
            {data.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StorageGlossary() {
  return (
    <div className="mb-1.5 rounded-md border border-blue-100 bg-blue-50/60 px-2 py-1.5 text-[10px] leading-relaxed text-blue-900">
      <div className="mb-1 font-semibold">Istilah singkat</div>
      <dl className="space-y-1">
        <div>
          <dt className="inline font-semibold">D1: </dt>
          <dd className="inline">
            jumlah URL yang tercatat di database (apa yang admin pilih: cover, gallery,
            before/after, wallpaper).
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">R2: </dt>
          <dd className="inline">
            jumlah file fisik di bucket. Bisa lebih banyak dari D1 karena ada file pendamping
            (preview clip + poster) yang dibuat otomatis untuk tiap video.
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Side-car: </dt>
          <dd className="inline">
            file pendamping yang dibuat otomatis:{' '}
            <code className="rounded bg-white/70 px-1">{'<nama>'}-preview.mp4</code> +{' '}
            <code className="rounded bg-white/70 px-1">{'<nama>'}.jpg</code>. Tidak dicatat di D1,
            tapi dipakai UI lewat naming convention.
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Orphan: </dt>
          <dd className="inline">
            file di R2 yang tidak ada referensinya di D1. Biasanya sisa upload gagal atau project
            lama yang sudah dihapus tapi asset-nya ketinggalan.
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Dangling: </dt>
          <dd className="inline">
            URL di D1 yang file-nya sudah tidak ada di R2. Biasanya akibat file dihapus manual dari
            bucket.
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Sync: </dt>
          <dd className="inline">
            tidak ada orphan dan tidak ada dangling. Jumlah D1 vs R2 boleh beda asal selisihnya bisa
            dijelaskan oleh side-car.
          </dd>
        </div>
      </dl>
    </div>
  );
}

interface StorageCategoryRowProps {
  category: StorageCategoryStats;
}

function StorageCategoryRow({ category }: StorageCategoryRowProps) {
  const hasMismatch = category.orphans > 0 || category.dangling > 0;
  const [showNote, setShowNote] = React.useState(false);

  return (
    <li className="rounded-md px-1.5 py-1.5 transition-colors hover:bg-black/5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-zinc-700" title={category.prefix}>
          {category.label}
        </span>
        <div className="flex items-center gap-1.5">
          {category.note && (
            <NoteHint
              text={category.note}
              isOpen={showNote}
              onToggle={() => setShowNote((v) => !v)}
              onClose={() => setShowNote(false)}
            />
          )}
          {hasMismatch ? (
            <span
              className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800"
              title={`${category.orphans} orphan, ${category.dangling} dangling`}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              mismatch
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
              sync
            </span>
          )}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-1.5 text-[10px] text-zinc-500">
        <div
          className="rounded bg-black/[0.03] px-1.5 py-1"
          title="D1 = jumlah URL yang admin pilih (cover, gallery, wallpaper, dsb.)."
        >
          <div className="text-[9px] uppercase tracking-wider text-zinc-400">
            D1 <span className="font-normal normal-case text-zinc-400/80">database</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-700">
            <span title="Total URL tercatat">{category.d1.total}</span>
            <span
              className="flex items-center gap-0.5 text-zinc-500"
              title={`${category.d1.image} image`}
            >
              <ImageIcon className="h-2.5 w-2.5" />
              {category.d1.image}
            </span>
            <span
              className="flex items-center gap-0.5 text-zinc-500"
              title={`${category.d1.video} video`}
            >
              <Film className="h-2.5 w-2.5" />
              {category.d1.video}
            </span>
          </div>
        </div>
        <div
          className="rounded bg-black/[0.03] px-1.5 py-1"
          title={
            category.sidecarCount > 0
              ? `R2 = file fisik di bucket. Termasuk ${category.sidecarCount} file pendamping (preview/poster) yang otomatis dibuat untuk video.`
              : 'R2 = file fisik di bucket.'
          }
        >
          <div className="text-[9px] uppercase tracking-wider text-zinc-400">
            R2 <span className="font-normal normal-case text-zinc-400/80">bucket</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-700">
            <span title="Total object di prefix">{category.r2.total}</span>
            <span
              className="flex items-center gap-0.5 text-zinc-500"
              title={`${category.r2.image} image`}
            >
              <ImageIcon className="h-2.5 w-2.5" />
              {category.r2.image}
            </span>
            <span
              className="flex items-center gap-0.5 text-zinc-500"
              title={`${category.r2.video} video`}
            >
              <Film className="h-2.5 w-2.5" />
              {category.r2.video}
            </span>
          </div>
        </div>
      </div>

      {hasMismatch && (
        <div className="mt-1 flex flex-wrap gap-2 text-[9px] text-amber-800">
          {category.orphans > 0 && (
            <span title="Object di R2 tanpa referensi D1 — kandidat untuk dihapus.">
              {category.orphans} orphan
            </span>
          )}
          {category.dangling > 0 && (
            <span title="URL di D1 yang object-nya hilang dari R2.">
              {category.dangling} dangling
            </span>
          )}
        </div>
      )}
    </li>
  );
}

interface NoteHintProps {
  text: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function NoteHint({ text, isOpen, onToggle, onClose }: NoteHintProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const id = window.setTimeout(() => {
      window.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => !isOpen && onToggle()}
      onMouseLeave={() => isOpen && onToggle()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`inline-flex items-center justify-center transition-colors ${
          isOpen ? 'text-blue-600' : 'text-zinc-400 hover:text-blue-600'
        }`}
        title="Penjelasan kategori"
        aria-label="Penjelasan kategori"
        aria-expanded={isOpen}
      >
        <Info className="h-3 w-3" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-20 mt-1 max-w-[min(15rem,calc(100vw-2rem))] rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[10px] leading-snug text-zinc-600 shadow-lg"
          style={{ width: 'max-content' }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

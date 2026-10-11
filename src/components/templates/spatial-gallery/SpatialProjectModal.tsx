'use client';

// ─── SpatialProjectModal: panel detail project saat tile tabung diklik ─────
// File BARU (v1.3.32) — nol perubahan ke logika 3D. Tema gelap mengikuti
// karakter galeri; struktur mengikuti contoh desain owner: tab Ringkasan
// (media + meta + tentang proyek) & Proses (Tantangan/Solusi/Dampak untuk
// project komersial; Konsep/Proses/Detail untuk seni visual). Semua field
// conditional — data kosong → bagian/tab tidak dirender.

import { useEffect, useMemo, useState } from 'react';
import { X, ImageOff } from 'lucide-react';
import type { Project } from '@/types/projects';
import { resolveStorageUrl } from '@/lib/urlResolver';
import { isVideoSource } from '@/lib/mediaPreview';

type MediaEntry = { src: string; kind: 'image' | 'video'; poster?: string };
type ProcessEntry = { key: string; label: string; text: string };

/** Kumpulkan seluruh media project (cover + galleryItems + gallery legacy) tanpa duplikat. */
function buildMediaList(project: Project): MediaEntry[] {
  const out: MediaEntry[] = [];
  const seen = new Set<string>();

  const push = (raw?: string, kindHint?: 'image' | 'video', rawPoster?: string) => {
    if (!raw) return;
    const src = resolveStorageUrl(raw);
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({
      src,
      kind: kindHint ?? (isVideoSource(src) ? 'video' : 'image'),
      poster: rawPoster ? resolveStorageUrl(rawPoster) : undefined,
    });
  };

  push(project.cover);
  for (const item of project.galleryItems ?? []) push(item.src, item.kind, item.poster);
  for (const url of project.gallery ?? []) push(url);
  return out;
}

export function SpatialProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [tab, setTab] = useState<'summary' | 'process'>('summary');
  const [mediaIdx, setMediaIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  const mediaList = useMemo(() => buildMediaList(project), [project]);
  const activeMedia = mediaList[mediaIdx] ?? mediaList[0] ?? null;

  const processEntries = useMemo<ProcessEntry[]>(() => {
    const entries: ProcessEntry[] = [];
    const n = project.narrative;
    if (!n) return entries;
    if (project.type === 'visual_art') {
      if (n.concept) entries.push({ key: 'concept', label: 'Konsep', text: n.concept });
      if (n.process) entries.push({ key: 'process', label: 'Proses', text: n.process });
      if (n.detail) entries.push({ key: 'detail', label: 'Detail', text: n.detail });
    } else {
      if (n.challenge) entries.push({ key: 'challenge', label: 'Tantangan', text: n.challenge });
      if (n.solution) entries.push({ key: 'solution', label: 'Solusi', text: n.solution });
      const impact = n.impact || n.result;
      if (impact) entries.push({ key: 'impact', label: 'Dampak', text: impact });
    }
    return entries;
  }, [project]);

  const [activeProcessKey, setActiveProcessKey] = useState<string>(() => processEntries[0]?.key ?? '');
  const activeProcess = processEntries.find((e) => e.key === activeProcessKey) ?? processEntries[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const metaRows: Array<{ label: string; value: string }> = [];
  if (project.role) metaRows.push({ label: 'Peran', value: project.role });
  if (project.software && project.software.length > 0)
    metaRows.push({ label: 'Software', value: project.software.join(', ') });
  if (project.timeline) metaRows.push({ label: 'Waktu', value: project.timeline });
  if (project.team) metaRows.push({ label: 'Tim', value: project.team });
  if (project.type)
    metaRows.push({ label: 'Tipe', value: project.type === 'commercial' ? 'Project Komersial' : 'Project Seni Visual' });

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
      active ? 'bg-white text-neutral-900' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detail project ${project.title}`}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl select-text overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900/95 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-neutral-900/95 px-6 py-4 backdrop-blur-md">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-white md:text-xl">{project.title}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {project.client && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70">
                  {project.client}
                </span>
              )}
              {project.year ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70">
                  {project.year}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 cursor-pointer rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab utama */}
        <div className="flex gap-1.5 px-6 pt-4">
          <button type="button" onClick={() => setTab('summary')} className={tabClass(tab === 'summary')}>
            Ringkasan
          </button>
          {processEntries.length > 0 && (
            <button type="button" onClick={() => setTab('process')} className={tabClass(tab === 'process')}>
              Proses
            </button>
          )}
        </div>

        <div className="space-y-5 px-6 py-5">
          {tab === 'summary' ? (
            <>
              {/* Media utama */}
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                <div className="relative flex aspect-video w-full items-center justify-center">
                  {!activeMedia ? (
                    <div className="flex flex-col items-center gap-2 p-8 text-white/40">
                      <ImageOff className="h-8 w-8" />
                      <span className="font-mono text-[11px] uppercase tracking-wide">Belum ada media</span>
                    </div>
                  ) : activeMedia.kind === 'video' ? (
                    <video
                      key={activeMedia.src}
                      src={activeMedia.src}
                      poster={activeMedia.poster}
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="h-full w-full object-contain"
                    />
                  ) : imgError ? (
                    <div className="flex flex-col items-center gap-2 p-8 text-white/40">
                      <ImageOff className="h-8 w-8" />
                      <span className="font-mono text-[11px] uppercase tracking-wide">Gambar tidak tersedia</span>
                    </div>
                  ) : (
                    <img
                      key={activeMedia.src}
                      src={activeMedia.src}
                      alt={project.title}
                      className="h-full w-full object-contain"
                      onError={() => setImgError(true)}
                    />
                  )}
                </div>

                {/* Thumbnail strip */}
                {mediaList.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-white/[0.03] p-2.5">
                    {mediaList.map((m, i) => (
                      <button
                        key={m.src}
                        type="button"
                        onClick={() => {
                          setMediaIdx(i);
                          setImgError(false);
                        }}
                        aria-label={`Media ${i + 1}`}
                        className={`h-12 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                          i === mediaIdx
                            ? 'scale-105 border-white ring-1 ring-white'
                            : 'border-white/10 opacity-60 hover:opacity-100'
                        }`}
                      >
                        {m.kind === 'video' ? (
                          m.poster ? (
                            <img
                              src={m.poster}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center bg-neutral-800 font-mono text-[9px] font-semibold text-white">
                              VIDEO
                            </span>
                          )
                        ) : (
                          <img
                            src={m.src}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Meta */}
              {metaRows.length > 0 && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {metaRows.map((row) => (
                    <div key={row.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-white/40">
                        {row.label}
                      </span>
                      <span className="mt-0.5 block text-xs font-semibold text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tentang Proyek */}
              {project.description && (
                <div className="space-y-1.5">
                  <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Tentang Proyek
                  </h4>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">{project.description}</p>
                </div>
              )}

              {/* Tag */}
              {project.tags && project.tags.length > 0 && (
                <div className="space-y-1.5 border-t border-white/10 pt-4">
                  <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-white/40">Tag</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {project.tags.map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/70"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Tab Proses: sub-tab Tantangan/Solusi/Dampak (atau Konsep/Proses/Detail) */
            <>
              <div className="inline-flex rounded-full bg-white/5 p-1">
                {processEntries.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setActiveProcessKey(entry.key)}
                    className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      activeProcess?.key === entry.key ? 'bg-white text-neutral-900' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <p className="whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-white/75">
                {activeProcess?.text}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpatialProjectModal;

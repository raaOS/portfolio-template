'use client';

import React, { useState } from 'react';
import type { Project } from '@/types/projects';
import { X, ArrowUpRight, FolderGit2 } from 'lucide-react';

export function BentoProjects({
  projects,
  variant = 'grid',
}: {
  projects: Project[];
  variant?: 'grid' | 'list';
}) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  if (!projects || projects.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center text-zinc-400">
        Belum ada proyek yang dipublikasikan.
      </div>
    );
  }

  return (
    <section id="projects" className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5 text-[var(--bento-accent)]" />
          <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight">Featured Projects</h2>
        </div>
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-mono text-xs font-semibold text-[var(--bento-accent)] shadow-xs">
          {projects.length} Published
        </span>
      </div>

      {variant === 'list' ? (
        <div className="space-y-3">
          {projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => setSelectedProject(proj)}
              className="group flex cursor-pointer items-center gap-4 rounded-3xl border border-zinc-200/90 bg-white p-4 shadow-xs transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 border border-zinc-200/60">
                {proj.cover ? (
                  <img
                    src={proj.cover}
                    alt={proj.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-mono text-zinc-400">
                    No Preview
                  </div>
                )}
                <div className="absolute bottom-2 left-2">
                  <span className="rounded-full bg-white/90 px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--bento-accent)] border border-zinc-200 shadow-xs">
                    {proj.year}
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-bold text-lg text-zinc-900 group-hover:text-[var(--bento-accent)] transition">
                    {proj.title}
                  </h3>
                  <span className="shrink-0 text-xs font-mono text-zinc-400">{proj.client}</span>
                </div>
                <p className="line-clamp-2 text-xs text-zinc-600 leading-relaxed font-normal">
                  {proj.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {proj.tags?.slice(0, 4).map((tag, i) => (
                    <span
                      key={i}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <ArrowUpRight className="h-5 w-5 shrink-0 text-[var(--bento-accent)] opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {projects.map((proj, idx) => {
            const isFeatured = idx === 0;

            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProject(proj)}
                className={`group relative cursor-pointer overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md ${
                  isFeatured ? 'md:col-span-2' : ''
                }`}
              >
                {/* Media Preview Box */}
                <div className={`relative w-full overflow-hidden rounded-2xl bg-zinc-100 border border-zinc-200/60 ${isFeatured ? 'h-64 sm:h-72' : 'h-48'}`}>
                  {proj.cover ? (
                    <img
                      src={proj.cover}
                      alt={proj.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-mono text-zinc-400">
                      No Media Preview
                    </div>
                  )}

                  <div className="absolute top-3 right-3 rounded-full bg-white/90 p-2 text-zinc-800 opacity-0 group-hover:opacity-100 transition shadow-sm border border-zinc-200">
                    <ArrowUpRight className="h-4 w-4 text-[var(--bento-accent)]" />
                  </div>

                  <div className="absolute bottom-3 left-3">
                    <span className="rounded-full bg-white/90 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--bento-accent)] border border-zinc-200 shadow-xs">
                      {proj.year}
                    </span>
                  </div>
                </div>

                {/* Text Info */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-zinc-900 group-hover:text-[var(--bento-accent)] transition">
                      {proj.title}
                    </h3>
                    <span className="text-xs font-mono text-zinc-400">{proj.client}</span>
                  </div>

                  <p className="line-clamp-2 text-xs text-zinc-600 leading-relaxed font-normal">
                    {proj.description}
                  </p>

                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {proj.tags?.slice(0, 4).map((tag, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clean Light Case Study Modal Detail */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 text-zinc-900 shadow-2xl space-y-6">
            <button
              onClick={() => setSelectedProject(null)}
              className="absolute right-4 top-4 rounded-full bg-zinc-100 p-2 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition"
            >
              <X className="h-5 w-5" />
            </button>

            {selectedProject.cover && (
              <img
                src={selectedProject.cover}
                alt={selectedProject.title}
                className="aspect-video w-full rounded-2xl object-cover border border-zinc-200 shadow-xs"
              />
            )}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-extrabold text-zinc-900">{selectedProject.title}</h3>
                <span className="text-xs font-mono text-emerald-600 font-bold">{selectedProject.year}</span>
              </div>
              <p className="mt-1 text-xs font-mono text-zinc-400">Klien: {selectedProject.client}</p>
            </div>

            <p className="text-sm leading-relaxed text-zinc-700 font-normal">{selectedProject.description}</p>

            {selectedProject.narrative && (
              <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-xs text-zinc-700">
                {selectedProject.narrative.challenge && (
                  <div>
                    <strong className="text-emerald-700 block font-mono uppercase text-[10px] tracking-wider mb-0.5">Tantangan:</strong>
                    <p>{selectedProject.narrative.challenge}</p>
                  </div>
                )}
                {selectedProject.narrative.solution && (
                  <div>
                    <strong className="text-emerald-700 block font-mono uppercase text-[10px] tracking-wider mb-0.5">Solusi:</strong>
                    <p>{selectedProject.narrative.solution}</p>
                  </div>
                )}
                {selectedProject.narrative.impact && (
                  <div>
                    <strong className="text-emerald-700 block font-mono uppercase text-[10px] tracking-wider mb-0.5">Hasil / Dampak:</strong>
                    <p>{selectedProject.narrative.impact}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedProject(null)}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 transition"
              >
                Tutup Detail Case Study
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

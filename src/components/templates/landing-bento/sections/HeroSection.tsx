'use client';

import React from 'react';
import type { PortfolioTemplateData } from '@/types/template';
import {
  Sparkles,
  ArrowDownRight,
  Code2,
  FolderGit2,
  Briefcase,
  Quote,
} from 'lucide-react';

interface HeroSectionProps {
  data: PortfolioTemplateData;
  variant: 'default' | 'compact';
}

export function HeroSection({ data, variant }: HeroSectionProps) {
  const { about, projects, experiences, hardSkills } = data;

  const publishedCount = projects?.length || 0;
  const experienceCount = experiences?.length || 0;
  const skillsCount = hardSkills?.length || 0;

  const availability = about.hero.availability?.text || 'Available for projects';
  const title = about.hero.title || 'Creative Portfolio';
  const bio = about.professional.bio?.content;
  const motto = about.professional.motto?.quote;

  if (variant === 'compact') {
    return (
      <section className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-10 shadow-xs">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--bento-accent)_12%,white)] px-3.5 py-1 text-xs font-mono font-semibold text-[var(--bento-accent)] border border-[color-mix(in_srgb,var(--bento-accent)_30%,white)]">
            <span className="h-2 w-2 rounded-full bg-[var(--bento-accent)] animate-pulse" />
            <span>{availability}</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-zinc-900 leading-tight">
            {title}
          </h1>

          {bio && <p className="text-sm leading-relaxed text-zinc-600 sm:text-base font-normal max-w-2xl">{bio}</p>}

          <div className="grid grid-cols-3 max-w-md gap-3 pt-1">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[var(--bento-accent)]">
                <FolderGit2 className="h-4 w-4" />
                <span className="text-xl font-extrabold">{publishedCount}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-medium">Projects</span>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-teal-600">
                <Briefcase className="h-4 w-4" />
                <span className="text-xl font-extrabold">{experienceCount}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-medium">Pengalaman</span>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[var(--bento-accent)]">
                <Code2 className="h-4 w-4" />
                <span className="text-xl font-extrabold">{skillsCount}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-medium">Skill</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="#projects"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bento-accent)] hover:brightness-110 px-5 py-2.5 text-xs font-bold text-white transition shadow-xs"
            >
              <span>Eksplor Project</span>
              <ArrowDownRight className="h-4 w-4" />
            </a>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 px-5 py-2.5 text-xs font-semibold text-zinc-800 transition"
            >
              <span>Hubungi Saya</span>
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
      {/* Tile 1: Main Bio Hero Card (Spans 2 cols) */}
      <div className="group relative md:col-span-2 overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs hover:border-zinc-300 transition-all duration-300">
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--bento-accent)_12%,white)] px-3.5 py-1 text-xs font-mono font-semibold text-[var(--bento-accent)] border border-[color-mix(in_srgb,var(--bento-accent)_30%,white)]">
            <span className="h-2 w-2 rounded-full bg-[var(--bento-accent)] animate-pulse" />
            <span>{availability}</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-zinc-900 leading-tight">
            {title}
          </h1>

          {bio && (
            <p className="text-sm leading-relaxed text-zinc-600 sm:text-base font-normal max-w-xl">
              {bio}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#projects"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bento-accent)] hover:brightness-110 px-5 py-2.5 text-xs font-bold text-white transition shadow-xs"
            >
              <span>Eksplor Project</span>
              <ArrowDownRight className="h-4 w-4" />
            </a>

            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 px-5 py-2.5 text-xs font-semibold text-zinc-800 transition"
            >
              <span>Hubungi Saya</span>
            </a>
          </div>
        </div>
      </div>

      {/* Tile 2: Quick Metrics / Stats Card (1 col) */}
      <div className="flex flex-col justify-between rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs hover:border-zinc-300 transition">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Metrik Portofolio</span>
          <Sparkles className="h-4 w-4 text-[var(--bento-accent)]" />
        </div>

        <div className="my-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[var(--bento-accent)]">
              <FolderGit2 className="h-4 w-4" />
              <span className="text-xl font-extrabold">{publishedCount}</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">Projects</span>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-teal-600">
              <Briefcase className="h-4 w-4" />
              <span className="text-xl font-extrabold">{experienceCount}</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium">Pengalaman</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--bento-accent)_30%,white)] bg-[color-mix(in_srgb,var(--bento-accent)_10%,white)] p-3.5 text-xs text-[var(--bento-accent)] flex items-center justify-between font-mono font-semibold">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            <span>Tech Stack</span>
          </div>
          <span className="font-extrabold">{skillsCount} Skill</span>
        </div>
      </div>

      {/* Tile 3: Featured Motto / Philosophy Card (1 col) */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs hover:border-zinc-300 transition">
        <Quote className="absolute -bottom-2 -right-2 h-20 w-20 text-zinc-100 pointer-events-none" />

        <div className="space-y-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--bento-accent)] font-bold block">
            Filosofi Desain
          </span>

          {motto ? (
            <blockquote className="text-sm italic leading-relaxed text-zinc-700 border-l-2 border-[var(--bento-accent)] pl-3">
              &quot;{motto}&quot;
            </blockquote>
          ) : (
            <p className="text-xs text-zinc-500 italic">
              &quot;Desain adalah Hook: Bikin mereka berhenti scroll, lalu mengerti.&quot;
            </p>
          )}
        </div>
      </div>

      {/* Tile 4: Top Tech Stack Preview Card (2 cols) */}
      <div className="md:col-span-2 rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Keahlian Utama</span>
          <a href="#skills" className="text-[11px] font-semibold text-[var(--bento-accent)] hover:underline">
            Lihat Semua ({skillsCount}) →
          </a>
        </div>

        <div className="flex flex-wrap gap-2">
          {hardSkills && hardSkills.length > 0 ? (
            hardSkills.slice(0, 8).map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-800 font-medium hover:border-[color-mix(in_srgb,var(--bento-accent)_50%,white)] hover:bg-[color-mix(in_srgb,var(--bento-accent)_8%,white)] transition"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--bento-accent)]" />
                <span>{skill.name}</span>
                <span className="text-[10px] font-mono text-zinc-400">[{skill.level}]</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-400">Belum ada keahlian terdaftar.</p>
          )}
        </div>
      </div>
    </section>
  );
}
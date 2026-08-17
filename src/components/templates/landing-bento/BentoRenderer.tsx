'use client';

import React from 'react';
import type { TemplateRendererProps } from '@/types/template';
import { BentoHeader } from './components/BentoHeader';
import { BentoProjects } from './components/BentoProjects';
import { BentoExperience } from './components/BentoExperience';
import { BentoContact } from './components/BentoContact';
import { BentoImageSequence } from './components/BentoImageSequence';
import {
  Sparkles,
  ArrowDownRight,
  Code2,
  FolderGit2,
  Briefcase,
  Quote,
} from 'lucide-react';

export default function BentoRenderer({ data }: TemplateRendererProps) {
  const { about, projects, experiences, hardSkills, contact } = data;

  const publishedCount = projects?.length || 0;
  const experienceCount = experiences?.length || 0;
  const skillsCount = hardSkills?.length || 0;

  return (
    <div className="min-h-screen w-full bg-[#fafafa] text-zinc-900 selection:bg-emerald-500 selection:text-white font-sans antialiased">
      <BentoHeader data={data} />

      <main className="mx-auto max-w-6xl space-y-10 px-4 sm:px-6 py-8">
        {/* Clean Asymmetric Bento Hero Grid Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {/* Tile 1: Main Bio Hero Card (Spans 2 cols) */}
          <div className="group relative md:col-span-2 overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs hover:border-zinc-300 transition-all duration-300">
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-mono font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{about.hero.availability?.text || 'Available for projects'}</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-zinc-900 leading-tight">
                {about.hero.title || 'Creative Portfolio'}
              </h1>

              {about.professional.bio?.content && (
                <p className="text-sm leading-relaxed text-zinc-600 sm:text-base font-normal max-w-xl">
                  {about.professional.bio.content}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#projects"
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 hover:bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition shadow-xs"
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
              <Sparkles className="h-4 w-4 text-emerald-600" />
            </div>

            <div className="my-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-600">
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

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-800 flex items-center justify-between font-mono font-semibold">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-600" />
                <span>Tech Stack</span>
              </div>
              <span className="font-extrabold">{skillsCount} Skill</span>
            </div>
          </div>

          {/* Tile 3: Featured Motto / Philosophy Card (1 col) */}
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs hover:border-zinc-300 transition">
            <Quote className="absolute -bottom-2 -right-2 h-20 w-20 text-zinc-100 pointer-events-none" />

            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-bold block">
                Filosofi Desain
              </span>

              {about.professional.motto?.quote ? (
                <blockquote className="text-sm italic leading-relaxed text-zinc-700 border-l-2 border-emerald-600 pl-3">
                  "{about.professional.motto.quote}"
                </blockquote>
              ) : (
                <p className="text-xs text-zinc-500 italic">
                  "Desain adalah Hook: Bikin mereka berhenti scroll, lalu mengerti."
                </p>
              )}
            </div>
          </div>

          {/* Tile 4: Top Tech Stack Preview Card (2 cols) */}
          <div className="md:col-span-2 rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Keahlian Utama</span>
              <a href="#skills" className="text-[11px] font-semibold text-emerald-600 hover:underline">
                Lihat Semua ({skillsCount}) →
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              {hardSkills && hardSkills.length > 0 ? (
                hardSkills.slice(0, 8).map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-800 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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

        {/* 360° Interactive Image Sequence Animation Section */}
        <BentoImageSequence
          title="Interactive 360° Sequence Showcase"
          subtitle="Teknologi Canvas Image Sequence: Bebas diputar 360 derajat secara interaktif tanpa kompresi video MP4 dan 100% mulus di mobile."
        />

        {/* Bento Projects Section */}
        <BentoProjects projects={projects} />

        {/* Experience & Skills Section */}
        <BentoExperience experiences={experiences} skills={hardSkills} />

        {/* Contact Section */}
        <BentoContact contact={contact} />
      </main>

      <footer className="w-full border-t border-zinc-200 py-8 text-center text-xs text-zinc-400 font-medium">
        © {new Date().getFullYear()} {data.site.title}. Powered by Portfolio OS Multi-Template.
      </footer>
    </div>
  );
}

'use client';

import React from 'react';
import type { WorkExperience } from '@/types/experience';
import type { HardSkill } from '@/types/hardSkill';
import { Briefcase, Terminal } from 'lucide-react';

const REMOVED_SIMPLE_ICONS = /cdn\.simpleicons\.org\/(adobephotoshop|adobeillustrator|canva)(?:[/?#]|$)/i;

function SkillIcon({ skill }: { skill: HardSkill }) {
  if (skill.iconUrl && !REMOVED_SIMPLE_ICONS.test(skill.iconUrl)) {
    return <img src={skill.iconUrl} alt={skill.name} className="h-4 w-4 object-contain" />;
  }

  const initials = skill.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-100 text-[7px] font-extrabold text-emerald-800 border border-emerald-200"
    >
      {initials}
    </span>
  );
}

export function BentoExperience({
  experiences,
  skills,
}: {
  experiences: WorkExperience[];
  skills: HardSkill[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Experience Card */}
      <section id="experience" className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs hover:border-zinc-300 transition">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-4 mb-4">
          <Briefcase className="h-5 w-5 text-emerald-600" />
          <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight">Work Experience</h2>
        </div>

        <div className="space-y-6">
          {experiences && experiences.length > 0 ? (
            experiences.map((exp) => (
              <div key={exp.id} className="relative border-l-2 border-emerald-500 pl-5 py-1">
                <div className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">{exp.year}</span>
                <h3 className="font-bold text-base text-zinc-900">{exp.position}</h3>
                <p className="text-xs font-semibold text-zinc-500">{exp.company}</p>
                {exp.description && exp.description.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-600 leading-relaxed">{exp.description.join(' ')}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-400">Belum ada riwayat pengalaman.</p>
          )}
        </div>
      </section>

      {/* Skills Card */}
      <section id="skills" className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs hover:border-zinc-300 transition">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-4 mb-4">
          <Terminal className="h-5 w-5 text-teal-600" />
          <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight">Skills & Tech Stack</h2>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {skills && skills.length > 0 ? (
            skills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-emerald-50/50 hover:border-emerald-300 px-3.5 py-2 text-xs text-zinc-800 transition font-medium"
              >
                <SkillIcon skill={skill} />
                <span>{skill.name}</span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded border border-emerald-200">
                  {skill.level}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-400">Belum ada keahlian terdaftar.</p>
          )}
        </div>
      </section>
    </div>
  );
}

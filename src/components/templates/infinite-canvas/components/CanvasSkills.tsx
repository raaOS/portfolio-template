'use client';

import React from 'react';
import type { HardSkill } from '@/types/hardSkill';
import { Cpu } from 'lucide-react';

interface CanvasSkillsProps {
  skills: HardSkill[];
  style?: React.CSSProperties;
}

const levelBadges: Record<string, string> = {
  Beginner: 'text-neutral-600 bg-neutral-100 border-neutral-200',
  Intermediate: 'text-neutral-700 bg-neutral-100 border-neutral-200 font-medium',
  Advanced: 'text-neutral-800 bg-neutral-100 border-neutral-300 font-semibold',
  Expert: 'text-neutral-900 bg-neutral-200/80 border-neutral-300 font-bold',
};

export function CanvasSkills({ skills, style }: CanvasSkillsProps) {
  if (!skills || skills.length === 0) return null;

  return (
    <div
      className="absolute select-none -translate-x-1/2 -translate-y-1/2 bg-white border border-neutral-200 rounded-2xl p-6 w-80 md:w-96 space-y-4 transition-all duration-300 hover:border-neutral-400"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
        <div className="p-2 rounded-lg bg-neutral-100 text-neutral-900">
          <Cpu className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-neutral-900 text-sm font-bold tracking-tight">Keahlian & Teknologi</h3>
          <p className="text-neutral-400 text-[10px] font-mono uppercase tracking-wider">HARD SKILLS & TOOLS</p>
        </div>
      </div>

      {/* Grid of Skills */}
      <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200/70 hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
          >
            {skill.iconUrl ? (
              <img
                src={skill.iconUrl}
                alt={skill.name}
                className="w-6 h-6 object-contain rounded shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center text-[10px] font-bold text-neutral-800 shrink-0">
                {skill.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-neutral-900 text-xs font-semibold block truncate">
                {skill.name}
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border inline-block mt-0.5 ${
                  levelBadges[skill.level] || 'text-neutral-600 bg-neutral-100 border-neutral-200'
                }`}
              >
                {skill.level || 'Skill'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

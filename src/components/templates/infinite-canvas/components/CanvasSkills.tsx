'use client';

import React from 'react';
import type { HardSkill } from '@/types/hardSkill';
import { Cpu } from 'lucide-react';

interface CanvasSkillsProps {
  skills: HardSkill[];
  style?: React.CSSProperties;
}

const levelColors: Record<string, string> = {
  Beginner: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  Intermediate: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Advanced: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  Expert: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

export function CanvasSkills({ skills, style }: CanvasSkillsProps) {
  if (!skills || skills.length === 0) return null;

  return (
    <div
      className="absolute select-none bg-[#1c1c24]/90 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md w-80 md:w-96 space-y-4 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-indigo-500/10"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
          <Cpu className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-white text-sm font-semibold tracking-tight">Keahlian & Teknologi</h3>
          <p className="text-white/40 text-[10px] font-mono">Hard Skills & Tools</p>
        </div>
      </div>

      {/* Grid of Skills */}
      <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-colors"
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
              <div className="w-6 h-6 rounded bg-indigo-600/30 flex items-center justify-center text-[10px] font-bold text-indigo-300 shrink-0">
                {skill.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-white text-xs font-medium block truncate">
                {skill.name}
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border inline-block mt-0.5 ${
                  levelColors[skill.level] || 'text-white/60 bg-white/5 border-white/10'
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

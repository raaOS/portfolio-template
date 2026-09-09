'use client';

import React from 'react';
import type { WorkExperience } from '@/types/experience';
import { Briefcase } from 'lucide-react';

interface CanvasExperienceProps {
  experiences: WorkExperience[];
  style?: React.CSSProperties;
}

export function CanvasExperience({ experiences, style }: CanvasExperienceProps) {
  if (!experiences || experiences.length === 0) return null;

  return (
    <div
      className="absolute select-none bg-[#1c1c24]/90 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md w-80 md:w-96 space-y-4 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-indigo-500/10"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
          <Briefcase className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-white text-sm font-semibold tracking-tight">Pengalaman Kerja</h3>
          <p className="text-white/40 text-[10px] font-mono">Riwayat Karir & Track Record</p>
        </div>
      </div>

      {/* Timeline Items */}
      <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
        {experiences.map((exp, idx) => (
          <div key={exp.id || idx} className="relative pl-4 border-l-2 border-emerald-500/30 space-y-1">
            <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-[#1c1c24]" />
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-semibold">{exp.position}</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                {exp.year}
              </span>
            </div>
            <p className="text-white/60 text-xs font-medium">{exp.company}</p>
            {exp.description && exp.description.length > 0 && (
              <p className="text-white/40 text-[11px] leading-relaxed line-clamp-2">
                {Array.isArray(exp.description) ? exp.description.join(' ') : exp.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

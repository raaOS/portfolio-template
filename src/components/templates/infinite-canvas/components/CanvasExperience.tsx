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
      className="absolute select-none -translate-x-1/2 -translate-y-1/2 bg-white border border-neutral-200 rounded-2xl p-6 w-80 md:w-96 space-y-4 transition-all duration-300 hover:border-neutral-400"
      style={style}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
        <div className="p-2 rounded-lg bg-neutral-100 text-neutral-900">
          <Briefcase className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-neutral-900 text-sm font-bold tracking-tight">Pengalaman Kerja</h3>
          <p className="text-neutral-400 text-[10px] font-mono uppercase tracking-wider">RIWAYAT KARIR & TRACK RECORD</p>
        </div>
      </div>

      {/* Timeline Items */}
      <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
        {experiences.map((exp, idx) => (
          <div key={exp.id || idx} className="relative pl-4 border-l-2 border-neutral-200 space-y-1">
            <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-neutral-900 ring-4 ring-white" />
            <div className="flex items-center justify-between">
              <span className="text-neutral-900 text-xs font-bold">{exp.position}</span>
              <span className="text-[10px] font-mono text-neutral-600 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded font-medium">
                {exp.year}
              </span>
            </div>
            <p className="text-neutral-600 text-xs font-medium">{exp.company}</p>
            {exp.description && exp.description.length > 0 && (
              <p className="text-neutral-500 text-[11px] leading-relaxed line-clamp-2">
                {Array.isArray(exp.description) ? exp.description.join(' ') : exp.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

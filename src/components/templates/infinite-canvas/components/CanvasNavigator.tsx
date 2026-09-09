'use client';

import React from 'react';
import { User, Briefcase, Cpu, FolderGit2, Send } from 'lucide-react';

export type CanvasClusterKey = 'profile' | 'projects' | 'skills' | 'experience' | 'contact';

interface CanvasNavigatorProps {
  activeCluster?: CanvasClusterKey;
  onNavigate: (key: CanvasClusterKey) => void;
  hasSkills?: boolean;
  hasExperience?: boolean;
}

export function CanvasNavigator({
  activeCluster,
  onNavigate,
  hasSkills = true,
  hasExperience = true,
}: CanvasNavigatorProps) {
  const items: Array<{ key: CanvasClusterKey; label: string; icon: React.ReactNode; show: boolean }> = [
    { key: 'profile', label: 'Profil', icon: <User className="w-3.5 h-3.5" />, show: true },
    { key: 'projects', label: 'Karya', icon: <FolderGit2 className="w-3.5 h-3.5" />, show: true },
    { key: 'skills', label: 'Keahlian', icon: <Cpu className="w-3.5 h-3.5" />, show: hasSkills },
    { key: 'experience', label: 'Karir', icon: <Briefcase className="w-3.5 h-3.5" />, show: hasExperience },
    { key: 'contact', label: 'Kontak', icon: <Send className="w-3.5 h-3.5" />, show: true },
  ];

  return (
    <nav
      aria-label="Canvas Section Navigation"
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 rounded-full bg-[#1c1c24]/85 backdrop-blur-xl border border-white/15 shadow-2xl select-none"
    >
      {items
        .filter((item) => item.show)
        .map((item) => {
          const isActive = activeCluster === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
    </nav>
  );
}

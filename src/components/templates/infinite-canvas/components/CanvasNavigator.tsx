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
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 rounded-full bg-white/95 backdrop-blur-md border border-neutral-200 select-none"
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-neutral-900 text-white font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 font-medium'
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

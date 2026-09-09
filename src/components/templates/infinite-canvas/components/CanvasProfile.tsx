'use client';

import React from 'react';

interface CanvasProfileProps {
  name: string;
  title?: string;
  bio: string;
  avatarUrl?: string;
  availability?: {
    status?: 'available' | 'booked' | 'limited';
    text?: string;
  };
  onExploreProjects?: () => void;
  onContact?: () => void;
}

/**
 * CanvasProfile — Kartu profil di pusat canvas (0, 0).
 * Menampilkan avatar, nama lengkap, gelar/headline, status ketersediaan, bio, dan tombol aksi.
 */
export function CanvasProfile({
  name,
  title,
  bio,
  avatarUrl,
  availability,
  onExploreProjects,
  onContact,
}: CanvasProfileProps) {
  const isAvailable = availability?.status !== 'booked';
  const availabilityText = availability?.text || (isAvailable ? 'Available for work' : 'Currently booked');

  return (
    <div className="relative flex flex-col items-center gap-4 p-8 rounded-2xl bg-[#1c1c24]/80 border border-white/10 shadow-2xl backdrop-blur-md max-w-sm text-center select-none transition-all duration-300 hover:border-white/20">
      {/* Availability Status Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/80">
        <span
          className={`h-2 w-2 rounded-full ${
            isAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span className="font-mono text-[11px] tracking-wide">{availabilityText}</span>
      </div>

      {/* Avatar */}
      {avatarUrl ? (
        <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 shadow-lg group">
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 border-2 border-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          {name.charAt(0) || 'P'}
        </div>
      )}

      {/* Identity */}
      <div className="space-y-1">
        <h1 className="text-white text-2xl font-semibold tracking-tight">{name}</h1>
        {title && (
          <p className="text-indigo-400 text-xs font-mono font-medium tracking-wide uppercase">
            {title}
          </p>
        )}
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-white/70 text-xs leading-relaxed line-clamp-4 max-w-xs">
          {bio}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10 w-full">
        {onExploreProjects && (
          <button
            type="button"
            onClick={onExploreProjects}
            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Karya 💼
          </button>
        )}
        {onContact && (
          <button
            type="button"
            onClick={onContact}
            className="flex-1 px-3 py-2 text-xs font-medium text-white/90 bg-white/10 hover:bg-white/15 rounded-lg border border-white/10 transition-colors cursor-pointer"
          >
            Kontak 📬
          </button>
        )}
      </div>

      <p className="text-white/30 text-[10px] font-mono tracking-widest uppercase mt-1">
        Drag to explore • Scroll to zoom
      </p>
    </div>
  );
}

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
    <div className="relative flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border border-neutral-200 shadow-[0_8px_30px_rgba(0,0,0,0.06)] max-w-sm text-center select-none transition-all duration-300 hover:border-neutral-300 hover:shadow-[0_12px_36px_rgba(0,0,0,0.09)]">
      {/* Availability Status Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-50 border border-neutral-200 text-xs text-neutral-700">
        <span
          className={`h-2 w-2 rounded-full ${
            isAvailable ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
        <span className="font-mono text-[11px] tracking-wide font-medium">{availabilityText}</span>
      </div>

      {/* Avatar */}
      {avatarUrl ? (
        <div className="relative w-24 h-24 rounded-full overflow-hidden border border-neutral-200 shadow-sm group">
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="w-24 h-24 rounded-full bg-neutral-900 border border-neutral-200 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
          {name.charAt(0) || 'P'}
        </div>
      )}

      {/* Identity */}
      <div className="space-y-1">
        <h1 className="text-neutral-900 text-2xl font-bold tracking-tight">{name}</h1>
        {title && (
          <p className="text-neutral-500 text-xs font-mono font-medium tracking-wider uppercase">
            {title}
          </p>
        )}
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-neutral-600 text-xs leading-relaxed line-clamp-4 max-w-xs font-normal">
          {bio}
        </p>
      )}

      {/* Action Buttons (NO EMOJIS, SOLID CONTRAST) */}
      <div className="flex items-center gap-2 mt-2 pt-3 border-t border-neutral-100 w-full">
        {onExploreProjects && (
          <button
            type="button"
            onClick={onExploreProjects}
            className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Jelajahi Karya
          </button>
        )}
        {onContact && (
          <button
            type="button"
            onClick={onContact}
            className="flex-1 px-3 py-2 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
          >
            Hubungi Saya
          </button>
        )}
      </div>

      <p className="text-neutral-400 text-[10px] font-mono tracking-widest uppercase mt-0.5">
        DRAG CANVAS • SCROLL ZOOM
      </p>
    </div>
  );
}

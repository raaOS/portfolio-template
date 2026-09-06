'use client';

import React from 'react';

interface CanvasProfileProps {
  name: string;
  bio: string;
  avatarUrl?: string;
}

/**
 * CanvasProfile — Kartu profil di tengah canvas.
 * Menampilkan foto, nama, dan bio singkat.
 */
export function CanvasProfile({ name, bio, avatarUrl }: CanvasProfileProps) {
  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {avatarUrl && (
        <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-white/20">
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="text-center">
        <h1 className="text-white text-xl font-medium">{name}</h1>
        <p className="text-white/50 text-sm mt-1 max-w-xs">{bio}</p>
      </div>
      <p className="text-white/30 text-xs font-mono mt-2 tracking-widest uppercase">
        Click & drag to explore
      </p>
    </div>
  );
}

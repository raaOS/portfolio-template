'use client';

import React from 'react';

/**
 * CornerBrackets — 4 sudut penanda area canvas.
 * Meniru style Chung-Sung Lau: bracket L di setiap pojok.
 */
export function CornerBrackets() {
  return (
    <>
      {/* Top Left */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-neutral-400/70 pointer-events-none" />
      {/* Top Right */}
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-neutral-400/70 pointer-events-none" />
      {/* Bottom Left */}
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-neutral-400/70 pointer-events-none" />
      {/* Bottom Right */}
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-neutral-400/70 pointer-events-none" />
    </>
  );
}

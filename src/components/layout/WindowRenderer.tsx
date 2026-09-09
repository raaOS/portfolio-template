'use client';

import React from 'react';
import { AnimatePresence } from 'motion/react';
import OSWindow from '@/components/os/windows/Window';
import { useWindowContext } from '@/contexts/WindowContext';

export default function WindowRenderer() {
  const { windows, closeWindow } = useWindowContext();
  const openWindows = windows.filter((w) => w.isOpen && !w.isMinimized);

  if (openWindows.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[500] overflow-hidden">
      <AnimatePresence>
        {openWindows.map((window) => (
          <OSWindow
            key={window.id}
            id={window.id}
            title={window.title}
            isOpen={window.isOpen}
            isMinimized={window.isMinimized}
            isMaximized={window.isMaximized}
            zIndex={window.zIndex}
            noPadding={window.noPadding}
            initialPosition={window.initialPosition}
            width={window.width}
            height={window.height}
            onClose={() => closeWindow(window.id)}
          >
            {window.content}
          </OSWindow>
        ))}
      </AnimatePresence>
    </div>
  );
}

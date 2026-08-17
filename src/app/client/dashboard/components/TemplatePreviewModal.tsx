'use client';

import React from 'react';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteSlug: string;
  templateKey: string;
  templateName: string;
}

export function TemplatePreviewModal({
  isOpen,
  onClose,
  siteSlug,
  templateKey,
  templateName,
}: TemplatePreviewModalProps) {
  if (!isOpen) return null;

  const previewUrl = `/${siteSlug}?preview_template=${templateKey}`;

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-[#121216] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white">
              Live Preview: <span className="text-emerald-400">{templateName}</span>
            </h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">
              Sandboxed (Non-Mutating)
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/20 hover:text-white"
          >
            Tutup Preview
          </button>
        </div>

        {/* Iframe Frame */}
        <div className="relative flex-1 bg-black">
          <iframe
            src={previewUrl}
            title={`Preview ${templateName}`}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      </div>
    </div>
  );
}

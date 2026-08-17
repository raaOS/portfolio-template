'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import OSDesktopRenderer from '@/components/templates/os-desktop/OSDesktopRenderer';
import type { TemplateRendererProps } from '@/types/template';

// Lazy load future non-OS templates to preserve Cloudflare Worker bundle size
const BentoRenderer = dynamic(() => import('@/components/templates/landing-bento/BentoRenderer'), {
  ssr: true,
  loading: () => <TemplateLoadingSkeleton />,
});

function TemplateLoadingSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#050505] text-white/70">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <span className="font-mono text-xs uppercase tracking-widest text-white/50">Memuat Template...</span>
      </div>
    </div>
  );
}

export default function TemplateDispatcher(props: TemplateRendererProps) {
  const { data } = props;
  const activeKey = data.site.activeTemplateKey || 'os-desktop';

  switch (activeKey) {
    case 'landing-bento':
      return <BentoRenderer {...props} />;
    case 'os-desktop':
    default:
      return <OSDesktopRenderer {...props} />;
  }
}

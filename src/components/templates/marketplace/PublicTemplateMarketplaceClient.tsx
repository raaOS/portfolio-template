'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Eye,
  Layers,
  Laptop,
  Smartphone,
  Tablet,
  X,
  Maximize2,
} from 'lucide-react';
import type { TemplateMetadata } from '@/types/template';

interface PublicTemplateMarketplaceClientProps {
  initialTemplates: TemplateMetadata[];
}

export function PublicTemplateMarketplaceClient({
  initialTemplates,
}: PublicTemplateMarketplaceClientProps) {
  const [previewModalTemplate, setPreviewModalTemplate] = useState<TemplateMetadata | null>(null);
  const [deviceFrame, setDeviceFrame] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  return (
    <div className="min-h-screen w-full bg-[#fafafa] text-zinc-900 font-sans antialiased">
      {/* Clean Navbar */}
      <nav className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold text-lg text-zinc-900 hover:text-emerald-600 transition">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Layers className="h-4 w-4" />
            </div>
            <span>Portfolio OS</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/client/login"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 px-3 py-2 transition"
            >
              Login Client
            </Link>
            <Link
              href="/checkout?plan=pro"
              className="rounded-lg bg-zinc-900 hover:bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition"
            >
              Dapatkan Paket Pro
            </Link>
          </div>
        </div>
      </nav>

      {/* Minimalist Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-zinc-900">
          Template Portofolio <span className="text-emerald-600">Modern</span>
        </h1>
        <p className="mt-4 text-sm text-zinc-500 font-normal leading-relaxed max-w-xl mx-auto">
          Bebas berganti tampilan kapan saja tanpa risiko kehilangan data profil atau karya Anda.
        </p>
      </section>

      {/* Clean 2-Card Grid */}
      <main className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {initialTemplates.map((tpl) => {
            const isPro = tpl.tierRequired === 'pro';

            return (
              <div
                key={tpl.id}
                className="group flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs hover:border-zinc-300 hover:shadow-md transition"
              >
                {/* Micro Graphic Preview Banner */}
                <div className="relative h-52 w-full overflow-hidden border-b border-zinc-200 bg-zinc-100 p-4 flex items-center justify-center">
                  <div className="absolute top-2.5 left-3 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-zinc-300" />
                    <span className="h-2 w-2 rounded-full bg-zinc-300" />
                    <span className="h-2 w-2 rounded-full bg-zinc-300" />
                  </div>

                  {tpl.id === 'os-desktop' && (
                    <div className="h-full w-full rounded-lg border border-zinc-200 bg-white p-3 flex flex-col justify-between shadow-xs">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-100 pb-1 font-mono">
                        <span className="font-bold text-zinc-800">Finder</span>
                        <span>10:42 AM</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 my-auto text-[10px] font-bold text-zinc-700">
                        <div className="rounded border border-zinc-200 bg-zinc-50 p-2 text-emerald-700">💻 Projects</div>
                        <div className="rounded border border-zinc-200 bg-zinc-50 p-2">💬 Contact</div>
                      </div>
                    </div>
                  )}

                  {tpl.id === 'landing-bento' && (
                    <div className="grid h-full w-full grid-cols-3 gap-2">
                      <div className="col-span-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-xs">
                        <span className="text-[10px] font-bold text-emerald-700 font-mono block">Bento Hero</span>
                        <p className="text-[11px] font-bold text-zinc-800 mt-1">Fullstack Portfolio</p>
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-white p-3 flex flex-col justify-between text-[10px] font-bold text-zinc-800 shadow-xs">
                        <span className="text-zinc-400 text-[9px]">STACK</span>
                        <span>React 19</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info & Single Action Bar */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-zinc-900 group-hover:text-emerald-600 transition">
                      {tpl.name}
                    </h3>
                    <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-600 border border-zinc-200">
                      {isPro ? 'PRO' : 'LITE & PRO'}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                    {tpl.description}
                  </p>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setPreviewModalTemplate(tpl)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Pratinjau</span>
                    </button>

                    <Link
                      href={`/checkout?plan=${tpl.tierRequired}&template=${tpl.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition"
                    >
                      <span>Gunakan Template</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Clean Preview Modal */}
      {previewModalTemplate && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-xs">
          <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 bg-zinc-100 px-4 py-3 text-xs text-zinc-900">
              <span className="font-bold">{previewModalTemplate.name}</span>

              {/* Device Frame Switcher */}
              <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
                {[
                  { id: 'desktop', icon: Laptop, label: 'Desktop' },
                  { id: 'tablet', icon: Tablet, label: 'Tablet' },
                  { id: 'mobile', icon: Smartphone, label: 'Mobile' },
                ].map((d) => {
                  const DeviceIcon = d.icon;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDeviceFrame(d.id as typeof deviceFrame)}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                        deviceFrame === d.id
                          ? 'bg-zinc-900 text-white font-bold'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <DeviceIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{d.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/templates/${previewModalTemplate.id}/demo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 transition flex items-center gap-1 text-xs font-semibold"
                  title="Buka Fullscreen di Tab Baru"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </a>
                <Link
                  href={`/checkout?plan=${previewModalTemplate.tierRequired}&template=${previewModalTemplate.id}`}
                  className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 transition"
                >
                  Pilih Template Ini
                </Link>
                <button
                  type="button"
                  onClick={() => setPreviewModalTemplate(null)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition"
                  title="Tutup Modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-zinc-100 p-3 flex items-center justify-center overflow-auto">
              <div
                className={`h-full border border-zinc-200 rounded-lg overflow-hidden shadow-md transition-all duration-300 ${
                  deviceFrame === 'desktop'
                    ? 'w-full'
                    : deviceFrame === 'tablet'
                      ? 'w-[768px] max-w-full'
                      : 'w-[375px] max-w-full'
                }`}
              >
                <iframe
                  src={`/templates/${previewModalTemplate.id}/demo`}
                  title="Template Preview"
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import type { TemplateMetadata } from '@/types/template';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import {
  Eye,
  Sparkles,
  Check,
  Crown,
  Zap,
  CheckCircle2,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface CatalogItem extends TemplateMetadata {
  isEntitled: boolean;
  isActive: boolean;
}

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteSlug: string;
  onTemplateChanged?: (newKey: string) => void;
}

export function TemplatePickerModal({
  isOpen,
  onClose,
  siteSlug,
  onTemplateChanged,
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<CatalogItem[]>([]);
  const [activeKey, setActiveKey] = useState<string>('os-desktop');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingKey, setActivatingKey] = useState<string | null>(null);

  // Preview State
  const [previewItem, setPreviewItem] = useState<CatalogItem | null>(null);

  const loadCatalog = async () => {
    try {
      const res = await fetch('/api/client/template');
      if (!res.ok) throw new Error('Gagal memuat katalog template');
      const data = await res.json();
      setTemplates(data.templates || []);
      setActiveKey(data.activeKey || 'os-desktop');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (isOpen) {
      void (async () => {
        if (active) {
          await loadCatalog();
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleActivate = async (templateId: string) => {
    try {
      setActivatingKey(templateId);
      setError(null);

      const res = await fetch('/api/client/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengaktifkan template');

      setActiveKey(templateId);
      if (onTemplateChanged) onTemplateChanged(templateId);
      loadCatalog();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActivatingKey(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-[#0c0d12] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Pilih Template Website</span>
            </h2>
            <p className="text-xs text-slate-400">Ganti gaya visual tampilan situs Anda tanpa mengubah data profil & proyek.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-slate-400 transition hover:bg-white/20 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Memuat katalog template...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {templates.map((tpl) => {
                const isCurrent = tpl.id === activeKey;
                const isActivating = activatingKey === tpl.id;

                return (
                  <div
                    key={tpl.id}
                    className={`relative flex flex-col justify-between rounded-2xl border p-5 transition duration-200 ${
                      isCurrent
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-white text-base">{tpl.name}</h3>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Aktif
                          </span>
                        ) : tpl.isEntitled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/20">
                            <Zap className="w-3 h-3 text-emerald-400" />
                            Tersedia
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                            <Crown className="w-3 h-3 text-amber-300" />
                            Khusus {tpl.tierRequired.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-slate-300 leading-relaxed min-h-[2.5rem]">{tpl.description}</p>

                      {tpl.features && (
                        <ul className="mt-3 space-y-1.5 min-h-[90px] border-t border-white/10 pt-3">
                          {tpl.features.map((f, idx) => (
                            <li key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
                      <button
                        onClick={() => setPreviewItem(tpl)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Live Preview</span>
                      </button>

                      {isCurrent ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/30 opacity-80"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Template Aktif</span>
                        </button>
                      ) : tpl.isEntitled ? (
                        <button
                          onClick={() => handleActivate(tpl.id)}
                          disabled={isActivating}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
                        >
                          {isActivating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                              <span>Mengaktifkan...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                              <span>Aktifkan</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <a
                          href={`/checkout?plan=${tpl.tierRequired}&template=${tpl.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-300" />
                          <span>Upgrade Tier</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sandboxed Preview Modal */}
      {previewItem && (
        <TemplatePreviewModal
          isOpen={!!previewItem}
          onClose={() => setPreviewItem(null)}
          siteSlug={siteSlug}
          templateKey={previewItem.id}
          templateName={previewItem.name}
        />
      )}
    </div>
  );
}

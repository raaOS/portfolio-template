'use client';

import React, { useState } from 'react';
import { Check, Folder, PlayCircle, Timer, Palette, Hash, Layers, Sparkles } from 'lucide-react';
import type { Project } from '@/types/projects';
import type { LoaderConfig, LoaderStyle } from '@/types/about';
import { resolveCover } from '@/lib/images';

const MAX_IMAGES = 10;
const MIN_DURATION = 1000;
const MAX_DURATION = 10000;
const STEP_DURATION = 100;
const DEFAULT_DURATION_MS = 2800;

const STYLE_OPTIONS: { key: LoaderStyle; label: string; description: string }[] = [
  {
    key: 'deck-reveal',
    label: 'Deck Reveal',
    description: 'Tumpukan gambar cover project melebar berjenjang + counter.',
  },
  {
    key: 'hello',
    label: 'Hello',
    description: 'Animasi lottie HELLO — satu putaran penuh, lalu memudar.',
  },
];

const DEFAULT_CONFIG: LoaderConfig = {
  enabled: false,
  style: 'deck-reveal',
  imageProjectIds: [],
  durationMs: DEFAULT_DURATION_MS,
  accentColor: '#1500E1',
  showCounter: true,
};

interface LoaderManagerFormProps {
  data?: LoaderConfig;
  projects: Project[];
  onUpdate: (data: LoaderConfig) => void;
  isLoading?: boolean;
}

/** Ambil URL gambar statis dari project (cover image, atau poster untuk video). */
function pickProjectImage(project: Project): string | null {
  if (!project.cover) return null; // cover kosong → resolveCover balikin SVG placeholder
  const cover = resolveCover(project);
  if (cover.kind === 'image') return cover.src;
  return cover.poster ?? null;
}

export default function LoaderManagerForm({
  data,
  projects,
  onUpdate,
  isLoading,
}: LoaderManagerFormProps) {
  const [config, setConfig] = useState<LoaderConfig>({
    ...DEFAULT_CONFIG,
    ...data,
    imageProjectIds: data?.imageProjectIds || [],
  });

  // Sync state dengan props saat data dari server berubah
  const [lastData, setLastData] = useState(data);
  if (data && data !== lastData) {
    setConfig({ ...DEFAULT_CONFIG, ...data, imageProjectIds: data.imageProjectIds || [] });
    setLastData(data);
  }

  const update = (updates: Partial<LoaderConfig>) => {
    const next = { ...config, ...updates };
    setConfig(next);
    onUpdate(next);
  };

  const toggleProject = (id: string) => {
    const current = config.imageProjectIds;
    if (current.includes(id)) {
      update({ imageProjectIds: current.filter((pid) => pid !== id) });
      return;
    }
    if (current.length >= MAX_IMAGES) return; // batas 10 layer
    update({ imageProjectIds: [...current, id] });
  };

  // Project yang punya gambar statis layak jadi layer loader.
  const projectsWithImage = projects.filter((p) => pickProjectImage(p));
  const selectedCount = config.imageProjectIds.length;

  return (
    <div className="space-y-6">
      {/* Header + Enable Toggle */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">Loader Animasi</h3>
          <p className="text-sm text-gray-600">
            Animasi pembuka (boot loader) sebelum halaman utama tampil. Pilih
            gayanya di bawah — berlaku untuk semua template.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          disabled={isLoading}
          onClick={() => update({ enabled: !config.enabled })}
          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors ${
            config.enabled ? 'bg-blue-600' : 'bg-gray-300'
          } ${isLoading ? 'opacity-60' : ''}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Pemilih Gaya */}
          <div>
            <p className="mb-3 text-sm font-medium text-gray-700">Gaya Loader</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {STYLE_OPTIONS.map((opt) => {
                const isSelected = config.style === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => update({ style: opt.key })}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span
                      className={`mt-0.5 rounded-lg p-1.5 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {opt.key === 'hello' ? <Sparkles size={16} /> : <Layers size={16} />}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{opt.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {opt.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {config.style === 'hello' ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Animasi HELLO diputar otomatis (±6 detik). Durasi dan warna
              mengikuti animasi bawaan. Di template spatial-gallery &
              infinite-canvas, intro HELLO bawaan template yang berjalan
              (tampilannya sama persis — tidak dobel).
            </p>
          ) : (
            <>
          {/* Pengaturan Cepat */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Durasi */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <label
                htmlFor="loader-duration"
                className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-gray-400"
              >
                <Timer size={14} /> Durasi
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="loader-duration"
                  type="range"
                  min={MIN_DURATION}
                  max={MAX_DURATION}
                  step={STEP_DURATION}
                  value={config.durationMs ?? DEFAULT_DURATION_MS}
                  onChange={(e) => update({ durationMs: parseInt(e.target.value, 10) })}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
                />
                <span className="w-14 text-right font-mono text-xs font-bold text-gray-700">
                  {Math.round((config.durationMs ?? DEFAULT_DURATION_MS) / 100) / 10}s
                </span>
              </div>
            </div>

            {/* Warna Aksen */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <label
                htmlFor="loader-accent"
                className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-gray-400"
              >
                <Palette size={14} /> Warna Aksen
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="loader-accent"
                  type="color"
                  value={config.accentColor || DEFAULT_CONFIG.accentColor}
                  onChange={(e) => update({ accentColor: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                />
                <span className="font-mono text-xs font-bold uppercase text-gray-700">
                  {config.accentColor || DEFAULT_CONFIG.accentColor}
                </span>
              </div>
            </div>

            {/* Counter */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-gray-400">
                <Hash size={14} /> Counter [0]–[100]
              </span>
              <button
                type="button"
                onClick={() => update({ showCounter: config.showCounter === false })}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  config.showCounter !== false
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {config.showCounter !== false ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>
          </div>

          {/* Pemilih Gambar */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                <PlayCircle size={14} className="mr-1 inline" />
                Gambar Layer Loader
              </p>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                {selectedCount}/{MAX_IMAGES} dipilih
              </span>
            </div>

            {projectsWithImage.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Belum ada project dengan cover gambar. Tambahkan project dulu di
                menu &quot;Proyek Karya&quot;.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {projectsWithImage.map((p) => {
                  const isSelected = config.imageProjectIds.includes(p.id);
                  const isOrder = config.imageProjectIds.indexOf(p.id) + 1;
                  const isDisabled =
                    !isSelected && selectedCount >= MAX_IMAGES;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProject(p.id)}
                      disabled={isDisabled}
                      className={`group relative flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border-2 border-transparent p-3 transition-all duration-200 ${
                        isSelected
                          ? 'scale-[1.02]'
                          : isDisabled
                            ? 'cursor-not-allowed opacity-50 grayscale'
                            : 'hover:-translate-y-1'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                            #{isOrder}
                          </span>
                          <div className="rounded-full bg-blue-500 p-1.5 text-white shadow-lg">
                            <Check size={12} strokeWidth={4} />
                          </div>
                        </div>
                      )}

                      <div className="relative aspect-[1.15/1] w-full flex-1">
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                          {pickProjectImage(p) ? (
                            // img statis dari cover project, bukan konten dinamis
                            <img
                              src={pickProjectImage(p) as string}
                              className="h-full w-full object-cover"
                              alt=""
                            />
                          ) : (
                            <Folder size={40} className="text-blue-300" />
                          )}
                        </div>
                      </div>

                      <div className="w-full px-1 text-center">
                        <p
                          className={`truncate text-xs font-bold transition-colors ${
                            isSelected ? 'text-blue-700' : 'text-gray-700 group-hover:text-black'
                          }`}
                        >
                          {p.title}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

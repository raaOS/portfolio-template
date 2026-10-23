'use client';

/**
 * IntroConfigManager — CRUD "Intro Animasi" (v1.3.42).
 *
 * Klien memilih gaya animasi loader/intro pembuka per template:
 * - `hello-black`  — lottie HELLO hitam di latar putih (gaya os-desktop).
 * - `hello-orange` — lottie HELLO oranye di latar hitam (gaya spatial/infinite).
 * - `none`         — tanpa intro, halaman langsung tampil.
 *
 * Map lengkap 3 template SELALU dikirim saat save (merge di aboutService
 * bersifat replace-per-map) supaya pilihan template lain tidak ikut hilang.
 */

import { useState } from 'react';
import { PlayCircle, Save } from 'lucide-react';
import type { IntroConfig, IntroStyle, IntroTemplateKey } from '@/types/about';

const TEMPLATE_OPTIONS: Array<{
  key: IntroTemplateKey;
  label: string;
  description: string;
  defaultStyle: IntroStyle;
}> = [
  {
    key: 'os-desktop',
    label: 'macOS Desktop',
    description: 'Boot screen HELLO sebelum desktop tampil.',
    defaultStyle: 'hello-black',
  },
  {
    key: 'infinite-canvas',
    label: 'Infinite Canvas',
    description: 'Intro HELLO sebelum kanvas interaktif tampil.',
    defaultStyle: 'hello-orange',
  },
  {
    key: 'spatial-gallery',
    label: 'Spatial Gallery',
    description: 'Intro HELLO sampai scene 3D siap.',
    defaultStyle: 'hello-orange',
  },
];

const STYLE_OPTIONS: Array<{ value: IntroStyle; label: string; hint: string }> = [
  { value: 'hello-black', label: 'HELLO Hitam', hint: 'Latar putih' },
  { value: 'hello-orange', label: 'HELLO Oranye', hint: 'Latar hitam' },
  { value: 'none', label: 'Tanpa Intro', hint: 'Langsung tampil' },
];

function buildDefaultMap(): IntroConfig {
  return Object.fromEntries(
    TEMPLATE_OPTIONS.map((t) => [t.key, t.defaultStyle])
  ) as IntroConfig;
}

/** Gabung config tersimpan dengan default supaya key yang belum pernah disimpan tetap tampil. */
function withDefaults(config?: IntroConfig): IntroConfig {
  return { ...buildDefaultMap(), ...(config ?? {}) };
}

interface IntroConfigManagerProps {
  data?: IntroConfig;
  onUpdate: (config: IntroConfig) => void;
  isLoading?: boolean;
}

export default function IntroConfigManager({ data, onUpdate, isLoading }: IntroConfigManagerProps) {
  const [draft, setDraft] = useState<IntroConfig>(() => withDefaults(data));
  const [isSaving, setIsSaving] = useState(false);

  // Sinkronkan draft dengan data terbaru dari server (mis. setelah save
  // server mengembalikan merged data lewat query cache). Pola "adjust state
  // when props change" (guard bandingkan dulu) — bukan setState di dalam
  // effect (dilarang rule react-hooks/set-state-in-effect).
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setDraft(withDefaults(data));
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Map lengkap 3 key — merge service bersifat replace-per-map.
      await onUpdate({ ...buildDefaultMap(), ...draft });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        <h3 className="flex items-center gap-2 font-bold text-indigo-800">
          <PlayCircle className="h-5 w-5" /> Animasi Intro / Loader Pembuka
        </h3>
        <p className="mt-1 text-sm text-indigo-600">
          Pilih animasi pembuka per template. Pilihan berlaku untuk halaman utama situs dan halaman
          demo preview. Menyimpan tanpa deploy pun langsung aktif (ISR ± 60 detik).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {TEMPLATE_OPTIONS.map((template) => (
          <div
            key={template.key}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h4 className="font-bold text-gray-800">{template.label}</h4>
            <p className="mt-0.5 text-xs text-gray-500">{template.description}</p>
            <div className="mt-3 space-y-2">
              {STYLE_OPTIONS.map((option) => {
                const checked = (draft[template.key] ?? template.defaultStyle) === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`intro-style-${template.key}`}
                        value={option.value}
                        checked={checked}
                        onChange={() =>
                          setDraft((prev) => ({ ...prev, [template.key]: option.value }))
                        }
                        className="accent-indigo-600"
                      />
                      {option.label}
                    </span>
                    <span className="text-xs text-gray-400">{option.hint}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Menyimpan…' : 'Simpan Intro Animasi'}
        </button>
        <p className="text-xs text-gray-400">
          &quot;Tanpa Intro&quot; untuk macOS Desktop melewati boot screen sepenuhnya.
        </p>
      </div>
    </div>
  );
}

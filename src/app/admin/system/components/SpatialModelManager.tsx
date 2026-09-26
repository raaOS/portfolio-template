'use client';

import React, { useRef, useState } from 'react';
import { Box, Upload, Check, Sparkles, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { SpatialGalleryConfig } from '@/types/about';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

interface SpatialModelManagerProps {
  data?: SpatialGalleryConfig;
  onUpdate: (config: SpatialGalleryConfig) => void;
  csrfToken?: string | null;
  isLoading?: boolean;
}

const DEFAULT_MODEL_URL = '/models/helmet.glb';
const DEFAULT_MODEL_NAME = 'Cyber Glass Helmet (Bawaan)';

export default function SpatialModelManager({
  data,
  onUpdate,
  csrfToken,
}: SpatialModelManagerProps) {
  const [config, setConfig] = useState<SpatialGalleryConfig>({
    centerModelUrl: data?.centerModelUrl || DEFAULT_MODEL_URL,
    centerModelName: data?.centerModelName || DEFAULT_MODEL_NAME,
    materialStyle: data?.materialStyle || 'glass',
    modelScale: data?.modelScale ?? 1.0,
  });

  const [lastData, setLastData] = useState(data);
  if (data && data !== lastData) {
    setConfig({
      centerModelUrl: data.centerModelUrl || DEFAULT_MODEL_URL,
      centerModelName: data.centerModelName || DEFAULT_MODEL_NAME,
      materialStyle: data.materialStyle || 'glass',
      modelScale: data.modelScale ?? 1.0,
    });
    setLastData(data);
  }

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDefaultModel =
    !config.centerModelUrl || config.centerModelUrl === DEFAULT_MODEL_URL;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'glb' && ext !== 'gltf') {
      setUploadError('Format tidak didukung. Mohon unggah file 3D berformat .glb atau .gltf.');
      return;
    }

    // Validate size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Ukuran file melebihi batas 50 MB.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getWritableCsrfToken(csrfToken || null);
      const res = await fetch('/api/admin/upload?folder=models', {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Gagal mengunggah file 3D.');
      }

      const result = await res.json();
      const uploadedUrl = result.url || result.data?.url;

      if (!uploadedUrl) {
        throw new Error('URL file tidak ditemukan pada respon server.');
      }

      const cleanName = file.name.replace(/\.[^.]+$/, '');
      const newConfig: SpatialGalleryConfig = {
        ...config,
        centerModelUrl: uploadedUrl,
        centerModelName: cleanName,
      };

      setConfig(newConfig);
      onUpdate(newConfig);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat upload.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetToDefault = () => {
    const newConfig: SpatialGalleryConfig = {
      ...config,
      centerModelUrl: DEFAULT_MODEL_URL,
      centerModelName: DEFAULT_MODEL_NAME,
    };
    setConfig(newConfig);
    onUpdate(newConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleStyleChange = (style: 'glass' | 'original') => {
    const newConfig = { ...config, materialStyle: style };
    setConfig(newConfig);
    onUpdate(newConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleScaleChange = (scale: number) => {
    const newConfig = { ...config, modelScale: scale };
    setConfig(newConfig);
    onUpdate(newConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Active Model Status Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/80 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 shadow-sm">
            <Box className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900">
                {config.centerModelName || 'Model 3D Aktif'}
              </h4>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  isDefaultModel
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isDefaultModel ? 'Preset Bawaan' : 'Kustom Upload'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 font-mono truncate max-w-sm sm:max-w-md">
              {config.centerModelUrl || DEFAULT_MODEL_URL}
            </p>
          </div>
        </div>

        {!isDefaultModel && (
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset ke Helm Bawaan
          </button>
        )}
      </div>

      {/* Upload Custom 3D Model Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Upload className="h-4 w-4 text-purple-600" />
          Unggah Model 3D Kustom (.glb / .gltf)
        </h4>
        <p className="text-xs text-gray-500">
          Ganti helm dengan model 3D apa pun (logo, sneaker, patung, objek produk). Sistem otomatis menormalkan ukuran dan titik pusat putaran agar pas di tengah ring.
        </p>

        <div
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 text-center cursor-pointer transition-all hover:border-purple-400 hover:bg-purple-50/20 ${
            isUploading ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-sm font-medium text-gray-700">Mengunggah model 3D ke R2 Storage...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-purple-50 p-3 text-purple-600">
                <Upload className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-gray-900">
                Klik untuk memilih file 3D (.glb / .gltf)
              </p>
              <p className="text-xs text-gray-500">Maksimum ukuran 50 MB</p>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Material Style Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          Gaya Material Visual (Shader)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleStyleChange('glass')}
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
              config.materialStyle === 'glass'
                ? 'border-purple-600 bg-purple-50/50 shadow-sm ring-2 ring-purple-600/20'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-semibold text-sm text-gray-900">Kristal Kaca (Glass)</span>
              {config.materialStyle === 'glass' && (
                <Check className="h-4 w-4 text-purple-600" />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Material kaca futuristik semi-transparan dengan pantulan iridescence pelangi (gaya khas Spatial Gallery).
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleStyleChange('original')}
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
              config.materialStyle === 'original'
                ? 'border-purple-600 bg-purple-50/50 shadow-sm ring-2 ring-purple-600/20'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-semibold text-sm text-gray-900">Material Asli File</span>
              {config.materialStyle === 'original' && (
                <Check className="h-4 w-4 text-purple-600" />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Pertahankan warna, tekstur, dan material asli bawaan dari model 3D GLB yang Anda unggah.
            </p>
          </button>
        </div>
      </div>

      {/* Scale Multiplier Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">
            Skala Ukuran Objek (Auto-Fit Multiplier)
          </h4>
          <span className="font-mono text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
            {config.modelScale?.toFixed(2)}x
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Model otomatis di-fit ke ukuran ideal (1.8 unit). Geser slider bila ingin memperbesar atau memperkecil objek di dalam lingkaran kartu.
        </p>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={config.modelScale ?? 1.0}
          onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
        />
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>0.5x (Kecil)</span>
          <span>1.0x (Standar Proporsional)</span>
          <span>2.0x (Besar)</span>
        </div>
      </div>

      {/* Save Notification */}
      {isSaved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 animate-fadeIn">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>Pengaturan objek 3D berhasil disimpan secara otomatis.</span>
        </div>
      )}
    </div>
  );
}

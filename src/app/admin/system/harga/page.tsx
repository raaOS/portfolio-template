'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, Save } from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';
import { formatIdr } from '@/constants/pricing';

/**
 * Panel Harga Jual (PK4): owner mengubah harga dasar template tanpa deploy.
 * Tersimpan di D1 `platform_settings` (key `pricing_config`); halaman jualan
 * (`/`) membaca via ISR ≤60 dtk dan checkout via fetch `payment-info`.
 * Nominal order tetap dihitung server — tampilan di sini hanya display.
 */
function HargaClientContent() {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const fetchPrice = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pricing');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.basePrice !== 'number') {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setCurrentPrice(data.basePrice);
      setInputValue(String(data.basePrice));
    } catch (err) {
      console.error('[HargaPanel] Gagal memuat harga:', err);
      setError('Gagal memuat harga. Coba segarkan.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load awal ditunda ke macrotask berikutnya agar tidak memanggil setState
  // secara sinkron di dalam effect (rule react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = setTimeout(() => void fetchPrice(), 0);
    return () => clearTimeout(timer);
  }, [fetchPrice]);

  const numericInput = Number(String(inputValue).replace(/[^0-9]/g, ''));
  const preview = Number.isFinite(numericInput) && numericInput > 0 ? numericInput : null;
  const dirty = preview !== null && preview !== currentPrice;

  const handleSave = async () => {
    if (preview === null) {
      setError('Masukkan nominal harga yang valid.');
      return;
    }
    setIsSaving(true);
    setError('');
    setStatus('');
    try {
      const token = getWritableCsrfToken();
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: JSON.stringify({ basePrice: preview }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setCurrentPrice(data.basePrice);
      setInputValue(String(data.basePrice));
      setStatus(
        `Harga disimpan: ${formatIdr(data.basePrice)}. Halaman jualan menyusul (ISR ≤60 dtk); checkout mengambil harga terbaru saat dibuka.`
      );
    } catch (err) {
      console.error('[HargaPanel] Gagal simpan harga:', err);
      setError(err instanceof Error ? err.message : 'Gagal menyimpan harga.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Banknote size={16} className="text-amber-600" />
          <span>
            {isLoading
              ? 'Memuat…'
              : currentPrice !== null
                ? `Harga aktif: ${formatIdr(currentPrice)}`
                : 'Harga belum termuat'}
          </span>
        </div>
        <button
          onClick={() => void fetchPrice()}
          disabled={isLoading || isSaving}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Segarkan
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <label htmlFor="base-price" className="mb-1 block text-sm font-semibold text-gray-800">
            Harga dasar template (Rp)
          </label>
          <input
            id="base-price"
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="199000"
            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
          <p className="mt-2 text-sm text-gray-600">
            Pratinjau: <strong>{preview !== null ? formatIdr(preview) : '—'}</strong>
            {currentPrice !== null && preview !== null && preview !== currentPrice && (
              <span className="ml-2 text-amber-700">
                (berubah dari {formatIdr(currentPrice)})
              </span>
            )}
          </p>
          <button
            onClick={() => void handleSave()}
            disabled={isLoading || isSaving || !dirty}
            className="mt-4 flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            <Save size={15} />
            {isSaving ? 'Menyimpan…' : 'Simpan Harga'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {status && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {status}
          </div>
        )}

        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-xs leading-relaxed text-gray-500">
          <p className="mb-1 font-semibold text-gray-600">Catatan</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Harga tampil di halaman jualan dan checkout; order yang sudah dibuat nominalnya tetap (terkunci di orders).</li>
            <li>Nominal tagihan tetap dihitung server dari database — bukan dari browser pengunjung.</li>
            <li>Guardrail input: Rp1.000 – Rp100.000.000 (bilangan bulat).</li>
            <li>Belum pernah disimpan → memakai harga bawaan <code>BASE_PRICE</code>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function AdminHargaPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Harga Jual"
        titleIcon={<Banknote className="h-5 w-5" aria-hidden />}
        titleAccent="bg-amber-100 text-amber-700"
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <HargaClientContent />
      </div>
    </AdminAuthGuard>
  );
}

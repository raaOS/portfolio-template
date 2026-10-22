'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, Save } from 'lucide-react';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';
import { formatIdr } from '@/constants/pricing';

/**
 * Panel Harga Jual (PK4): owner mengubah harga dasar template tanpa deploy.
 * Tersimpan di D1 `platform_settings` (key `base_price_idr`); halaman jualan
 * (`/`) & checkout membaca via cache 60 detik (ISR + cache service), nominal
 * order tetap dihitung server — tampilan di sini hanya display.
 *
 * Panel ini juga mengelola nomor WhatsApp owner (key `owner_whatsapp`) yang
 * dipakai tombol "Pesan" di halaman jualan dan link WA di halaman order —
 * ganti nomor cukup dari sini, tanpa deploy ulang.
 */
export default function HargaPanel() {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Nomor WhatsApp owner — tombol "Pesan" di halaman jualan & halaman order.
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const [waInput, setWaInput] = useState('');
  const [isSavingWa, setIsSavingWa] = useState(false);
  const [waError, setWaError] = useState('');
  const [waStatus, setWaStatus] = useState('');

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
      const wa = typeof data.adminWhatsapp === 'string' ? data.adminWhatsapp : '';
      setAdminWhatsapp(wa);
      setWaInput(wa);
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

  // Nomor WA dinormalkan ke murni digit (format wa.me); kosong = sah
  // (tombol "Pesan" lalu diarahkan ke halaman checkout).
  const waDigits = waInput.replace(/\D/g, '');
  const waDirty = waDigits !== adminWhatsapp;
  const waInvalid = waDigits.length > 0 && (waDigits.length < 8 || waDigits.length > 15);

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
        `Harga disimpan: ${formatIdr(data.basePrice)}. Halaman jualan & checkout menyusul (cache 60 detik).`
      );
    } catch (err) {
      console.error('[HargaPanel] Gagal simpan harga:', err);
      setError(err instanceof Error ? err.message : 'Gagal menyimpan harga.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWa = async () => {
    if (waInvalid) {
      setWaError('Nomor harus 8–15 digit (contoh: 6281234567890).');
      return;
    }
    setIsSavingWa(true);
    setWaError('');
    setWaStatus('');
    try {
      const token = getWritableCsrfToken();
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        credentials: 'include',
        body: JSON.stringify({ adminWhatsapp: waDigits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const saved = typeof data.adminWhatsapp === 'string' ? data.adminWhatsapp : '';
      setAdminWhatsapp(saved);
      setWaInput(saved);
      setWaStatus(
        saved
          ? `Nomor disimpan: ${saved}. Tombol "Pesan" di halaman jualan & order menyusul (cache 60 detik).`
          : 'Nomor dikosongkan — tombol "Pesan" diarahkan ke halaman checkout.'
      );
    } catch (err) {
      console.error('[HargaPanel] Gagal simpan nomor WA:', err);
      setWaError(err instanceof Error ? err.message : 'Gagal menyimpan nomor WhatsApp.');
    } finally {
      setIsSavingWa(false);
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

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <label
            htmlFor="owner-whatsapp"
            className="mb-1 block text-sm font-semibold text-gray-800"
          >
            WhatsApp Transaksi — buyer chat setelah membeli
          </label>
          <p className="mb-2 text-xs text-gray-500">
            Khusus urusan transaksi: tombol WA di halaman status pesanan (konfirmasi bayar
            &amp; serah-terima akses) dan tombol &quot;Pesan&quot; di halaman jualan.
            Kontak publik yang tampil ke pengunjung diatur terpisah di
            <strong> Komunikasi → Contacts</strong>.
          </p>
          <input
            id="owner-whatsapp"
            type="text"
            inputMode="tel"
            autoComplete="off"
            value={waInput}
            onChange={(e) => setWaInput(e.target.value)}
            placeholder="6281234567890"
            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
          <p className="mt-2 text-sm text-gray-600">
            {adminWhatsapp ? (
              <>
                Aktif: <strong>{adminWhatsapp}</strong>
                {waDirty && <span className="ml-2 text-amber-700">(berubah)</span>}
              </>
            ) : (
              <>Belum diisi — tombol &quot;Pesan&quot; mengarah ke halaman checkout.</>
            )}
          </p>
          <button
            onClick={() => void handleSaveWa()}
            disabled={isLoading || isSavingWa || !waDirty || waInvalid}
            className="mt-4 flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            <Save size={15} />
            {isSavingWa ? 'Menyimpan…' : 'Simpan Nomor'}
          </button>
          {waError && <p className="mt-2 text-sm text-red-600">{waError}</p>}
          {waStatus && <p className="mt-2 text-sm text-emerald-600">{waStatus}</p>}
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
            <li>Guardrail input: Rp50.000 – Rp50.000.000 (bilangan bulat).</li>
            <li>Belum pernah disimpan → memakai harga bawaan <code>BASE_PRICE</code>.</li>
            <li>
              Nomor WhatsApp dipakai tombol &quot;Pesan&quot; (wa.me) di halaman jualan
              dan link konfirmasi di halaman order. Kosongkan untuk mengarahkan
              &quot;Pesan&quot; ke halaman checkout.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

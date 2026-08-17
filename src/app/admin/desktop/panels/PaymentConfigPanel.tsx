'use client';

import { useState, useCallback, useRef } from 'react';
import {
  QrCode,
  Landmark,
  Clock,
  MessageCircle,
  Save,
  CheckCircle2,
  AlertCircle,
  Upload,
  Power,
  Loader2,
  Trash2,
  ImageIcon,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AdminLoading from '@/components/admin/AdminLoading';
import { decodeQRISFromImageFile } from '@/lib/billing/qrisImageDecoder';
import { validateStaticMerchantQRIS } from '@/lib/billing/qris';

interface QRISAccount {
  id: string;
  label: string;
  imageUrl: string;
  staticPayload: string;
  isActive: boolean;
}

interface PaymentConfig {
  qrisImageUrl: string;
  qrisStaticPayload: string;
  qrisAccounts: QRISAccount[];
  qrisDynamicEnabled: boolean;
  qrisUniqueAmountEnabled: boolean;
  qrisUniqueAmountMaxOffset: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
  verificationHours: string;
  adminWhatsapp: string;
  isActive: boolean;
}

const DEFAULT_CONFIG: PaymentConfig = {
  qrisImageUrl: '',
  qrisStaticPayload: '',
  qrisAccounts: [
    {
      id: 'qris-1',
      label: 'QRIS 1 (Utama)',
      imageUrl: '',
      staticPayload: '',
      isActive: true,
    },
  ],
  qrisDynamicEnabled: false,
  qrisUniqueAmountEnabled: true,
  qrisUniqueAmountMaxOffset: 999,
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  paymentInstructions: 'Transfer tepat sesuai nominal tagihan.',
  verificationHours: '08:00 – 22:00 WIB (maks. 1x24 jam)',
  adminWhatsapp: '',
  isActive: false,
};

export default function PaymentConfigPanel() {
  const { csrfToken } = useAdminAuth();
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [showPayloadMap, setShowPayloadMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-config', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.config) {
        const merged = { ...DEFAULT_CONFIG, ...data.config };
        if (!Array.isArray(merged.qrisAccounts) || merged.qrisAccounts.length === 0) {
          merged.qrisAccounts = [
            {
              id: 'qris-1',
              label: 'QRIS 1 (Utama)',
              imageUrl: merged.qrisImageUrl || '',
              staticPayload: merged.qrisStaticPayload || '',
              isActive: true,
            },
          ];
        }
        setConfig(merged);
      }
    } catch (err) {
      console.error('Failed to fetch payment config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const didInit = useRef<boolean | null>(null);
  if (didInit.current == null) {
    didInit.current = true;
    void fetchConfig();
  }

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/payment-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan');
      }
      setMessage({ type: 'success', text: 'Konfigurasi pembayaran berhasil disimpan!' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateAccountField = <K extends keyof QRISAccount>(
    accountId: string,
    key: K,
    value: QRISAccount[K]
  ) => {
    setConfig((prev) => ({
      ...prev,
      qrisAccounts: prev.qrisAccounts.map((acc) =>
        acc.id === accountId ? { ...acc, [key]: value } : acc
      ),
    }));
  };

  const handleAddAccount = () => {
    const nextIndex = config.qrisAccounts.length + 1;
    const newAcc: QRISAccount = {
      id: `qris-${Date.now()}`,
      label: `QRIS ${nextIndex} (Cadangan)`,
      imageUrl: '',
      staticPayload: '',
      isActive: true,
    };
    setConfig((prev) => ({ ...prev, qrisAccounts: [...prev.qrisAccounts, newAcc] }));
  };

  const handleRemoveAccount = (accountId: string) => {
    if (config.qrisAccounts.length <= 1) {
      setMessage({ type: 'error', text: 'Minimal harus ada 1 akun QRIS.' });
      return;
    }
    setConfig((prev) => ({
      ...prev,
      qrisAccounts: prev.qrisAccounts.filter((acc) => acc.id !== accountId),
    }));
    setMessage({ type: 'success', text: 'Akun QRIS dihapus. Klik Simpan untuk mengkonfirmasi.' });
  };

  const handleUploadAccountQris = async (
    accountId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'File harus berupa gambar (PNG/JPG/WebP)' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Ukuran gambar QRIS maksimal 5MB' });
      return;
    }

    setUploadingId(accountId);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', 'platform/payment');
      formData.append('category', 'payment');

      const res = await fetch('/api/admin/upload?folder=assets/media', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Upload gagal');
      }

      // Auto-decode QRIS payload from image
      const decodeResult = await decodeQRISFromImageFile(file);

      if (decodeResult.success && decodeResult.payload) {
        setConfig((prev) => ({
          ...prev,
          qrisDynamicEnabled: true,
          qrisAccounts: prev.qrisAccounts.map((acc) =>
            acc.id === accountId
              ? { ...acc, imageUrl: data.url, staticPayload: decodeResult.payload! }
              : acc
          ),
        }));
        setMessage({
          type: 'success',
          text: `Gambar ${accountId} berhasil di-upload dan payload "000201..." ter-decode otomatis! Klik Simpan.`,
        });
      } else {
        setConfig((prev) => ({
          ...prev,
          qrisAccounts: prev.qrisAccounts.map((acc) =>
            acc.id === accountId ? { ...acc, imageUrl: data.url } : acc
          ),
        }));
        setMessage({
          type: 'success',
          text: `Gambar QRIS di-upload. (${decodeResult.error || 'Gambar statis aktif'}). Klik Simpan.`,
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal upload gambar QRIS',
      });
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  };

  const updateField = <K extends keyof PaymentConfig>(key: K, value: PaymentConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <AdminLoading size="page" />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Konfigurasi Pembayaran (Multi-QRIS)</h2>
          <p className="text-sm text-gray-500">
            Atur 1 atau lebih akun QRIS (Utama & Cadangan) serta rekening bank untuk checkout & order.
          </p>
        </div>
        <button
          onClick={() => updateField('isActive', !config.isActive)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
            config.isActive
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <Power className="h-4 w-4" />
          {config.isActive ? 'Pembayaran Aktif' : 'Pembayaran Nonaktif'}
        </button>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs font-medium ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Global Dynamic & Unique Nominal Toggles */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Pengaturan QRIS Dinamis & Kode Unik</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              checked={config.qrisDynamicEnabled}
              onChange={(e) => updateField('qrisDynamicEnabled', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Generate QRIS Dinamis Per-Order (Nominal Auto)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              checked={config.qrisUniqueAmountEnabled}
              onChange={(e) => updateField('qrisUniqueAmountEnabled', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Kode Unik Random pada Nominal (Misal Rp 149.012)</span>
          </label>
        </div>
      </div>

      {/* Multi-QRIS Accounts Manager */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Daftar Akun QRIS (Utama & Cadangan)</h3>
          </div>
          <button
            onClick={handleAddAccount}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-all hover:bg-blue-100"
          >
            <Plus className="h-4 w-4" /> Tambah QRIS Cadangan
          </button>
        </div>

        {config.qrisAccounts.map((acc, index) => {
          const validation = acc.staticPayload ? validateStaticMerchantQRIS(acc.staticPayload) : null;
          const isValid = validation?.valid === true;

          return (
            <div
              key={acc.id}
              className={`rounded-xl border bg-white p-5 space-y-4 transition-all ${
                acc.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60 bg-gray-50'
              }`}
            >
              {/* Account Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={acc.label}
                    onChange={(e) => updateAccountField(acc.id, 'label', e.target.value)}
                    placeholder={`QRIS ${index + 1}`}
                    className="font-bold text-sm text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5"
                  />
                  {acc.staticPayload ? (
                    isValid ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="h-3 w-3" /> Valid (CRC OK)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        <ShieldAlert className="h-3 w-3" /> Payload Invalid
                      </span>
                    )
                  ) : acc.imageUrl ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Gambar Statis
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      Belum Diisi
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateAccountField(acc.id, 'isActive', !acc.isActive)}
                    className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all ${
                      acc.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {acc.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                  {config.qrisAccounts.length > 1 && (
                    <button
                      onClick={() => handleRemoveAccount(acc.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Hapus Akun QRIS"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Upload & Preview Body */}
              <div className="flex gap-4 items-start">
                <div className="shrink-0 flex flex-col items-center gap-1.5">
                  {acc.imageUrl ? (
                    <>
                      <div className="rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                        <img
                          src={acc.imageUrl}
                          alt={acc.label}
                          className="h-32 w-32 rounded-lg object-contain bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => updateAccountField(acc.id, 'imageUrl', '')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus Gambar</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex h-32 w-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400">
                      <ImageIcon className="h-7 w-7 mb-1" />
                      <span className="text-[10px] font-medium">Belum ada QRIS</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <label className="relative flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-100">
                    {uploadingId === acc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    ) : (
                      <Upload className="h-4 w-4 text-blue-600" />
                    )}
                    <span>{uploadingId === acc.id ? 'Mengupload...' : `Upload Gambar ${acc.label}`}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleUploadAccountQris(acc.id, e)}
                      disabled={uploadingId === acc.id}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  <p className="text-[10px] text-gray-400">
                    Upload gambar QRIS. Payload &quot;000201...&quot; akan ter-decode otomatis dari gambar.
                  </p>

                  <div className="pt-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
                      Raw QRIS Static Payload String:
                    </label>
                    <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                      <input
                        type={showPayloadMap[acc.id] ? 'text' : 'password'}
                        placeholder="00020101021126..."
                        value={acc.staticPayload}
                        onChange={(e) => updateAccountField(acc.id, 'staticPayload', e.target.value)}
                        className="w-full bg-transparent px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPayloadMap((prev) => ({ ...prev, [acc.id]: !prev[acc.id] }))
                        }
                        className="shrink-0 px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors border-l border-gray-100 bg-gray-50/50 hover:bg-gray-100"
                        title={showPayloadMap[acc.id] ? 'Sembunyikan Payload' : 'Tampilkan Payload'}
                      >
                        {showPayloadMap[acc.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bank Transfer Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
            <Landmark className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Rekening Bank Transfer</h3>
            <p className="text-xs text-gray-500">Info rekening yang ditampilkan ke pembeli</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Nama Bank
            </label>
            <input
              type="text"
              placeholder="BCA"
              value={config.bankName}
              onChange={(e) => updateField('bankName', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Nomor Rekening
            </label>
            <input
              type="text"
              placeholder="1234567890"
              value={config.bankAccountNumber}
              onChange={(e) => updateField('bankAccountNumber', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-900 font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Nama Pemilik
            </label>
            <input
              type="text"
              placeholder="John Doe"
              value={config.bankAccountName}
              onChange={(e) => updateField('bankAccountName', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Operational Settings */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-600" />
              <label className="text-xs font-bold text-gray-900">Jam Verifikasi</label>
            </div>
            <input
              type="text"
              placeholder="08:00 – 22:00 WIB (maks. 1x24 jam)"
              value={config.verificationHours}
              onChange={(e) => updateField('verificationHours', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <label className="text-xs font-bold text-gray-900">WhatsApp Admin</label>
            </div>
            <input
              type="tel"
              placeholder="628123456789"
              value={config.adminWhatsapp}
              onChange={(e) => updateField('adminWhatsapp', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-900 font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-gray-900">
            Instruksi Pembayaran Tambahan
          </label>
          <textarea
            rows={2}
            placeholder="Transfer tepat sesuai nominal tagihan."
            value={config.paymentInstructions}
            onChange={(e) => updateField('paymentInstructions', e.target.value)}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Menyimpan...' : 'Simpan Konfigurasi Multi-QRIS'}
        </button>
      </div>
    </div>
  );
}

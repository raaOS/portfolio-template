'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Zap,
  Globe,
  Radio,
  Server,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Save,
  ExternalLink,
} from 'lucide-react';
import { AdminAuthGuard } from '../../components/AdminAuthGuard';
import { AdminHeader } from '../../components/components/AdminHeader';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AdminLoading from '@/components/admin/AdminLoading';
import type { AiProviderType } from '@/lib/services/aiGatewayService';

interface ProviderMeta {
  id: AiProviderType;
  name: string;
  badge: string;
  badgeColor: string;
  icon: typeof Sparkles;
  description: string;
  keyHelpUrl?: string;
  keyHelpLabel?: string;
  defaultModel: string;
  defaultBaseUrl?: string;
  suggestedModels: string[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Rekomendasi (Gratis)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: Sparkles,
    description: 'Model resmi dari Google. Sangat cepat, cerdas, dan kuota gratisnya melimpah.',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    keyHelpLabel: 'Dapatkan Kunci di Google AI Studio',
    defaultModel: 'gemini-2.0-flash',
    suggestedModels: ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: 'Akses Semua Model',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: Globe,
    description: 'Satu kunci untuk ratusan model AI: ChatGPT, Claude, Llama 3, DeepSeek, dll.',
    keyHelpUrl: 'https://openrouter.ai/keys',
    keyHelpLabel: 'Dapatkan Kunci di OpenRouter.ai',
    defaultModel: 'openai/gpt-4o-mini',
    suggestedModels: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku', 'meta-llama/llama-3.3-70b-instruct'],
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Super Cepat',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Zap,
    description: 'Inference berkecepatan ultra tinggi untuk Llama 3 dan model open-source.',
    keyHelpUrl: 'https://console.groq.com/keys',
    keyHelpLabel: 'Dapatkan Kunci di Groq Console',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
  {
    id: 'openai',
    name: 'OpenAI Official',
    badge: 'ChatGPT Asli',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Bot,
    description: 'Layanan API resmi langsung dari OpenAI untuk GPT-4o dan model ChatGPT lainnya.',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyHelpLabel: 'Dapatkan Kunci di OpenAI Platform',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
  },
  {
    id: 'custom',
    name: 'Pihak Ketiga / 9router / Custom',
    badge: 'OpenAI-Compatible',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: Server,
    description:
      'Gunakan provider reverse proxy seperti 9router, DeepSeek API, atau server AI lokal Anda sendiri.',
    keyHelpUrl: 'https://9router.com',
    keyHelpLabel: 'Pelajari 9router / Custom API',
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.9router.com/v1',
    suggestedModels: ['deepseek-chat', 'gpt-4o-mini', 'claude-3-5-sonnet'],
  },
];

function AiSettingsContent() {
  const { csrfToken } = useAdminAuth();

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [provider, setProvider] = useState<AiProviderType>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');

  const [isCustom, setIsCustom] = useState(false);
  const [hasServerFallback, setHasServerFallback] = useState(false);

  // Status aksi
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;

    async function initSettings() {
      try {
        const res = await fetch('/api/admin/ai/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (ignore) return;

        if (data.config) {
          setEnabled(data.config.enabled ?? true);
          setProvider((data.config.provider as AiProviderType) || 'gemini');
          setApiKey(data.config.apiKeyMasked || '');
          setBaseUrl(data.config.baseUrl || '');
          setModel(data.config.model || '');
        }

        setIsCustom(!!data.isCustom);
        setHasServerFallback(!!data.hasServerFallback);
      } catch (err) {
        console.error(err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void initSettings();
    return () => {
      ignore = true;
    };
  }, []);

  // Ganti provider & sesuaikan model default jika model kosong
  const handleSelectProvider = (newProvider: AiProviderType) => {
    setProvider(newProvider);
    const meta = PROVIDERS.find((p) => p.id === newProvider);
    if (meta) {
      setModel(meta.defaultModel);
      if (meta.defaultBaseUrl) {
        setBaseUrl(meta.defaultBaseUrl);
      } else if (newProvider !== 'custom') {
        setBaseUrl('');
      }
    }
    setTestResult(null);
  };

  // Tes Koneksi
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          provider,
          apiKey,
          baseUrl: baseUrl || undefined,
          model: model || undefined,
        }),
      });

      const result = await res.json();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Gagal menghubungi endpoint tes.',
      });
    } finally {
      setTesting(false);
    }
  };

  // Simpan Pengaturan
  const handleSave = async () => {
    setSaving(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/admin/ai/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          enabled,
          provider,
          apiKey,
          baseUrl: baseUrl || undefined,
          model: model || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan');
      }

      setFeedbackMessage({ type: 'success', text: data.message || 'Pengaturan berhasil disimpan!' });
      setIsCustom(true);
      if (data.config?.apiKeyMasked) {
        setApiKey(data.config.apiKeyMasked);
      }
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset ke Server Default
  const handleReset = async () => {
    if (!confirm('Apakah Anda yakin ingin mengembalikan pengaturan AI ke konfigurasi default server?')) {
      return;
    }

    setSaving(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/admin/ai/settings', {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!res.ok) throw new Error('Gagal mereset pengaturan');
      const fetchRes = await fetch('/api/admin/ai/settings');
      if (fetchRes.ok) {
        const data = await fetchRes.json();
        if (data.config) {
          setEnabled(data.config.enabled ?? true);
          setProvider((data.config.provider as AiProviderType) || 'gemini');
          setApiKey(data.config.apiKeyMasked || '');
          setBaseUrl(data.config.baseUrl || '');
          setModel(data.config.model || '');
        }
        setIsCustom(!!data.isCustom);
        setHasServerFallback(!!data.hasServerFallback);
      }
      setFeedbackMessage({ type: 'success', text: 'Pengaturan berhasil dikembalikan ke default server.' });
      setTestResult(null);
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mereset pengaturan.',
      });
    } finally {
      setSaving(false);
    }
  };

  const currentMeta = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-6">
        <AdminLoading size="default" />
      </div>
    );
  }

  return (
    <>
      <AdminHeader
        title="Pengaturan Asisten AI"
        titleIcon={<Sparkles className="h-5 w-5" aria-hidden />}
        titleAccent="bg-violet-50 text-violet-700"
      />

      <div className="flex-1 space-y-6 p-6 max-w-4xl mx-auto w-full">
        {/* Banner Penjelasan */}
        <div className="rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Asisten AI Portofolio Anda</h3>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                Asisten AI membantu Anda menulis deskripsi karya, menyusun balasan percakapan pesan, hingga
                memberikan rekomendasi keahlian teknis secara otomatis. Pilih provider AI favorit Anda atau gunakan
                layanan pihak ketiga yang Anda miliki.
              </p>
              {isCustom ? (
                <span className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Menggunakan Kunci Kustom Anda
                </span>
              ) : hasServerFallback ? (
                <span className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                  <Radio className="h-3.5 w-3.5" />
                  Menggunakan Kunci Server Bawaan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Kunci AI Belum Diatur (Fitur AI Nonaktif)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Feedback Notifikasi */}
        {feedbackMessage && (
          <div
            className={`rounded-lg border p-4 text-sm flex items-center gap-3 ${
              feedbackMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Form Pengaturan */}
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Status Switch */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-5">
            <div>
              <label htmlFor="toggle-ai-active" className="font-semibold text-gray-900">Aktifkan Asisten AI</label>
              <p className="text-xs text-gray-500">Matikan jika Anda tidak ingin tombol bantuan AI muncul di admin.</p>
            </div>
            <button
              id="toggle-ai-active"
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? 'bg-violet-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {enabled && (
            <div className="space-y-6">
              {/* Pilihan Provider */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Pilih Mesin AI (Provider)
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {PROVIDERS.map((p) => {
                    const Icon = p.icon;
                    const isSelected = provider === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProvider(p.id)}
                        className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-violet-500 bg-violet-50/50 shadow-sm ring-1 ring-violet-500'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                isSelected ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                              {p.badge}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-gray-900">{p.name}</h4>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-1">{p.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Base URL (Khusus untuk Custom / 9router) */}
              {provider === 'custom' && (
                <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-900">Custom Base URL</label>
                    <span className="text-xs text-gray-500">Mendukung protokol OpenAI Chat</span>
                  </div>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.9router.com/v1"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-gray-600">
                    <span className="text-gray-400">Pilihan Cepat:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBaseUrl('https://api.9router.com/v1');
                        setModel('deepseek-chat');
                      }}
                      className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50"
                    >
                      9router (api.9router.com/v1)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBaseUrl('https://api.deepseek.com/v1');
                        setModel('deepseek-chat');
                      }}
                      className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50"
                    >
                      DeepSeek Direct (api.deepseek.com/v1)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBaseUrl('http://localhost:11434/v1');
                        setModel('llama3');
                      }}
                      className="px-2 py-0.5 rounded bg-white border border-gray-200 hover:bg-gray-50"
                    >
                      Ollama Lokal (localhost:11434/v1)
                    </button>
                  </div>
                </div>
              )}

              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-900">
                    Kunci API ({currentMeta.name})
                  </label>
                  {currentMeta.keyHelpUrl && (
                    <a
                      href={currentMeta.keyHelpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 hover:underline"
                    >
                      {currentMeta.keyHelpLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Masukkan API key ${currentMeta.name}...`}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2 pr-10 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title={showApiKey ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Kunci Anda tersimpan aman di database Cloudflare terisolasi dan tidak pernah dibagikan ke publik.
                </p>
              </div>

              {/* Model AI */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-900">Nama Model</label>
                  <span className="text-xs text-gray-400 font-mono">default: {currentMeta.defaultModel}</span>
                </div>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={currentMeta.defaultModel}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 font-mono text-xs"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-gray-400">Rekomendasi:</span>
                  {currentMeta.suggestedModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                        model === m
                          ? 'bg-violet-100 text-violet-800 border-violet-300'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hasil Tes Koneksi */}
              {testResult && (
                <div
                  className={`rounded-lg border p-4 text-sm flex items-start gap-3 transition-all ${
                    testResult.success
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {testResult.success ? 'Koneksi Berhasil!' : 'Koneksi Gagal'}
                    </p>
                    <p className="text-xs">{testResult.message}</p>
                  </div>
                </div>
              )}

              {/* Tombol Aksi Bawah */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                      Sedang Menguji...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 text-amber-500" />
                      Tes Koneksi AI
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  {isCustom && (
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset ke Server
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 focus:outline-none disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Simpan Pengaturan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AiSettingsPage() {
  return (
    <AdminAuthGuard>
      <AiSettingsContent />
    </AdminAuthGuard>
  );
}

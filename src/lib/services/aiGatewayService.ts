/**
 * Universal AI Gateway Service
 * Mengelola konfigurasi AI per-site di Cloudflare D1 (site_settings)
 * dan mendukung Google Gemini, OpenAI, OpenRouter, Groq, serta
 * provider pihak ketiga (9router, DeepSeek, Local LLM) berbasis OpenAI API.
 *
 * @module
 */

import { z } from 'zod';
import { getSiteSetting, setSiteSetting, deleteSiteSetting } from '@/crud/shared/settings/site';

export const AI_PROVIDERS = ['gemini', 'openai', 'openrouter', 'groq', 'custom'] as const;
export type AiProviderType = (typeof AI_PROVIDERS)[number];

export interface SiteAiConfig {
  enabled: boolean;
  provider: AiProviderType;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export const siteAiConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string().trim(),
  baseUrl: z.string().trim().optional(),
  model: z.string().trim().optional(),
});

export const DEFAULT_MODELS: Record<AiProviderType, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  groq: 'llama-3.3-70b-versatile',
  custom: 'deepseek-chat',
};

export const DEFAULT_BASE_URLS: Record<AiProviderType, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  custom: 'https://api.9router.com/v1',
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionRequest {
  siteId?: string;
  messages: ChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  configOverride?: SiteAiConfig;
}

export interface AiCompletionResponse {
  content: string;
  provider: string;
  model: string;
}

/**
 * Resolusi konfigurasi AI:
 * 1. Ambil dari D1 site_settings (jika ada siteId dan user sudah isi apiKey)
 * 2. Fallback ke process.env jika belum diatur di D1
 */
export async function getResolvedAiConfig(siteId?: string): Promise<SiteAiConfig | null> {
  // 1. Cek D1 site_settings
  if (siteId) {
    try {
      const siteConfig = await getSiteSetting<SiteAiConfig>(siteId, 'ai_config');
      if (siteConfig && siteConfig.enabled && siteConfig.apiKey) {
        return {
          enabled: true,
          provider: siteConfig.provider || 'gemini',
          apiKey: siteConfig.apiKey,
          baseUrl: siteConfig.baseUrl || DEFAULT_BASE_URLS[siteConfig.provider] || '',
          model: siteConfig.model || DEFAULT_MODELS[siteConfig.provider] || '',
        };
      }
    } catch (err) {
      console.warn('[aiGatewayService] Gagal membaca site_settings ai_config:', err);
    }
  }

  // 2. Fallback ke Environment Variables (Server default)
  const envProvider = ((process.env.AI_PROVIDER || '').toLowerCase() as AiProviderType) || 'gemini';
  const envApiKey = (process.env.AI_API_KEY || '').trim();

  if (envApiKey) {
    return {
      enabled: true,
      provider: AI_PROVIDERS.includes(envProvider) ? envProvider : 'gemini',
      apiKey: envApiKey,
      baseUrl: process.env.AI_BASE_URL || DEFAULT_BASE_URLS[envProvider] || '',
      model: process.env.AI_MODEL || DEFAULT_MODELS[envProvider] || '',
    };
  }

  return null;
}

/**
 * Simpan konfigurasi AI ke database D1 untuk site tertentu.
 */
export async function saveSiteAiConfig(siteId: string, config: SiteAiConfig): Promise<void> {
  await setSiteSetting(siteId, 'ai_config', config);
}

/**
 * Hapus konfigurasi AI custom agar kembali ke fallback server.
 */
export async function resetSiteAiConfig(siteId: string): Promise<void> {
  await deleteSiteSetting(siteId, 'ai_config');
}

/**
 * Masking API key untuk tampilan UI agar aman (contoh: AIza...3x9a)
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '********';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Eksekusi panggilan universal ke provider AI yang dipilih.
 */
export async function callUniversalAiCompletion(
  req: AiCompletionRequest
): Promise<AiCompletionResponse> {
  const config = req.configOverride || (await getResolvedAiConfig(req.siteId));

  if (!config || !config.apiKey) {
    throw new Error('Kunci API AI belum dikonfigurasi. Silakan atur di Pengaturan AI.');
  }

  if (config.provider === 'gemini') {
    return callGeminiCompletion(config, req);
  }

  // OpenAI, OpenRouter, Groq, dan Custom (9router/DeepSeek/Ollama) semuanya kompatibel dengan format OpenAI
  return callOpenAiCompatibleCompletion(config, req);
}

/**
 * Handler khusus Google Gemini API
 */
async function callGeminiCompletion(
  config: SiteAiConfig,
  req: AiCompletionRequest
): Promise<AiCompletionResponse> {
  const model = config.model || DEFAULT_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Gabungkan system message dan user message menjadi format prompt Gemini
  const promptParts: string[] = [];
  for (const m of req.messages) {
    if (m.role === 'system') {
      promptParts.push(`[Instruksi Sistem]\n${m.content}\n`);
    } else if (m.role === 'user') {
      promptParts.push(`[Pengguna]\n${m.content}`);
    } else {
      promptParts.push(`[Asisten]\n${m.content}`);
    }
  }

  const promptText = promptParts.join('\n\n');

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: promptText }] }],
  };

  if (req.jsonMode) {
    body.generationConfig = { response_mime_type: 'application/json' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Gemini API Error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Google Gemini mengembalikan respon kosong.');
  }

  return {
    content: text,
    provider: 'gemini',
    model,
  };
}

/**
 * Handler untuk OpenAI, OpenRouter, Groq, dan Pihak Ketiga (9router, DeepSeek, Local LLM)
 */
async function callOpenAiCompatibleCompletion(
  config: SiteAiConfig,
  req: AiCompletionRequest
): Promise<AiCompletionResponse> {
  const defaultBaseUrl = DEFAULT_BASE_URLS[config.provider] || 'https://api.openai.com/v1';
  const rawBaseUrl = (config.baseUrl || defaultBaseUrl).replace(/\/+$/, '');
  const endpoint = `${rawBaseUrl}/chat/completions`;

  const model = config.model || DEFAULT_MODELS[config.provider] || 'gpt-4o-mini';

  const body: Record<string, unknown> = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
  };

  if (req.maxTokens) {
    body.max_tokens = req.maxTokens;
  }

  if (req.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  // OpenRouter khusus butuh referer/title header opsional
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://portfolio-os.local';
    headers['X-Title'] = 'Portfolio OS';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${config.provider.toUpperCase()} API Error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`${config.provider.toUpperCase()} mengembalikan respon kosong.`);
  }

  return {
    content: text,
    provider: config.provider,
    model,
  };
}

/**
 * Menguji coba koneksi ke provider AI yang dipilih secara real-time.
 */
export async function testAiConnection(
  config: SiteAiConfig
): Promise<{ success: boolean; message: string; latencyMs?: number; modelUsed?: string }> {
  const start = Date.now();
  try {
    const testMessages: ChatMessage[] = [
      { role: 'system', content: 'You are a test ping bot. Respond ONLY with the word "OK".' },
      { role: 'user', content: 'Ping' },
    ];

    const result = await callUniversalAiCompletion({
      configOverride: config,
      messages: testMessages,
      maxTokens: 10,
    });

    const latencyMs = Date.now() - start;
    return {
      success: true,
      message: `Koneksi berhasil! Respon: "${result.content.trim().slice(0, 30)}" (${latencyMs}ms)`,
      latencyMs,
      modelUsed: result.model,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Koneksi gagal tanpa pesan error spesifik.',
      latencyMs,
    };
  }
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * Regresi bug 2026-11-10: widget "Cloudflare D1" memerah "Bermasalah /
 * Browser sedang offline" padahal `/api/health` menjawab 200 dan D1 sehat.
 *
 * Penyebab: hook percaya `navigator.onLine` dan MELEWATI request sama sekali.
 * Di HP/laptop nilai itu cuma dugaan OS (Wi-Fi tanpa internet, hotspot, VPN,
 * bangun dari sleep) walau request ke origin yang sama tetap jalan.
 */

function setBrowserOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

const HEALTH_OK = {
  status: 'ok',
  database: 'connected',
  databaseBackend: 'cloudflare-d1',
  databaseLatencyMs: 12,
};

/** Hook menyimpan state di module scope → reset modul tiap test. */
async function mountHook() {
  vi.resetModules();
  const mod = await import('./useDataStatus');
  const { result } = renderHook(() => mod.useDataStatus());
  await act(async () => {
    await result.current.checkStatus();
  });
  return { mod, result };
}

describe('useDataStatus — status D1 tidak boleh ditebak dari navigator.onLine', () => {
  beforeEach(() => {
    setBrowserOnline(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('navigator.onLine=false tapi /api/health 200 → tetap "connected"', async () => {
    setBrowserOnline(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => HEALTH_OK,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { mod, result } = await mountHook();

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.health?.databaseBackend).toBe('cloudflare-d1');
    mod.stopDataStatusRuntime();
  });

  it('request gagal saat browser online → pesan error asli, bukan "Browser sedang offline"', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const { mod, result } = await mountHook();

    expect(result.current.connectionStatus).toBe('error');
    expect(result.current.errorMessage).toBe('Failed to fetch');
    mod.stopDataStatusRuntime();
  });

  it('request gagal saat browser benar-benar offline → pesan menyebut offline + sebab asli', async () => {
    setBrowserOnline(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));

    const { mod, result } = await mountHook();

    expect(result.current.connectionStatus).toBe('error');
    expect(result.current.errorMessage).toBe('Browser melaporkan offline · Failed to fetch');
    mod.stopDataStatusRuntime();
  });

  it('/api/health menjawab tapi D1 tidak terbaca → "disconnected" (bukan "error")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'degraded', database: 'disconnected' }),
      })
    );

    const { mod, result } = await mountHook();

    expect(result.current.connectionStatus).toBe('disconnected');
    expect(result.current.errorMessage).toBe('D1 tidak berhasil dibaca dari /api/health');
    mod.stopDataStatusRuntime();
  });
});

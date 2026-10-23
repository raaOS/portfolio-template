import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// soundManager selalu dimock — tidak suara/buat Audio di jsdom.
vi.mock('@/components/os/utils/SoundManager', () => ({
  soundManager: {
    play: vi.fn(),
    preload: vi.fn(),
    addSounds: vi.fn(),
  },
}));

import { useChatSync } from '../useChatSync';

// Nomor DUMMY — bukan nomor asli siapa pun (owner minta uji pakai nomor dummy).
const DUMMY = '081234567890';

describe('useChatSync — mode jembatan WhatsApp', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: null }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('nomor valid → sendMessage membuka wa.me untuk pesan pengunjung, TANPA fetch', async () => {
    const { result } = renderHook(() => useChatSync('Halo!', DUMMY));

    await waitFor(() => expect(result.current.visitorId).not.toBe(''));
    expect(result.current.isWhatsAppBridge).toBe(true);

    await act(async () => {
      await result.current.sendMessage('Tes dari agent pakai nomor dummy');
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/6281234567890?text=Tes%20dari%20agent%20pakai%20nomor%20dummy',
      '_blank',
      'noopener,noreferrer'
    );
    // Inti v1.3.68: di mode WA tidak ada satu request pun keluar.
    expect(fetchSpy).not.toHaveBeenCalled();
    // Balon pesan tetap tampil lokal sebagai "terkirim" (bukan failed).
    const mine = result.current.messages.find((m) => m.sender === 'visitor');
    expect(mine?.text).toBe('Tes dari agent pakai nomor dummy');
    expect((mine as { failed?: boolean } | undefined)?.failed).toBeFalsy();
    await waitFor(() => expect(result.current.isSending).toBe(false));
  });

  it('nomor kosong/invalid → tidak masuk mode WA (isWhatsAppBridge false)', () => {
    const { result: r1 } = renderHook(() => useChatSync('Halo!'));
    expect(r1.current.isWhatsAppBridge).toBe(false);
    const { result: r2 } = renderHook(() => useChatSync('Halo!', 'bukan nomor'));
    expect(r2.current.isWhatsAppBridge).toBe(false);
  });
});

describe('useChatSync — mode demo (situs owner tanpa nomor WA, v1.3.70)', () => {
  const DEMO_TEXTS = {
    notice: 'ℹ️ Ini halaman DEMO template — chat sungguhan tidak berjalan di sini.',
    reply: 'Di situs milik Anda nanti, pesan seperti ini langsung terkirim ke WhatsApp Anda.',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('kirim → nol fetch & nol window.open; admin membalas simulasi (notice + reply)', async () => {
    const openSpy = vi.mocked(window.open);
    const fetchSpy = vi.mocked(globalThis.fetch);

    const { result } = renderHook(() => useChatSync('Halo!', null, DEMO_TEXTS));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isWhatsAppBridge).toBe(false);

    await act(async () => {
      await result.current.sendMessage('Tes mode demo');
    });
    // Nol jaringan di demo: polling sync mati & POST send dilewati.
    expect(openSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Fase 1: indikator "sedang mengetik" aktif.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(result.current.isAdminTyping).toBe(true);

    // Fase 2: notice "ini demo" + balasan simulasi muncul sebagai pesan admin.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1400);
    });
    expect(result.current.isAdminTyping).toBe(false);
    const adminTexts = result.current.messages
      .filter((m) => m.sender === 'admin')
      .map((m) => m.text);
    expect(adminTexts[0]).toBe('Halo!'); // sapaan awal tetap muncul
    expect(adminTexts).toContain(DEMO_TEXTS.notice);
    expect(adminTexts).toContain(DEMO_TEXTS.reply);
    const mine = result.current.messages.find((m) => m.sender === 'visitor');
    expect(mine?.text).toBe('Tes mode demo');
  });
});

describe('useChatSync — mode lama (tanpa WA) tetap tersimpan ke D1', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sendMessage memanggil POST /api/chat/send dan sukses', async () => {
    // Polling sync (SWR) ikut lewat fetch global — hanya POST send yang dihitung.
    const sendCalls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u === '/api/chat/send') {
        sendCalls.push(u);
        return new Response(
          JSON.stringify({
            success: true,
            message: {
              id: 'server-1',
              text: 'Halo legacy',
              sender: 'visitor',
              timestamp: Date.now(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Response sync polling generik (sukses tanpa pesan).
      return new Response(
        JSON.stringify({ success: true, messages: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const { result } = renderHook(() => useChatSync('Halo!'));
    await waitFor(() => expect(result.current.visitorId).not.toBe(''));
    expect(result.current.isWhatsAppBridge).toBe(false);

    await act(async () => {
      await result.current.sendMessage('Halo legacy');
    });

    expect(sendCalls).toHaveLength(1);
    const confirmed = result.current.messages.find((m) => m.id === 'server-1');
    expect(confirmed?.text).toBe('Halo legacy');
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAdminDesktop } from './useAdminDesktop';

/** Stub window.innerWidth/innerHeight (pola positionSync.test.ts). */
function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

/** Jalankan timer auto-open zone (setTimeout 0 di effect). */
function flushAutoOpen() {
  act(() => {
    vi.runAllTimers();
  });
}

describe('useAdminDesktop — auto-open 4 zone tersusun 2×2 (v1.3.65)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setViewport(1440, 900);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('langsung membuka 4 jendela zone saat desktop dimuat', () => {
    const { result } = renderHook(() => useAdminDesktop());
    flushAutoOpen();

    expect(result.current.windows.map((w) => w.appId).sort()).toEqual([
      'folder-communications',
      'folder-content',
      'folder-display',
      'folder-system',
    ]);
  });

  it('menyusun kuadran sesuai mockup owner (Sistem kiri-atas, Komunikasi kanan-atas, Konten kiri-bawah, Tampilan kanan-bawah)', () => {
    const { result } = renderHook(() => useAdminDesktop());
    flushAutoOpen();

    const get = (appId: string) => {
      const win = result.current.windows.find((w) => w.appId === appId);
      expect(win, `jendela ${appId} harus terbuka`).toBeTruthy();
      return win!;
    };

    const system = get('folder-system');
    const comms = get('folder-communications');
    const content = get('folder-content');
    const display = get('folder-display');

    // baris atas vs baris bawah
    expect(system.y).toBe(comms.y);
    expect(content.y).toBe(display.y);
    expect(system.y).toBeLessThan(content.y);
    // kolom kiri vs kolom kanan
    expect(system.x).toBe(content.x);
    expect(comms.x).toBe(display.x);
    expect(system.x).toBeLessThan(comms.x);
    // semua jendela tampil penuh di dalam viewport
    for (const w of result.current.windows) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.x + w.width).toBeLessThanOrEqual(1440);
      expect(w.y + w.height).toBeLessThanOrEqual(900);
    }
  });

  it('StrictMode double-invoke tidak menggandakan jendela zone', () => {
    const { result } = renderHook(() => useAdminDesktop(), { reactStrictMode: true });
    flushAutoOpen();

    expect(result.current.windows).toHaveLength(4);
    expect(new Set(result.current.windows.map((w) => w.appId)).size).toBe(4);
  });

  it('layar kecil (fallback stagger): semua zone tetap terbuka dan tidak ada yang keluar layar', () => {
    setViewport(1000, 760);
    const { result } = renderHook(() => useAdminDesktop());
    flushAutoOpen();

    expect(result.current.windows).toHaveLength(4);
    for (const w of result.current.windows) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.x + w.width).toBeLessThanOrEqual(1000);
      expect(w.y + w.height).toBeLessThanOrEqual(760);
    }
  });
});

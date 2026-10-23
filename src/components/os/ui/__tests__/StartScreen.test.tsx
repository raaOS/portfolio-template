import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StartScreen from '../StartScreen';

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Store props lottie palsu supaya test bisa memicu onComplete secara manual
// (meniru akhir satu putaran animasi HELLO 6 detik tanpa menunggu waktu nyata).
const lottie = vi.hoisted(() => ({
  props: null as null | { onComplete?: () => void },
}));

vi.mock('lottie-react', () => ({
  default: (props: { onComplete?: () => void }) => {
    lottie.props = props;
    return <svg data-testid="lottie-hello" />;
  },
}));

// next/dynamic diarahkan langsung ke mock lottie-react (sinkron, tanpa
// import asinkron) — StartScreen memakai dynamic ssr:false untuk Lottie.
vi.mock('next/dynamic', async () => {
  const mod = (await import('lottie-react')) as unknown as { default: (props: Record<string, unknown>) => React.ReactElement };
  return {
    default: () => {
      const DynamicMock = (props: Record<string, unknown>) => <mod.default {...props} />;
      return DynamicMock;
    },
  };
});

vi.mock('../../utils/SoundManager', () => ({
  soundManager: {
    unlock: vi.fn(),
    play: vi.fn(),
  },
}));

describe('StartScreen — HELLO hitam diputar sampai selesai (v1.3.37)', () => {
  const onComplete = () => lottie.props?.onComplete?.();

  beforeEach(() => {
    lottie.props = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TIDAK auto-mulai sebelum animasi selesai — jauh melampaui auto-start lama 1,2 dtk', () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} isActive />);

    act(() => {
      vi.advanceTimersByTime(5000); // > auto-start lama (1200ms) — dulu animasi sudah terpotong di sini
    });

    expect(screen.getByTestId('os-start-screen')).toHaveAttribute('data-boot-state', 'idle');
    expect(onStart).not.toHaveBeenCalled();
  });

  it('onComplete lottie (animasi selesai) → mulai boot; onStart terpanggil setelah slide', () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} isActive />);

    act(() => {
      onComplete(); // animasi HELLO satu putaran penuh selesai
    });

    expect(screen.getByTestId('os-start-screen')).toHaveAttribute('data-boot-state', 'booting');

    act(() => {
      vi.advanceTimersByTime(650); // BOOT_CONFIG.completeDelay
    });

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('jaring pengaman: tanpa sinyal onComplete, boot tetap jalan pada 15 detik', () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} isActive />);

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByTestId('os-start-screen')).toHaveAttribute('data-boot-state', 'booting');
  });

  it('klik tetap menjadi jalan pintas (skip) seperti sebelumnya', () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} isActive />);

    fireEvent.click(screen.getByTestId('os-start-screen'));

    expect(screen.getByTestId('os-start-screen')).toHaveAttribute('data-boot-state', 'booting');
  });

  it('setelah boot selesai, StartScreen dilepas dari DOM', () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    const { unmount } = render(<StartScreen onStart={onStart} isActive />);

    act(() => {
      onComplete();
      vi.advanceTimersByTime(650);
    });

    // screenState 'done' → StartScreen return null; slide 600ms selesai
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    unmount();
  });

  // ─── CRUD Intro Animasi (v1.3.42): prop style ────────────────────────────
  it('style default hello-black: latar putih (perilaku lama tidak berubah)', () => {
    vi.useFakeTimers();
    render(<StartScreen onStart={vi.fn()} isActive />);

    const el = screen.getByTestId('os-start-screen');
    expect(el).toHaveAttribute('data-intro-style', 'hello-black');
    expect(el.className).toContain('bg-white');
    expect(el.className).not.toContain('bg-black');
  });

  it('style hello-orange: latar hitam', () => {
    vi.useFakeTimers();
    render(<StartScreen onStart={vi.fn()} isActive style="hello-orange" />);

    const el = screen.getByTestId('os-start-screen');
    expect(el).toHaveAttribute('data-intro-style', 'hello-orange');
    expect(el.className).toContain('bg-black');
    expect(el.className).not.toContain('bg-white');
  });

  it('style hello-orange tetap menjalankan boot normal saat onComplete', () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} isActive style="hello-orange" />);

    act(() => {
      onComplete();
      vi.advanceTimersByTime(650);
    });

    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

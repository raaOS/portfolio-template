import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HelloIntro from '../HelloIntro';

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Store props lottie palsu supaya test bisa memicu onLoopComplete secara
// manual (meniru akhir satu putaran animasi HELLO 6 detik tanpa waktu nyata).
const lottie = vi.hoisted(() => ({
  props: null as null | { onLoopComplete?: () => void; onComplete?: () => void },
}));

vi.mock('lottie-react', () => ({
  default: (props: { onLoopComplete?: () => void; onComplete?: () => void }) => {
    lottie.props = props;
    return <svg data-testid="lottie-hello" />;
  },
}));

// next/dynamic diarahkan langsung ke mock lottie-react (sinkron, tanpa
// import asinkron) — HelloIntro memakai dynamic ssr:false untuk Lottie.
vi.mock('next/dynamic', async () => {
  const mod = (await import('lottie-react')) as unknown as {
    default: (props: Record<string, unknown>) => React.ReactElement;
  };
  return {
    default: () => {
      const DynamicMock = (props: Record<string, unknown>) => <mod.default {...props} />;
      return DynamicMock;
    },
  };
});

describe('HelloIntro — CRUD Intro Animasi + jaring pengaman absolut (v1.3.42)', () => {
  const FADE_MS = 700;
  const SAFETY_MS = 30000;

  const completeOneLoop = () => lottie.props?.onLoopComplete?.();

  beforeEach(() => {
    lottie.props = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('default hello-orange: overlay tampil (latar hitam), hilang setelah satu putaran + fade', () => {
    vi.useFakeTimers();
    const { container } = render(<HelloIntro />);

    const overlay = screen.getByTestId('hello-intro');
    expect(overlay).toHaveAttribute('data-intro-style', 'hello-orange');
    expect(overlay.className).toContain('bg-black');

    act(() => {
      completeOneLoop();
    });
    expect(overlay).toHaveStyle({ opacity: '0' });

    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(screen.queryByTestId('hello-intro')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('style hello-black: latar putih (pasangan HELLO hitam gaya os-desktop)', () => {
    vi.useFakeTimers();
    render(<HelloIntro style="hello-black" />);

    const overlay = screen.getByTestId('hello-intro');
    expect(overlay).toHaveAttribute('data-intro-style', 'hello-black');
    expect(overlay.className).toContain('bg-white');
    expect(overlay.className).not.toContain('bg-black');
  });

  it('ready=false: satu putaran SELESAI saja tidak cukup — overlay bertahan sampai ready', () => {
    vi.useFakeTimers();
    render(<HelloIntro ready={false} />);

    act(() => {
      completeOneLoop();
    });
    // Belum keluar: masih menunggu ready
    expect(screen.getByTestId('hello-intro')).toHaveStyle({ opacity: '1' });

    act(() => {
      vi.advanceTimersByTime(SAFETY_MS);
    });
    // Jaring pengaman absolut memaksa keluar meski ready tak pernah true
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(screen.queryByTestId('hello-intro')).toBeNull();
  });

  it('onComplete/onLoopComplete TIDAK pernah fire (chunk lottie gagal) → tetap hilang via safety 30 dtk', () => {
    vi.useFakeTimers();
    render(<HelloIntro />);

    // Sebelum ambang: overlay masih menutup layar
    act(() => {
      vi.advanceTimersByTime(SAFETY_MS - 1000);
    });
    expect(screen.getByTestId('hello-intro')).toBeTruthy();

    // Timer safety memicu safetyTriggered → effect fade (700ms) baru di-arm
    // setelah flush React, jadi advance fade-nya act terpisah.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(screen.queryByTestId('hello-intro')).toBeNull();
  });

  it('jalur normal menyelesaikan safety timer lebih dulu (tidak dobel fade)', () => {
    vi.useFakeTimers();
    render(<HelloIntro />);

    act(() => {
      completeOneLoop();
    });
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(screen.queryByTestId('hello-intro')).toBeNull();

    // Mundur jauh melewati sisa jendela safety — overlay sudah dilepas, tidak ada error/remeasure
    act(() => {
      vi.advanceTimersByTime(SAFETY_MS);
    });
    expect(screen.queryByTestId('hello-intro')).toBeNull();
  });
});

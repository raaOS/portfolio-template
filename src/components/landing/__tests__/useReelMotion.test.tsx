/**
 * Test `useReelMotion` — mesin reel gelombang halaman jualan.
 *
 * Yang dijaga:
 * 1. Posisi awal kartu ditulis SEBELUM paint (inline `translate3d`, tidak
 *    menumpuk) dan counter langsung benar.
 * 2. `prefers-reduced-motion: reduce` → hook TIDAK menulis transform dan
 *    TIDAK menjalankan rAF (tata letak diserahkan ke CSS), tapi iframe tetap
 *    di-mount begitu stage terlihat.
 * 3. Beralih ke reduced-motion di tengah jalan → transform dibersihkan dan
 *    loop dihentikan.
 */
import { act, cleanup, render } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReelMotion } from '@/components/landing/reel/useReelMotion';

type ChangeListener = (event: { matches: boolean }) => void;

interface Harness {
  itemRefs: RefObject<(HTMLElement | null)[]>;
  stageRef: RefObject<HTMLDivElement | null>;
  counterRef: RefObject<HTMLSpanElement | null>;
  onFirstVisible: ReturnType<typeof vi.fn>;
  fireVisible: () => void;
  fireMotionChange: (matches: boolean) => void;
  raf: ReturnType<typeof vi.spyOn>;
  caf: ReturnType<typeof vi.spyOn>;
  setReduced: (value: boolean) => void;
}

function setup(reduced: boolean): Harness {
  const changeListeners = new Set<ChangeListener>();
  const media = {
    matches: reduced,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_type: string, listener: ChangeListener) => changeListeners.add(listener),
    removeEventListener: (_type: string, listener: ChangeListener) => changeListeners.delete(listener),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media)
  );

  let observerCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {
        observerCallback = null;
      }
    }
  );

  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
  const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

  const onFirstVisible = vi.fn();
  const stageRef = createRef<HTMLDivElement>();
  const counterRef = createRef<HTMLSpanElement>();
  const itemRefs: RefObject<(HTMLElement | null)[]> = { current: [null, null, null] };

  function Probe() {
    useReelMotion({ stageRef, itemRefs, counterRef, count: 3, onFirstVisible });
    return null;
  }

  // `<Probe />` sengaja DIRAKIT SETELAH stage: ref DOM harus terpasang dulu
  // sebelum layout effect hook membacanya (urutan yang sama dipakai
  // ReelSection — hook dipanggil oleh komponen pemilik stage).
  render(
    <>
      <div ref={stageRef}>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="reel-item"
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
          >
            <div className="reel-card" />
          </div>
        ))}
        <span ref={counterRef} />
      </div>
      <Probe />
    </>
  );

  return {
    itemRefs,
    stageRef,
    counterRef,
    onFirstVisible,
    raf,
    caf,
    fireVisible: () => {
      act(() => {
        observerCallback?.([{ isIntersecting: true }]);
      });
    },
    fireMotionChange: (matches: boolean) => {
      act(() => {
        changeListeners.forEach((listener) => listener({ matches }));
      });
    },
    setReduced: (value: boolean) => {
      media.matches = value;
    },
  };
}

describe('useReelMotion', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollY', 0);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('menulis posisi kartu yang berbeda sebelum paint pertama', () => {
    const harness = setup(false);

    const transforms = harness.itemRefs.current.map((item) => item?.style.transform ?? '');
    expect(transforms.every((transform) => transform.includes('translate3d('))).toBe(true);
    expect(new Set(transforms).size).toBe(3);

    expect(harness.counterRef.current?.textContent).toMatch(/0[1-3] \/ 03/);
    expect(harness.onFirstVisible).not.toHaveBeenCalled();
  });

  it('menjalankan loop dan memicu mount iframe saat stage terlihat', () => {
    const harness = setup(false);
    harness.fireVisible();

    expect(harness.onFirstVisible).toHaveBeenCalledTimes(1);
    expect(harness.raf).toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(harness.onFirstVisible).toHaveBeenCalledTimes(1); // hanya sekali seumur hidup
  });

  it('reduced-motion: tidak menulis transform dan tidak menjalankan rAF', () => {
    const harness = setup(true);

    expect(harness.itemRefs.current.every((item) => item?.style.transform === '')).toBe(true);

    harness.fireVisible();
    expect(harness.onFirstVisible).toHaveBeenCalledTimes(1); // iframe tetap di-mount
    expect(harness.raf).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(harness.raf).not.toHaveBeenCalled();
  });

  it('beralih ke reduced-motion di tengah jalan: transform dibersihkan & loop berhenti', () => {
    const harness = setup(false);
    harness.fireVisible();
    expect(harness.raf).toHaveBeenCalled();

    harness.setReduced(true);
    harness.fireMotionChange(true);

    expect(harness.itemRefs.current.every((item) => item?.style.transform === '')).toBe(true);
    expect(harness.caf).toHaveBeenCalled();
  });
});

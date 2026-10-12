import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBootSequence } from '../useBootSequence';

/**
 * Regresi loader homepage (v1.3.41): saat loader aktif, page.tsx mengirim
 * `suppressIntro` → useBootSequence({ forceSkip: true }) sehingga boot native
 * os-desktop (StartScreen HELLO) tidak berjalan dua kali di belakang overlay
 * DeckReveal/HelloIntro. Tanpa flag, boot native harus tetap jalan persis
 * seperti biasa (loader mati = default semua customer).
 */
describe('useBootSequence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.documentElement.removeAttribute('data-os-booted');
    document.documentElement.removeAttribute('data-os-needs-boot');
  });

  it('forceSkip:true → needsPowerOn false sejak render pertama (boot native disenyapkan)', () => {
    const { result } = renderHook(() => useBootSequence({ forceSkip: true }));
    expect(result.current.needsPowerOn).toBe(false);
    expect(result.current.isBooting).toBe(false);
  });

  it('tanpa forceSkip & sesi belum pernah boot → needsPowerOn true (boot native jalan)', () => {
    const { result } = renderHook(() => useBootSequence());
    expect(result.current.needsPowerOn).toBe(true);
  });

  it('sesi sudah boot (data-os-booted) → tetap fast-path skip tanpa forceSkip', () => {
    document.documentElement.setAttribute('data-os-booted', 'true');
    const { result } = renderHook(() => useBootSequence());
    expect(result.current.needsPowerOn).toBe(false);
  });
});

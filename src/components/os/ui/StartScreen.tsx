'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import helloAnimationData from '../../../../public/lottie/hello hitam.json';
import { soundManager } from '../utils/SoundManager';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface StartScreenProps {
  onStart: () => void;
  isActive: boolean;
  onReady?: () => void;
  onReveal?: () => void;
}

type ScreenState = 'idle' | 'booting' | 'done';

const BOOT_CONFIG = {
  // Jaring pengaman BUKAN penentu durasi: animasi HELLO hitam diputar sampai
  // SELESAI satu putaran (sinyal onComplete lottie, durasi animasi 6 detik)
  // baru layar slide ke desktop — permintaan owner v1.3.37. Timer ini hanya
  // menjamin halaman tidak tersangkut kalau chunk lottie gagal dimuat atau
  // tab tersembunyi menunda rAF (animasi dilanjutkan saat tab terlihat).
  safetyFallbackDelay: 15000,
  revealDelay: 0,
  slideDuration: 600,
  completeDelay: 650,
};

const StartScreen = ({ onStart, isActive, onReady, onReveal }: StartScreenProps) => {
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const revealRafRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      if (revealRafRef.current !== null) {
        window.cancelAnimationFrame(revealRafRef.current);
      }
    };
  }, []);

  const queueTimer = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
  }, []);

  const handleStart = useCallback((options: { playSound: boolean } = { playSound: true }) => {
    if (screenState !== 'idle' || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (options.playSound) {
      soundManager.unlock();
      soundManager.play('startup');
    }
    setScreenState('booting');

    queueTimer(() => {
      if (typeof window === 'undefined') {
        onReveal?.();
        return;
      }

      revealRafRef.current = window.requestAnimationFrame(() => {
        onReveal?.();
        revealRafRef.current = null;
      });
    }, BOOT_CONFIG.revealDelay);

    queueTimer(() => {
      setScreenState('done');
      onStart();
    }, BOOT_CONFIG.completeDelay);
  }, [onReveal, onStart, queueTimer, screenState]);

  useEffect(() => {
    if (!isActive || screenState !== 'idle') {
      return;
    }

    // Jaring pengaman saja — jalur normal selesai lewat onComplete lottie
    // (animasi HELLO 6 detik) di JSX bawah.
    const timer = setTimeout(() => {
      handleStart({ playSound: false });
    }, BOOT_CONFIG.safetyFallbackDelay);

    return () => clearTimeout(timer);
  }, [handleStart, isActive, screenState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Enter') {
        return;
      }

      event.preventDefault();
      handleStart({ playSound: true });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStart]);

  if (!isActive || screenState === 'done') {
    return null;
  }

  return (
    <m.button
      id="start-screen"
      type="button"
      data-testid="os-start-screen"
      data-boot-state={screenState}
      aria-label="Mulai Portfolio OS"
      className="fixed inset-0 z-[999999] flex h-full w-full cursor-pointer select-none items-center justify-center overflow-hidden bg-white p-6 text-black outline-none print:hidden"
      initial={{ y: '0%' }}
      animate={{ y: screenState === 'booting' ? '-100%' : '0%' }}
      transition={{
        duration: BOOT_CONFIG.slideDuration / 1000,
        ease: [0.76, 0, 0.24, 1],
      }}
      onClick={() => handleStart({ playSound: true })}
    >
      <span className="sr-only">Mulai Portfolio OS</span>
      <m.div
        className="h-[min(70vh,520px)] w-[min(86vw,620px)]"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* HELLO hitam diputar SATU PUTARAN PENUH (tanpa loop) — saat animasi
            selesai (onComplete) layar baru slide ke desktop. Sebelumnya
            auto-start 1,2 detik memotong animasi sehingga tulisan HELLO sering
            tak sempat tampil (laporan owner v1.3.37). */}
        <Lottie
          animationData={helloAnimationData}
          loop={false}
          autoplay
          onComplete={() => handleStart({ playSound: false })}
          className="h-full w-full"
        />
      </m.div>
    </m.button>
  );
};

export default StartScreen;

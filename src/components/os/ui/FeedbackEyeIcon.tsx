'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';
import type { LottieRefCurrentProps } from 'lottie-react';
import { POPULAR_EMOJIS } from '@/components/chat/data/EmojiData';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

function getEmojiByName(name: string, fallback: string) {
  return POPULAR_EMOJIS.find((emoji) => emoji.name === name)?.char ?? fallback;
}

export const FEEDBACK_EMOJIS = {
  heart: getEmojiByName('heart', '\u2764\uFE0F'),
  success: getEmojiByName('smiling heart', '\u{1F970}'),
} as const;

/**
 * Ikon mata animasi (Lottie) untuk modal exit-intent feedback.
 * Self-contained: fetch animation JSON dengan AbortController, destroy
 * instance Lottie saat unmount, fallback emoji ❤️ saat data belum termuat.
 */
export function FeedbackEyeIcon() {
  const [animationData, setAnimationData] = useState<unknown>(null);
  const prefersReducedMotion = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    const instance = lottieRef.current;
    return () => {
      instance?.destroy?.();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadAnimation = async () => {
      try {
        const response = await fetch('/lottie/mata.json', {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = await response.json();
        setAnimationData(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    };

    loadAnimation();

    return () => controller.abort();
  }, []);

  if (!animationData) {
    return (
      <div className="flex items-center justify-center" style={{ width: 280, height: 120 }}>
        <span className="text-[88px] leading-none" aria-hidden="true">
          {FEEDBACK_EMOJIS.heart}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex h-[120px] w-[280px] items-center justify-center overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={!prefersReducedMotion}
          autoplay={!prefersReducedMotion}
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
          style={{ width: 280, height: 280 }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

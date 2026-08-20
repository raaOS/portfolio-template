'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BentoAnimationPreset } from '@/lib/templates/bento/settings';

interface AnimatedSectionProps {
  animation: BentoAnimationPreset;
  /** Aktifkan stagger delay antar child (hanya dipakai untuk preset `stagger`). */
  stagger?: boolean;
  /** Parallax ringan berbasis scroll (sesuai `motion.parallax`). */
  parallax?: boolean;
  children: React.ReactNode;
}

const ENTRANCE_TRANSFORM: Record<BentoAnimationPreset, string> = {
  none: '',
  'fade-up': 'translateY(28px)',
  'slide-in': 'translateX(-36px)',
  scale: 'scale(0.94)',
  stagger: 'translateY(16px)',
};

const ENTRANCE_TRANSITION = 'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Membungkus section agar muncul dengan animasi saat masuk viewport.
 * - Hydration-safe: state awal `hidden` hanya dipasang setelah mount (SSR selalu render konten).
 * - `animation === 'none'` atau `prefers-reduced-motion` → render konten langsung tanpa animasi.
 * - `stagger` memberi delay bertahap pada direct children.
 * - `parallax` menambahkan translateY ringan mengikuti scroll setelah section terlihat.
 */
export function AnimatedSection({
  animation,
  stagger = false,
  parallax = false,
  children,
}: AnimatedSectionProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  // Diisi setelah mount untuk menghindari mismatch hydration (SSR tanpa matchMedia).
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const node = innerRef.current;
    if (!node) return;

    if (animation === 'none') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }

    if (prefersReducedMotion()) {
      setReducedMotion(true);
      setVisible(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [animation]);

  const updateParallax = useCallback(() => {
    const node = parallaxRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const viewportH = window.innerHeight || 1;
    const offset = (rect.top + rect.height / 2 - viewportH / 2) / viewportH;
    node.style.transform = `translateY(${Math.round(offset * -24)}px)`;
  }, []);

  useEffect(() => {
    if (!parallax || !visible) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateParallax);
    };
    updateParallax();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [parallax, visible, updateParallax]);

  // Penting: `animate` TIDAK boleh bergantung pada matchMedia saat render.
  // SSR tidak punya window (→ false) sedangkan client dengan reduced-motion
  // bisa true → mismatch hydration. Deteksi reduced-motion murni di effect
  // (setelah mount), jadi render SSR & client pertama selalu identik.
  const animate = animation !== 'none' && !reducedMotion;

  const innerStyle: React.CSSProperties | undefined = animate
    ? {
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : ENTRANCE_TRANSFORM[animation],
        transition: ENTRANCE_TRANSITION,
        willChange: 'opacity, transform',
      }
    : undefined;

  const content =
    stagger && animate && animation === 'stagger'
      ? React.Children.map(children, (child, index) => {
          if (!child || !React.isValidElement(child)) return child;
          const element = child as React.ReactElement<{ style?: React.CSSProperties }>;
          return React.cloneElement(element, {
            style: {
              transitionDelay: `${Math.min(index * 80, 400)}ms`,
              ...(element.props.style ?? {}),
            },
          });
        })
      : children;

  const body = (
    <div ref={innerRef} style={innerStyle}>
      {content}
    </div>
  );

  if (!parallax) return body;

  return (
    <div ref={parallaxRef} style={{ willChange: 'transform' }} data-testid="bento-parallax-layer">
      {body}
    </div>
  );
}
import { useState, useEffect } from 'react';

/**
 * Hook to lock the desktop environment in place.
 *
 * Manages:
 * - `mounted` state for component readiness
 * - `isMobile` state for responsive layout
 * - Prevents scroll/overflow when OS mode is active
 * - Applies full-viewport lock styles via CSS class (avoids style tag injection)
 */
export const useDesktopLock = () => {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 768;
    return false;
  });

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));

    const html = document.documentElement;
    const body = document.body;
    const originalStyles = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
    };

    // Lock viewport
    window.scrollTo(0, 0);
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.height = '100%';

    // Apply OS mode lock via CSS class instead of injecting a <style> tag.
    // The class applies the same styles (overflow:hidden, position:fixed, etc.)
    // but is safer because it won't conflict with other components' style injections.
    html.classList.add('os-mode-active');
    body.classList.add('os-mode-active');

    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile((prev) => {
        const next = width < 768;
        return prev === next ? prev : next;
      });
    };

    // Initial mobile check
    requestAnimationFrame(() => {
      setIsMobile((prev) => {
        const next = window.innerWidth < 768;
        return prev === next ? prev : next;
      });
    });

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);

      // Restore
      html.style.overflow = originalStyles.htmlOverflow;
      body.style.overflow = originalStyles.bodyOverflow;
      html.style.height = originalStyles.htmlHeight;
      body.style.height = originalStyles.bodyHeight;
      html.classList.remove('os-mode-active');
      body.classList.remove('os-mode-active');
    };
  }, []);

  return { mounted, isMobile };
};

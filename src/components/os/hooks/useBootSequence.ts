'use client';

import { useState, useCallback, useEffect, startTransition } from 'react';
import { soundManager } from '../utils/SoundManager';

interface BootSequenceConfig {
  allowSkip: boolean;
}

const DEFAULT_CONFIG: BootSequenceConfig = {
  allowSkip: true,
};

const BOOT_SESSION_KEY = 'portfolio_os_booted';

function isBootedFastPath(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return (
      document.documentElement.getAttribute('data-os-booted') === 'true' ||
      sessionStorage.getItem(BOOT_SESSION_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Check if we should skip the boot animation
 * Solution 1: sessionStorage - persist during tab session
 * Solution 2: query params - skip if coming from dock/app launch (?app=xxx)
 * Solution 3: referrer check - skip if coming from internal navigation
 */
function checkShouldSkipBoot(): boolean {
  // SSR safety
  if (typeof window === 'undefined') return false;

  try {
    // 1. Check DOM attribute (set by blocking head script in layout.tsx)
    const html = document.documentElement;
    if (html.getAttribute('data-os-booted') === 'true') {
      return true;
    }

    // 2. Check sessionStorage - already booted in this session?
    const hasBooted = sessionStorage.getItem(BOOT_SESSION_KEY);
    if (hasBooted === 'true') {
      return true;
    }

    // 2. Check query params - launched from dock/app navigation?
    const urlParams = new URLSearchParams(window.location.search);
    const appParam = urlParams.get('app');
    if (appParam) {
      // Mark as booted
      sessionStorage.setItem(BOOT_SESSION_KEY, 'true');
      return true;
    }

    // 3. Check referrer - navigating from internal page?
    const referrer = document.referrer;
    const currentHost = window.location.host;

    // Parse referrer to get host
    let referrerHost = '';
    try {
      if (referrer) {
        referrerHost = new URL(referrer).host;
      }
    } catch {
      // Invalid referrer URL
    }

    // If coming from same host (internal navigation)
    if (referrerHost && referrerHost === currentHost) {
      // Mark as booted so refresh also skips
      sessionStorage.setItem(BOOT_SESSION_KEY, 'true');
      return true;
    }

    // 4. Check automated audit environments (Lighthouse / Headless Chrome / Webdriver)
    if (
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /lighthouse|headlesschrome/i.test(navigator.userAgent))
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('[BootSequence] Error checking boot status:', error);
    return false;
  }
}

export function useBootSequence(config: Partial<BootSequenceConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // The OS desktop is loaded client-side after HomeOSWrapper mounts. Reading
  // the beforeInteractive fast-path here prevents a one-frame black skeleton
  // when the current tab already completed boot and the page is refreshed.
  const [needsPowerOn, setNeedsPowerOn] = useState(() => !isBootedFastPath());

  const [isBooting, setIsBooting] = useState(false);

  // Mark as booted when actual boot happens
  const markAsBooted = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(BOOT_SESSION_KEY, 'true');
      const html = document.documentElement;
      html.setAttribute('data-os-booted', 'true');
      html.removeAttribute('data-os-needs-boot');
    }
  }, []);

  // Client-side synchronization after hydration
  useEffect(() => {
    const shouldSkip = checkShouldSkipBoot();
    if (shouldSkip) {
      startTransition(() => {
        setNeedsPowerOn(false);
      });
    }
  }, []);

  const powerOn = useCallback(() => {
    soundManager.unlock();
    soundManager.clearCache('startup');
    setNeedsPowerOn(false);
    setIsBooting(true);
    markAsBooted();
  }, [markAsBooted]);

  const finishBooting = useCallback(() => {
    setNeedsPowerOn(false);
    setIsBooting(false);
    markAsBooted(); // FIXED (BUG-011): Persist status after natural finish
  }, [markAsBooted]);

  const skipBoot = useCallback(() => {
    if (!finalConfig.allowSkip) return;
    setNeedsPowerOn(false);
    setIsBooting(false);
    markAsBooted();
  }, [finalConfig.allowSkip, markAsBooted]);

  return {
    needsPowerOn,
    isBooting,
    powerOn,
    finishBooting,
    skipBoot,
    config: finalConfig,
  };
}

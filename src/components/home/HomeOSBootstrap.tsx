'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { DesktopEnvironmentProps } from '@/components/os/core/DesktopEnvironment';

type DesktopData = Omit<DesktopEnvironmentProps, 'autoStartBoot' | 'children'>;
type HomeOSRuntimeProps = Partial<DesktopData> & { startRequested?: boolean };
type HomeOSRuntimeComponent = React.ComponentType<HomeOSRuntimeProps>;

const BOOT_SESSION_KEY = 'portfolio_os_booted';

let cachedRuntime: HomeOSRuntimeComponent | null = null;

function shouldLoadDesktopImmediately() {
  try {
    return (
      document.documentElement.getAttribute('data-os-booted') === 'true' ||
      sessionStorage.getItem(BOOT_SESSION_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

function markBootButtonLoading() {
  const startButton = document.getElementById('boot-start-button') as HTMLButtonElement | null;
  if (!startButton) return;

  startButton.disabled = true;
  startButton.setAttribute('aria-label', 'Loading Portfolio OS');
  startButton.dataset.label = 'LOADING PORTFOLIO OS';
  startButton.style.cursor = 'wait';
  startButton.style.opacity = '0.7';
}

export default function HomeOSBootstrap(props: Partial<DesktopData> = {}) {
  const [Runtime, setRuntime] = useState<HomeOSRuntimeComponent | null>(() => cachedRuntime);
  const [startRequested, setStartRequested] = useState(false);

  const loadRuntime = useCallback((shouldStart: boolean) => {
    if (shouldStart) {
      markBootButtonLoading();
      setStartRequested(true);
    }

    if (cachedRuntime) {
      setRuntime(() => cachedRuntime);
      return;
    }

    import('./HomeOSWrapper').then((mod) => {
      cachedRuntime = mod.default as HomeOSRuntimeComponent;
      setRuntime(() => cachedRuntime);
    });
  }, []);

  useEffect(() => {
    const startButton = document.getElementById('boot-start-button');
    const handleStart = () => loadRuntime(true);
    let timerId: number | undefined;

    startButton?.addEventListener('click', handleStart);
    if (shouldLoadDesktopImmediately()) {
      timerId = window.setTimeout(() => loadRuntime(false), 0);
    }

    return () => {
      startButton?.removeEventListener('click', handleStart);
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [loadRuntime]);

  if (!Runtime) return null;

  return <Runtime {...props} startRequested={startRequested} />;
}

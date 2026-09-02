'use client';

import { useState, useEffect, useRef } from 'react';
import { useGeolocation, useAdminLogin } from '../_hooks';
import { LocationStatusPanel, LoginForm, HelpModal } from '../_components';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

function LoginEyeIcon() {
  const [animationData, setAnimationData] = useState<unknown>(null);
  const prefersReducedMotion = useReducedMotion();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lottieRef = useRef<any>(null);

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
      <div className="flex h-[120px] w-full items-center justify-center">
        <div className="h-14 w-14 animate-pulse rounded-full bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="flex justify-center">
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
    </div>
  );
}

export default function AdminLoginClient() {
  const [showHelpModal, setShowHelpModal] = useState(false);

  const {
    location,
    status: locationStatus,
    error: locationError,
    isEnabled,
    requestLocation,
    formatAccuracy,
    refreshPage,
  } = useGeolocation();

  const { email, setEmail, password, setPassword, showPassword, setShowPassword, loading, error, handleSubmit } =
    useAdminLogin(location);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <LoginEyeIcon />
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">Admin Login</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your admin password to access the dashboard
          </p>
        </div>

        {/* Location Status Indicator */}
        <LocationStatusPanel
          status={locationStatus}
          location={location}
          error={locationError}
          formatAccuracy={formatAccuracy}
          onRetry={() => {
            // Clear error and retry
            requestLocation();
          }}
          onRefresh={refreshPage}
          onShowHelp={() => setShowHelpModal(true)}
        />

        {/* Login Form */}
        <LoginForm
          email={email}
          password={password}
          showPassword={showPassword}
          loading={loading}
          error={error}
          isEnabled={isEnabled}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Help Modal */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}

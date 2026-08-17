'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export function NotFoundAnimation() {
  return (
    <DotLottieReact
      src="/lottie/404%20Error.lottie"
      autoplay
      loop
      speed={2}
      aria-label="Animasi halaman tidak ditemukan"
      className="h-full w-full"
    />
  );
}

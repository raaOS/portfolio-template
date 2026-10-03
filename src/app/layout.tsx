import type { Metadata, Viewport } from 'next';
import { displayClassName, sansClassName } from '@/app/fonts';
import { baseSEO, generateStructuredData } from '@/lib/seo';
import Providers from '@/components/layout/Providers';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

import UnregisterSW from '@/components/shared/UnregisterSW';
import DevWebVitalsGate from '@/components/shared/DevWebVitalsGate';
import PageViewTracker from '@/components/layout/PageViewTracker';
import { ViewTransitions } from 'next-view-transitions';
import { APP_VERSION } from '@/lib/constants';

import './globals.css';

// Separate viewport export for Next.js 14+
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0b' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(baseSEO.siteUrl),
  title: {
    default: baseSEO.title,
    template: `%s | ${baseSEO.title}`,
  },
  description: baseSEO.description,
  keywords: baseSEO.keywords,
  authors: [{ name: baseSEO.author }],
  creator: baseSEO.author,
  publisher: baseSEO.author,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'OUkbKUBgDSUy_uGFSC_hVI_QdgNTZzv1WldX2YWEjIY',
  },
  openGraph: {
    type: 'website',
    locale: baseSEO.locale,
    url: baseSEO.siteUrl,
    title: baseSEO.title,
    description: baseSEO.description,
    siteName: baseSEO.title,
    images: [
      {
        url: baseSEO.image,
        width: 1200,
        height: 630,
        alt: baseSEO.title,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: baseSEO.title,
    description: baseSEO.description,
    images: [baseSEO.image],
  },
  alternates: {
    canonical: baseSEO.siteUrl,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransitions>
      <html lang="id" suppressHydrationWarning>
        <head>
          {/* Preconnect to critical domains */}
          {/* Google Fonts - Fallback for next/font to satisfy Babel/SWC conflict */}
          {/* Structured Data */}
          <meta name="application-version" content={APP_VERSION} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(generateStructuredData('website')).replace(/</g, '\\u003c'),
            }}
          />
          {/*
            Raw inline <script> instead of next/script beforeInteractive.
            Next.js Script loader adds a blocking fetch round-trip for its
            chunk, delaying FCP. Inline script executes during initial HTML
            parse — zero extra latency. Logic mirrors useBootSequence.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var h=document.documentElement,b=sessionStorage.getItem('portfolio_os_booted')==='true';if(b){h.setAttribute('data-os-booted','true');h.removeAttribute('data-os-needs-boot');return}var r=document.referrer;if(r){try{if(new URL(r).host===window.location.host){h.setAttribute('data-os-booted','true');h.removeAttribute('data-os-needs-boot');return}}catch(e){}}var s=window.location.search||'';if(s.indexOf('app=')!==-1){h.setAttribute('data-os-booted','true');h.removeAttribute('data-os-needs-boot');return}var p=window.location.pathname||'/';if(p==='/templates/os-desktop/demo'){h.setAttribute('data-os-needs-boot','true');return}h.removeAttribute('data-os-needs-boot')}catch(e){}})()`,
            }}
          />
          <style
            dangerouslySetInnerHTML={{
              __html:
                'html[data-os-needs-boot] body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}',
            }}
          />
        </head>
        {/* suppressHydrationWarning removed: handled by Two-Pass Rendering in HomeOSWrapper */}
        <body className={`font-sans ${sansClassName} ${displayClassName}`} data-page="default">
          {/* Skip to content - Accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100000] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-black focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-black"
            aria-label="Skip to main content"
          >
            Skip to main content
          </a>

          <Providers>
            <ToastProvider>
              <ErrorBoundary>
                {children}
                <UnregisterSW />
                <DevWebVitalsGate />
                <PageViewTracker />
              </ErrorBoundary>
            </ToastProvider>
          </Providers>
        </body>
      </html>
    </ViewTransitions>
  );
}

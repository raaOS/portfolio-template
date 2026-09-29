/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow development requests from localhost
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'localhost:3000',
    '127.0.0.1:3000',
    '127.0.0.1',
    'localhost',
  ],
  // Enable React Compiler for automatic optimization
  reactCompiler: true,
  reactStrictMode: true,
  compress: true,
  // ... (rest of the images config)

  // Optimize images for maximum performance
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: 'postimg.cc' },
      { protocol: 'https', hostname: 'i.postimg.cc' },
      { protocol: 'https', hostname: 'images2.imgbox.com' },
    ],
    // Cloudflare Workers target: no native Node image optimization server (_next/image),
    // so images are served directly by Cloudflare CDN/R2 without 404 errors.
    unoptimized: true,
    // Optimize device sizes for better performance
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],
    // Modern formats for best compression and performance
    formats: ['image/avif', 'image/webp'],
    // Supported image qualities to match assets
    qualities: [60, 70, 75, 85, 90],
    // Long cache time for CDN optimization (1 year)
    minimumCacheTTL: 31536000,
    // Security: prevent SVG injection attacks
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Transpile packages that need ESM handling
  transpilePackages: ['motion'],

  // Optimize static assets
  // Improve static asset handling
  trailingSlash: false,

  // Enable experimental features for performance
  experimental: {
    // Enable optimistic client cache for faster navigation
    optimisticClientCache: true,
    // Enable scroll restoration
    scrollRestoration: true,
    // Inline critical CSS via critters to reduce render-blocking CSS on cold start.
    // critters sudah ada di devDependencies; tanpa flag ini fitur tidak aktif.
    optimizeCss: true,
    // Tree-shake barrel imports untuk paket icon/animation/utility yang dipakai
    // banyak di OS desktop. Mengurangi ukuran bundle client pada cold start.
    optimizePackageImports: [
      'lucide-react',
      '@tabler/icons-react',
      'date-fns',
      'motion',
      'fuse.js',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
    ],
  },

  // Turbopack configuration (Next.js 16 Stable Bundler).
  // Default Turbopack sudah handle splitChunks/treeshaking/moduleIds secara optimal.
  turbopack: {},

  // Webpack config HANYA dipakai sebagai fallback via `npm run dev:webpack`.
  // Build production di Vercel pakai Turbopack (Next 16 default), jadi custom
  // splitChunks yang dulu ada di sini adalah dead config dan sudah dihapus.
  // .mjs resolution rule tetap dipertahankan untuk fallback dev webpack.
  webpack: (config) => {
    // Fix ESM .mjs module resolution untuk paket yang masih ESM-only (motion).
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: {
        fullySpecified: false,
      },
    });
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/portal',
        destination: '/admin',
      },
      {
        source: '/portal/login',
        destination: '/admin/login',
      },
      {
        source: '/portal/:path*',
        destination: '/admin/:path*',
      },
      // Swallow legacy Vite HMR client requests (harmless 404s in Next dev)
      // Handle __webpack_hmr requests to suppress 404 errors in logs
      {
        source: '/__webpack_hmr',
        destination: '/api/empty',
      },
      {
        source: '/events',
        destination: '/api/empty',
      },
    ];
  },
  async redirects() {
    return [
      { source: '/index', destination: '/', permanent: true },
      { source: '/indeks', destination: '/', permanent: true },
      { source: '/home', destination: '/', permanent: true },
      // Redirect /works to /projects - permanent redirect
      { source: '/works/:slug*', destination: '/projects/:slug*', permanent: true },
      { source: '/project/:slug*', destination: '/projects/:slug*', permanent: true },
      // Redirect legacy admin templates routes to main admin desktop
      { source: '/admin/templates', destination: '/admin', permanent: false },
      { source: '/admin/templates/:path*', destination: '/admin', permanent: false },
      // Note: trailing slash removal is handled by trailingSlash: false
    ];
  },
  async headers() {
    return [
      // Cache control for Home page (HTML).
      // s-maxage diselaraskan dengan ISR `revalidate = 60` di src/app/(site)/page.tsx
      // supaya edge cache tidak menahan HTML lebih lama dari ISR window.
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300, must-revalidate',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          // Security Headers for Best Practices 100
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            // Disamakan dengan nilai di src/middleware/utils.ts (sebelumnya
            // beda: 63072000 di sini vs 31536000 di middleware → header kembar
            // dengan nilai konflik tergantung jalur mana yang menang).
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            // Disamakan dengan src/middleware/utils.ts (nilai lama
            // `origin-when-cross-origin` bocorkan full URL lintas origin).
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(self), interest-cohort=()',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          // Catatan: preconnect ke fonts.googleapis.com di-drop karena project
          // memakai next/font/google yang self-host font ke /_next/static.
          // Preconnect ke domain yang tidak dipakai hanya menambah overhead DNS.
        ],
      },
      // Static assets caching — DIHAPUS.
      // Next.js default untuk /_next/static sudah optimal (1 tahun immutable).
      // Override dengan nilai identik cuma bikin build warning tanpa gain.
      {
        source: '/assets/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value:
              process.env.NODE_ENV === 'development'
                ? 'no-cache, no-store, must-revalidate'
                : 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API caching
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
  // Production optimizations
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  generateEtags: true,

  // Strict mode for quality
  typescript: {
    ignoreBuildErrors: false,
  },

  // Compiler optimizations
  compiler: {
    // In production, strip console.* calls EXCEPT console.error / console.warn
    // so real errors and security warnings (CSRF, rate-limit, etc.) still surface
    // in server logs and browser consoles for diagnosis.
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

import createBundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer(nextConfig);

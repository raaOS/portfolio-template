import { NextRequest, NextResponse } from 'next/server';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { APP_VERSION } from '@/lib/constants';
import { isOwnerMode } from '@/lib/ownerMode';

function isCloudflareRuntime(request: NextRequest): boolean {
  return Boolean(
    request.headers.get('cf-ray') ||
      request.headers.get('cf-connecting-ip') ||
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      process.env.CF_PAGES
  );
}

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await enforceRequestRateLimit(request, 'health', 10, 60_000, 300_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { status: 'rate_limited', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }
    const checks: Record<string, unknown> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'unknown',
      // Versi rilis nyata (disamakan dengan entri teratas CHANGELOG.md).
      // Portal onboarding membandingkan nilai ini dengan CHANGELOG untuk
      // badge "perlu update" — sebelumnya hardcode '1.0.0' sehingga semua
      // klien selalu ditandai outdated dan deploy gagal tak pernah terdeteksi.
      version: APP_VERSION,
    };

    if (isCloudflareRuntime(request)) {
      checks.filesystem = 'not_applicable';
    } else {
      // Check file system access for local Node.js runtime.
      try {
        const fs = await import('fs').then((m) => m.promises);
        const path = await import('path');
        const testPath = path.join(process.cwd(), 'public');
        await fs.access(testPath);
        checks.filesystem = 'accessible';
      } catch {
        checks.filesystem = 'inaccessible';
        checks.status = 'degraded';
      }
    }

    // Check configured data backend connection.
    try {
      const { db, getDatabaseBackend } = await import('@/lib/database');

      // Perform an actual lightweight read operation with a timeout
      // This guarantees that the network connection is alive and credentials are valid
      const dbStart = Date.now();
      const timeoutMs = process.env.NODE_ENV === 'development' ? 15000 : 5000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      );
      const readPromise = db.ref('_healthCheck').once('value');

      await Promise.race([readPromise, timeoutPromise]);

      checks.database = 'connected';
      checks.databaseBackend = getDatabaseBackend();
      checks.databaseLatencyMs = Date.now() - dbStart;
    } catch (error) {
      console.error('Database health check failed:', error);
      checks.database = 'disconnected';
      checks.status = 'degraded';
    }

    // Hasil probe kesehatan Worker harian (Error 1102 / CPU limit) — hanya site
    // owner. Ditulis oleh cron `/api/cron/daily` dan dibaca dari `app_kv`.
    //
    // Sengaja TIDAK mengubah `checks.status`: probe gagal berarti "kepala ruang
    // menyusut", bukan "site ini sakit" — situsnya sendiri masih melayani request
    // dengan normal. Kegagalan membaca D1 juga ditelan di sini agar halaman
    // kesehatan tetap menjawab 200 saat storage sedang bermasalah.
    if (isOwnerMode()) {
      try {
        const { getD1Value } = await import('@/lib/cloudflareD1');
        const { WORKER_HEALTH_KEY, isWorkerHealthStale } = await import('@/lib/workerHealthProbe');
        const stored = await getD1Value<Awaited<ReturnType<typeof import('@/lib/workerHealthProbe').probeWorkerHealth>>>(
          WORKER_HEALTH_KEY
        );
        // Usia ikut dilaporkan. Bacaan yang tidak tersimpan akan tetap membawa
        // angka lama, dan angka lama yang dipajang tanpa penanda justru
        // menimbulkan lampu hijau palsu.
        checks.workerHealth = stored ? { ...stored, stale: isWorkerHealthStale(stored) } : null;
      } catch (err) {
        console.error('Worker health read failed:', err instanceof Error ? err.message : err);
      }
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    };

    const statusCode = checks.status === 'ok' ? 200 : 503;
    return NextResponse.json(checks, { status: statusCode });
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sweepExpiredOrders } from '@/lib/services/orderService';
import { runDailyBackup } from '@/lib/services/d1BackupService';
import { isOwnerMode } from '@/lib/ownerMode';
import { probeWorkerHealth, recordWorkerHealth } from '@/lib/workerHealthProbe';

/**
 * POST /api/cron/daily — pekerjaan harian yang dijalankan Cloudflare cron trigger
 * (`triggers.crons` di wrangler.jsonc, 01:00 WIB / 18:00 UTC).
 *
 * Pemanggilnya bukan browser, tapi handler `scheduled` yang diekspor ke
 * `.open-next/worker.js` oleh `scripts/cloudflare/prepare-opennext-worker-output.js`
 * — route ini dipanggil lewat service binding `WORKER_SELF_REFERENCE`
 * (request internal, tidak lewat internet publik).
 *
 * Route-nya tetap bisa diakses publik, jadi wajib membawa header
 * `x-cron-secret` yang sama dengan `CRON_SECRET`, dibandingkan secara
 * timing-safe. Tanpa konfigurasi `CRON_SECRET`, endpoint menjawab 500 dan
 * handler `scheduled` melewati run (lihat catatan di skrip prepare output).
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const provided = request.headers.get('x-cron-secret') || '';

    if (!secret) {
      return NextResponse.json({ message: 'Secret not configured' }, { status: 500 });
    }

    if (!provided) {
      return NextResponse.json({ message: 'No secret' }, { status: 401 });
    }

    // Perbandingan timing-safe: panjang dulu (bukan rahasia), lalu byte-per-byte
    // tanpa short-circuit — pola yang sama dengan webhook Telegram.
    const providedBuffer = Buffer.from(provided, 'utf8');
    const secretBuffer = Buffer.from(secret, 'utf8');
    if (providedBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(providedBuffer, secretBuffer)) {
      return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
    }

    // Menandai order kedaluwarsa. Aman dipanggil berulang: ada guard 10 menit
    // di dalam sweepExpiredOrders() sehingga D1 tidak diboroskan.
    await sweepExpiredOrders();

    // Backup D1 harian. Kegagalan backup TIDAK boleh menggagalkan run cron.
    try {
      await runDailyBackup();
    } catch (err) {
      console.error('[cron/daily] backup failed:', err instanceof Error ? err.message : err);
    }

    // Probe kesehatan Worker harian — deteksi dini Error 1102 / CPU limit.
    //
    // Khusus site OWNER (`isOwnerMode()` fail-closed): site klien dilewati
    // sepenuhnya tanpa menulis apa pun ke D1 mereka, supaya deployment klien
    // tidak membebani Worker-nya sendiri tiap hari demi dashboard milik owner.
    //
    // Kegagalan probe TIDAK boleh menggagalkan run cron — pola yang sama dengan
    // backup di atas. Probe itu sendiri memang dirancang untuk melaporkan
    // kegagalan lewat hasilnya, bukan lewat exception.
    //
    // CATATAN v1.3.67 — kegagalan PENYIMPANAN tidak lagi ditelan diam-diam.
    // Sebelumnya `workerHealth` di-assign sebelum `recordWorkerHealth()`, sehingga
    // tulisan yang gagal tetap memperlihatkan angka segar di respons dan portal,
    // sementara D1 tidak pernah menerimanya. Kegagalan semacam itu kini ikut
    // dilaporkan lewat `workerHealthRecorded` / `workerHealthRecordError`, dan
    // `/api/health` menandai bacaan yang usianya lewat batas sebagai `stale`.
    let workerHealth: Awaited<ReturnType<typeof probeWorkerHealth>> | null = null;
    let workerHealthRecorded: boolean | null = null;
    let workerHealthRecordError: string | null = null;
    if (isOwnerMode()) {
      try {
        workerHealth = await probeWorkerHealth();
      } catch (err) {
        console.error('[cron/daily] worker health probe failed:', err instanceof Error ? err.message : err);
      }

      if (workerHealth) {
        try {
          await recordWorkerHealth(workerHealth);
          workerHealthRecorded = true;
          console.log(
            `[cron/daily] worker health: cache HIT ${workerHealth.cacheHit}/${workerHealth.concurrency} ` +
              `(${Math.round(workerHealth.cacheHitRatio * 100)}%), ` +
              `${workerHealth.ok}/${workerHealth.concurrency} sukses, ` +
              `${workerHealth.failed1102}x 1102, ${workerHealth.timedOut} timeout, ` +
              `p95 ${workerHealth.p95TtfbMs ?? '-'}ms, ` +
              `${workerHealth.durationMs}ms (${workerHealth.transport}) ` +
              `-> ${workerHealth.passed ? 'SEHAT' : 'TANDA MERAH'}`
          );
        } catch (err) {
          // Hasil probe SAH, tapi tidak tersimpan. Jangan disembunyikan: tanpa
          // pesan ini portal akan memajang angka lama sebagai angka hari ini.
          workerHealthRecorded = false;
          workerHealthRecordError = err instanceof Error ? err.message : String(err);
          console.error('[cron/daily] worker health record failed:', workerHealthRecordError);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      workerHealth,
      workerHealthRecorded,
      workerHealthRecordError,
    });
  } catch (err) {
    console.error('[cron/daily] Failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ message: 'Cron run failed' }, { status: 500 });
  }
}

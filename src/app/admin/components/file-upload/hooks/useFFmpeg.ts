'use client';

import { useRef, useCallback } from 'react';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

interface TrimOptions {
  start: number;
  end: number;
  crop?: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Compression profile knobs.
 *
 * Setting di sini di-tune untuk *live wallpaper* portfolio (motion
 * graphics / CGI / particle), bukan live-action. Konsekuensinya:
 *   - Tidak pakai `-tune film` (yang optimize untuk grain pattern
 *     film analog) — itu justru bikin encoder buang detail di gradient
 *     halus motion graphics.
 *   - Tidak pakai `fps=30` filter — kalau source 60 fps biarkan 60 fps
 *     supaya motion smooth seperti source.
 *   - Cap output `-r 60` di pipeline — source > 60 fps di-decimate
 *     supaya bitrate budget yang sudah di-cap via `-maxrate` tidak
 *     habis untuk frame yang tidak akan terlihat di display 60 Hz.
 *   - CRF agak agresif (18/20) supaya visual nyaris lossless.
 *   - Bitrate cap eksplisit (`-maxrate`/`-bufsize`) supaya browser
 *     tidak terhantam VBR spike yang bisa drop frame saat playback.
 *
 * `quality`:
 *   - 'standard' : 720p,  CRF 24 (default for project media; small files).
 *   - 'high'     : 1440p, CRF 18 (default wallpaper profile — sweet spot
 *                  untuk panel 1080p sampai 24" QHD; 4K monitor masih
 *                  tajam karena CRF 18.)
 *   - 'ultra'    : 2160p, CRF 20 (4K wallpaper — pakai kalau target
 *                  monitor 4K dan source memang 4K. File 2-3× lebih
 *                  besar dari `high`, encode jauh lebih lama di WASM.)
 *
 * Profil ini match 1:1 dengan server `optimizeVideoForPortfolio.PROFILES`
 * (lihat `src/lib/videoOptimization.ts`) supaya output konsisten lewat
 * jalur upload manapun.
 *
 * Honest caveats yang TIDAK ditutup di repo ini:
 *   - Klaim relatif tentang quality (mis. preset `fast` vs `medium`)
 *     diambil dari rule-of-thumb x264 community / dokumentasi ffmpeg
 *     generik. Belum ada A/B test pada source video portfolio asli
 *     untuk konfirmasi numbernya.
 *   - Cap `-r 60` heuristik. Belum di-validasi apakah hasilnya
 *     terlihat lebih baik atau lebih buruk untuk source 120/240 fps
 *     dibanding preserve native fps.
 *   - Encode time hanya estimasi kasar (single thread WASM, system
 *     dependent). Bukan benchmark.
 *
 * The numeric scaler is constructed from `targetHeight` so portrait clips
 * keep their aspect ratio (match short edge to target).
 */
export type VideoCompressionProfile = 'standard' | 'high' | 'ultra';

interface CompressVideoOptions {
  trimOptions?: TrimOptions;
  profile?: VideoCompressionProfile;
}

interface ProfileSpec {
  targetHeight: number;
  crf: string;
  /** Bitrate cap in Mbps (anti-VBR-spike). */
  maxrate: string;
  /** Buffer size — convention is 2× maxrate for x264. */
  bufsize: string;
}

const PROFILE_PRESETS: Record<VideoCompressionProfile, ProfileSpec> = {
  // Standard tetap pakai film tune-equivalent default (no tune flag) di
  // bawah supaya project thumbnail tidak terdampak quality bump.
  standard: { targetHeight: 720, crf: '24', maxrate: '3M', bufsize: '6M' },
  high: { targetHeight: 1440, crf: '18', maxrate: '8M', bufsize: '16M' },
  ultra: { targetHeight: 2160, crf: '20', maxrate: '18M', bufsize: '36M' },
};

export function useFFmpeg(onStatusUpdate: (status: string) => void) {
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegRef.current) return ffmpegRef.current;
    onStatusUpdate('Loading Compression Core...');

    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    try {
      const configuredBaseURL = process.env.NEXT_PUBLIC_FFMPEG_BASE_URL?.replace(/\/+$/, '');
      const baseURL = configuredBaseURL || window.location.origin + '/ffmpeg';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    } catch {
      throw new Error('Compression engine failed to load.');
    }
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  }, [onStatusUpdate]);

  const compressVideo = useCallback(
    async (
      file: File,
      onProgress: (p: number) => void,
      options?: CompressVideoOptions | TrimOptions
    ): Promise<File> => {
      // Backward compatibility: callers used to pass `trimOptions` as the
      // 3rd argument directly. If the object looks like a trim payload we
      // wrap it in the new options shape transparently.
      const normalized: CompressVideoOptions = (() => {
        if (!options) return {};
        if ('start' in options && 'end' in options) {
          return { trimOptions: options as TrimOptions };
        }
        return options as CompressVideoOptions;
      })();
      const trimOptions = normalized.trimOptions;
      const profile = PROFILE_PRESETS[normalized.profile ?? 'standard'];

      onStatusUpdate('Initializing Compressor...');
      const ffmpeg = await loadFFmpeg();
      onStatusUpdate('Compressing Video (Wait)...');

      const inputName = 'input.mp4';
      const outputName = 'output.mp4';
      const startTime = Date.now();

      const { fetchFile } = await import('@ffmpeg/util');
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        const percent = Math.round(progress * 100);
        onProgress(percent);
        if (progress > 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const estimatedTotal = elapsed / progress;
          const remaining = Math.round(estimatedTotal - elapsed);
          onStatusUpdate(`Compressing Video (${percent}%) - ~${remaining}s remaining...`);
        } else {
          onStatusUpdate(`Compressing Video (${percent}%)...`);
        }
      });

      const ffmpegArgs: string[] = [];

      if (trimOptions) {
        ffmpegArgs.push('-ss', trimOptions.start.toString());
        ffmpegArgs.push('-to', trimOptions.end.toString());
      }

      ffmpegArgs.push('-i', inputName);

      const filters: string[] = [];

      if (trimOptions?.crop) {
        const { width, height, x, y } = trimOptions.crop;
        const w = Math.round(width / 2) * 2;
        const h = Math.round(height / 2) * 2;
        const px = Math.round(x / 2) * 2;
        const py = Math.round(y / 2) * 2;
        filters.push(`crop=${w}:${h}:${px}:${py}`);
      }

      // Match the short edge to the target; never upscale (`min(...,ih)`).
      // CATATAN: kita tidak set `fps=30` — biarkan native source fps.
      // Source 60 fps (umum di motion graphics / live wallpaper) yang
      // di-paksa 30 fps kelihatan judder. Standard profile (project
      // thumbnail) juga aman karena encoder x264 efisien di any fps.
      const target = profile.targetHeight;
      filters.push(
        `scale='if(gt(iw,ih),-2,min(${target},iw))':'if(gt(iw,ih),min(${target},ih),-2)'`
      );
      ffmpegArgs.push('-vf', filters.join(','));

      ffmpegArgs.push('-c:v', 'libx264');
      ffmpegArgs.push('-crf', profile.crf);
      // Preset `fast` di sisi klien (WASM).
      // Trade-off vs `medium`:
      //   - WASM ffmpeg single thread, jadi preset apapun cost-nya
      //     wall-clock-nya proporsional terhadap "complexity" preset.
      //     Pengamatan informal di developer machine: `medium` butuh
      //     sekitar 2-3× wall-clock dari `fast` untuk source 4K 30
      //     detik. Belum di-A/B test rigorous, jadi rasionya bisa
      //     beda di hardware lain.
      //   - x264 docs menjelaskan `fast` mengurangi motion estimation
      //     teliti dibanding `medium`. Quality drop di scene complex
      //     "biasanya" ada tapi besarnya tergantung content; saya
      //     belum mengukur untuk video portfolio sendiri.
      //   - Knob lain (CRF agresif, maxrate cap, GOP eksplisit, no
      //     `-tune film`, no `fps=30` drop, cap `-r 60`) lebih
      //     dominan untuk profile motion graphics ambient yang
      //     dipakai sebagai wallpaper.
      // Server-side ffmpeg native pakai `medium` karena native
      // multi-thread tidak terkena penalty WASM yang sama.
      ffmpegArgs.push('-preset', 'fast');
      // Bitrate cap eksplisit. Tanpa ini, x264 bisa pop bitrate ke
      // 30+ Mbps dadakan saat scene complex, browser drop frame karena
      // playback buffer kewalahan → terasa stutter.
      ffmpegArgs.push('-maxrate', profile.maxrate);
      ffmpegArgs.push('-bufsize', profile.bufsize);
      // GOP (keyframe interval) eksplisit. Default x264 = 250 frame.
      // Untuk loop wallpaper 5-15 detik, keyframe yang tidak align
      // dengan akhir loop bikin frame harus didecode dari keyframe
      // jauh sebelumnya saat re-loop → micro-stutter di seam.
      // 60 frame ≈ 1 detik di 60fps / 2 detik di 30fps — selalu ada
      // keyframe dekat akhir clip pendek manapun.
      ffmpegArgs.push('-g', '60');
      ffmpegArgs.push('-keyint_min', '60');
      // Cap output framerate ke 60 fps. Source ≤ 60 fps tidak terdampak
      // (lewat 1:1). Source > 60 fps (mis. screen capture iPhone 120
      // fps, slowmo 240 fps) di-decimate ke 60 fps. Display web
      // mayoritas 60 Hz refresh, frame di atas itu tidak terlihat
      // tapi tetap menggerogoti bitrate budget yang sudah di-cap
      // via maxrate. Cap ini mempertahankan bitrate budget untuk
      // frame yang akan terlihat.
      //
      // Catatan jujur: cap ini belum di-A/B test pada repo ini.
      // Heuristik dari rule of thumb x264 community + asumsi target
      // display web. Kalau ada kasus di mana ini terasa kurang halus,
      // perlu eksperimen ulang per profile.
      ffmpegArgs.push('-r', '60');
      ffmpegArgs.push('-pix_fmt', 'yuv420p');
      ffmpegArgs.push('-an');
      // `+faststart` pindah moov atom ke awal file → browser bisa
      // start playback setelah ~100 KB download, tidak harus wait
      // seluruh file. Critical untuk cold-cache visitor.
      ffmpegArgs.push('-movflags', '+faststart');
      ffmpegArgs.push(outputName);

      await ffmpeg.exec(ffmpegArgs);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data as BlobPart], { type: 'video/mp4' });
      const outputFileName = file.name.replace(/\.[^.]+$/, '') + '.mp4';
      return new File([blob], outputFileName, { type: 'video/mp4' });
    },
    [loadFFmpeg, onStatusUpdate]
  );

  return { compressVideo };
}

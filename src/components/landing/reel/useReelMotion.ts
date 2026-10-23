'use client';

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Mesin reel gelombang untuk halaman jualan.
 *
 * Dipinjam mekanik "Reel: Wave Carousel" (Saurow — lihat
 * blog-saurow.vercel.app/article/reel) tapi dijalankan di DOM, bukan WebGL:
 * satu-satunya cara agar isi kartu tetap iframe live.
 *
 * 1. Scroll vertikal halaman dipetakan ke aliran horizontal pita (`scrollX`)
 *    dengan penghalusan eksponensial supaya gerakan terasa halus.
 * 2. Fase gelombang dihitung dari koordinat X dunia tiap kartu
 *    (`phase = x * frequency`), meniru `wavePhase = worldX * uWaveFreq` pada
 *    shader referensi — kartu yang berbeda selalu berbeda ketinggian, jadi
 *    pita tampak mengalir, bukan bergerak serempak.
 * 3. Kecepatan scroll menjadi amplitudo: kartu terangkat/ditenggelamkan (Y),
 *    didorong ke kedalaman (Z), dimiringkan mengikuti arah alur (rotateZ dari
 *    turunan gelombang), diputar di kedalaman (rotateY), dan ditorsikan
 *    (rotateX). Berhenti = gelombang luruh kembali rata.
 * 4. KARTU MELENGKUNG: meski isinya iframe yang kaku, siluet tiap kartu
 *    dibentuk `clip-path` berupa kurva sisa gelombang setelah garis tangent
 *    dilepas — tepi atas & bawah kartu melengkung paralel, meniru kesan
 *    pita terbengkok pada referensi WebGL. Garis tepinya digambar ulang tiap
 *    frame lewat path SVG `.reel-edge` (clip dan garis memakai path yang sama
 *    persis sehingga presisi).
 * 5. Posisi kartu dibungkus memakai *double-modulo* sehingga pita tampak
 *    tak terbatas hanya dengan 3 kartu (tanpa menggandakan iframe).
 *
 * Semua transform ditulis langsung ke `style` (tanpa `setState` per frame),
 * posisi awal sudah ditulis SEBELUM paint pertama (useLayoutEffect) supaya
 * kartu tidak pernah terlihat menumpuk, dan loop DIHENTIKAN begitu pita diam
 * atau stage tidak terlihat (hemat CPU/BPU saat pengunjung di footer).
 */

interface ReelMotionOptions {
  stageRef: RefObject<HTMLDivElement | null>;
  itemRefs: RefObject<(HTMLElement | null)[]>;
  counterRef: RefObject<HTMLSpanElement | null>;
  count: number;
  onFirstVisible?: () => void;
}

/**
 * `useLayoutEffect` hanya ada di client — di server diganti `useEffect`
 * supaya tidak memunculkan warning "useLayoutEffect does nothing on the
 * server" saat prerender.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Pita bergerak 1 px per 1 px scroll halaman. */
const SCROLL_RATIO = 1;
/** Penghalusan posisi pita (ms) — makin kecil makin reaktif. */
const SCROLL_TAU = 70;
/** Serang & lepas amplitudo gelombang (ms) — lepas lebih lambat agar mantul. */
const AMP_ATTACK_TAU = 90;
const AMP_RELEASE_TAU = 240;
/**
 * Jumlah gelombang per lebar viewport. 0,55 → panjang gelombang ~1,8× viewport,
 * jadi satu kartu hanya menempuh sebagian kecil siklus: terlihat melengkung
 * tanpa membuat kartu "terpotong" terlalu dalam oleh kurvanya sendiri.
 */
const WAVES = 0.55;
/** Peredaman kecepatan scroll → amplitudo tambahan gelombang. */
const VEL_GAIN = 1.5;
/** Rasio kedalaman (Z) terhadap ketinggian (Y) — pita membungkuk ke belakang. */
const DEPTH_RATIO = 1.1;
/** Diam sekian ms → loop dihentikan (dilanjutkan otomatis oleh event scroll). */
const IDLE_STOP_MS = 320;
/** Kemiringan maksimum (derajat) kartu mengikuti alur gelombang. */
const MAX_TILT_DEG = 10;
/** Titik sampel kurva kelengkungan per kartu (halus tapi murah). */
const CURVE_SAMPLES = 16;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function useReelMotion({
  stageRef,
  itemRefs,
  counterRef,
  count,
  onFirstVisible,
}: ReelMotionOptions): void {
  // Stabilkan callback agar perubahan referensi tidak me-restart loop.
  const visibleCallback = useRef(onFirstVisible);
  useEffect(() => {
    visibleCallback.current = onFirstVisible;
  }, [onFirstVisible]);

  useIsomorphicLayoutEffect(() => {
    const stage = stageRef.current;
    const items = itemRefs.current.filter(Boolean) as HTMLElement[];
    if (!stage || items.length !== count) return;

    const cards = items.map((item) => item.querySelector<HTMLElement>('.reel-card'));
    const frames = items.map((item) => item.querySelector<HTMLElement>('.reel-frame'));
    const edges = items.map((item) =>
      item.querySelector<SVGPathElement>('.reel-edge path')
    );
    if (cards.some((card) => !card) || frames.some((frame) => !frame)) return;

    const counter = counterRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Salinan non-null: `measure()` adalah closure yang dipanggil ulang, jadi
    // narrowing TypeScript tidak berlaku di dalamnya.
    const stageEl = stage;

    // ── Metrik layout (diukur ulang saat resize) ──────────────────────────
    let viewportWidth = window.innerWidth;
    let stride = 0;
    let total = 0;
    let half = 0;
    let cardWidth = 0;
    let frameWidth = 0;
    let frameHeight = 0;
    let frequency = 0;
    let gap = 14;
    let ampBase = 6;
    let ampMax = 36;
    let pad = 8;

    function measure(): void {
      viewportWidth = window.innerWidth;
      cardWidth = items[0].offsetWidth || 1;
      frameWidth = frames[0]?.offsetWidth || cardWidth;
      frameHeight = frames[0]?.offsetHeight || Math.round((cardWidth * 900) / 1440);
      // Gap dijaga sama dengan CSS `--reel-gap` supaya posisi pra-JS & pasca-JS
      // tidak pernah meleset.
      const gapValue = parseFloat(getComputedStyle(items[0]).getPropertyValue('--reel-gap'));
      gap = Number.isFinite(gapValue) && gapValue > 0 ? gapValue : 14;
      // Syarat wrap tak terlihat: total >= lebar viewport + lebar kartu + gap.
      // Dengan kartu minimal ~setengah viewport, suku pertama (kartu + gap)
      // yang menang → jarak antar kartu selalu serapat `gap`.
      stride = Math.max(
        cardWidth + gap,
        Math.ceil((viewportWidth + cardWidth + gap) / count)
      );
      total = stride * count;
      half = total / 2;
      frequency = (Math.PI * 2 * WAVES) / Math.max(viewportWidth, 1);
      // Amplitudo dasar (gelombang tipis saat diam) + batas saat scroll kencang.
      ampBase = clamp(cardWidth * 0.012, 3, 8);
      ampMax = Math.max(clamp(cardWidth * 0.065, 22, 44), ampBase + 4);
      // Ruang cadangan tepi atas/bawah kartu untuk kurva kelengkungan.
      pad = clamp(cardWidth * 0.013, 5, 10);
      // Skala iframe = lebar kartu / 1440 (sumber kebenaran tunggal, lewat CSS).
      stageEl.style.setProperty('--reel-fit', (cardWidth / 1440).toFixed(5));
    }

    /**
     * Bangun path siluet kartu: tepi atas & bawah = kurva gelombang yang sama
     * (paralel), sudah "diratakan" dengan mengurangi garis tangent `theta` —
     * yang tersisa hanya kelengkungan, jadi cukup ruang `pad` di dalam kartu.
     * Path yang sama dipakai untuk `clip-path` isi kartu DAN garis tepi SVG.
     */
    function buildCurvePath(phi: number, amp: number, theta: number): string {
      const sinPhi = Math.sin(phi);
      const top: string[] = [];
      const bottom: string[] = [];
      for (let j = 0; j <= CURVE_SAMPLES; j++) {
        const px = (frameWidth * j) / CURVE_SAMPLES;
        const localX = px - frameWidth / 2;
        const curve =
          amp * (Math.sin(phi + localX * frequency) - sinPhi) - theta * localX;
        top.push(`${px.toFixed(1)},${clamp(pad + curve, 0, frameHeight).toFixed(1)}`);
        bottom.push(
          `${px.toFixed(1)},${clamp(frameHeight - pad + curve, 0, frameHeight).toFixed(1)}`
        );
      }
      bottom.reverse();
      return `M${top.join(' L')} L${bottom.join(' L')} Z`;
    }

    // ── Tulis transform untuk satu frame ──────────────────────────────────
    let lastCounterIndex = -1;

    function applyFrame(scrollX: number, velocityAmp: number): void {
      const amp = velocityAmp + ampBase;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < items.length; i++) {
        // Fase `i * stride` (bukan `(i - count/2) * stride`) supaya pada scroll 0
        // kartu #1 berada tepat di tengah viewport — komposisi pertama kali
        // selalu satu kartu utama + dua kartu mengintip di pinggir.
        const offset = i * stride - scrollX;
        // Double-modulo: hasil selalu berada di [-half, half) → wrap mulus
        // tanpa lompatan yang terlihat (syarat dipenuhi oleh `measure()`).
        const x = ((((offset + half) % total) + total) % total) - half;

        const phase = x * frequency;
        const sin = Math.sin(phase);
        const cos = Math.cos(phase);

        // Turunan gelombang = arah alur → kartu dimiringkan mengikuti alur,
        // dan kemiringan kedalaman (Z) sebagai rotateY.
        const slope = amp * frequency * cos;
        const slopeZ = -amp * DEPTH_RATIO * frequency * sin;
        const rotateZ = clamp((Math.atan(slope) * 180) / Math.PI, -MAX_TILT_DEG, MAX_TILT_DEG);
        const rotateY = clamp((Math.atan(slopeZ) * 180) / Math.PI, -MAX_TILT_DEG, MAX_TILT_DEG);
        // Torsion: sisi atas kartu menjauh, sisi bawah mendekat.
        const rotateX = clamp(sin * amp * 0.09, -MAX_TILT_DEG, MAX_TILT_DEG);

        items[i].style.transform =
          `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ` +
          `${(sin * amp).toFixed(2)}px, ${(cos * amp * DEPTH_RATIO).toFixed(2)}px)`;
        cards[i]!.style.transform =
          `rotateY(${rotateY.toFixed(2)}deg) rotateX(${rotateX.toFixed(2)}deg) ` +
          `rotateZ(${rotateZ.toFixed(2)}deg)`;

        // Siluet melengkung + garis tepi yang mengikuti kurva yang sama persis.
        const path = buildCurvePath(phase, amp, (rotateZ * Math.PI) / 180);
        frames[i]!.style.clipPath = `path("${path}")`;
        edges[i]?.setAttribute('d', path);

        const distance = Math.abs(x);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      if (counter && nearestIndex !== lastCounterIndex) {
        lastCounterIndex = nearestIndex;
        counter.textContent =
          `${String(nearestIndex + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
      }
    }

    /** Kembalikan kartu ke keadaan polos (dipakai saat reduced-motion aktif). */
    function clearMotionStyles(): void {
      for (const item of items) item.style.transform = '';
      for (const card of cards) if (card) card.style.transform = '';
      for (const frame of frames) if (frame) frame.style.clipPath = '';
      // Garis tepi kembali jadi persegi rapi mengikuti ukuran kartu.
      const x0 = 0.75;
      const y0 = 0.75;
      const x1 = Math.max(frameWidth - 0.75, x0 + 1).toFixed(1);
      const y1 = Math.max(frameHeight - 0.75, y0 + 1).toFixed(1);
      const rect = `M${x0},${y0} L${x1},${y0} L${x1},${y1} L${x0},${y1} Z`;
      for (const edge of edges) edge?.setAttribute('d', rect);
    }

    measure();

    // ── State animasi ─────────────────────────────────────────────────────
    let targetX = window.scrollY * SCROLL_RATIO;
    let scrollX = targetX; // posisi pita yang dihaluskan
    let velocity = 0; // px per 16.67 ms (dinormalkan antar refresh rate)
    let amplitude = 0;
    let active = false;
    let running = false;
    let seenOnce = false;
    let lastTime = 0;
    let idleSince = 0;
    let rafId = 0;

    // Posisi awal ditulis SEBELUM paint pertama supaya kartu SSR tidak pernah
    // terlihat menumpuk di titik yang sama (dan counter langsung benar).
    if (reducedMotion.matches) clearMotionStyles();
    else applyFrame(scrollX, 0);

    function frame(now: number): void {
      rafId = requestAnimationFrame(frame);

      const dt = clamp(now - lastTime, 1, 50);
      lastTime = now;

      // Baca scroll dulu, baru tulis transform (hindari layout thrash).
      targetX = window.scrollY * SCROLL_RATIO;
      const previous = scrollX;
      scrollX += (targetX - scrollX) * (1 - Math.exp(-dt / SCROLL_TAU));

      const instant = ((scrollX - previous) / dt) * 16.667;
      velocity += (instant - velocity) * (1 - Math.exp(-dt / 60));

      const ampTarget = ampBase + Math.min(Math.abs(velocity) * VEL_GAIN, ampMax - ampBase);
      const tau = ampTarget > amplitude + ampBase ? AMP_ATTACK_TAU : AMP_RELEASE_TAU;
      amplitude += (ampTarget - ampBase - amplitude) * (1 - Math.exp(-dt / tau));

      applyFrame(scrollX, amplitude);

      // Posisi nyaris tepat + gelombang sudah luruh → aman menghentikan loop.
      const settled =
        Math.abs(targetX - scrollX) < 0.05 && amplitude < 0.15 && Math.abs(velocity) < 0.05;
      if (settled) {
        if (now - idleSince > IDLE_STOP_MS) stop();
      } else {
        idleSince = now;
      }
    }

    function start(): void {
      if (running || !active || reducedMotion.matches) return;
      if (document.visibilityState === 'hidden') return;
      running = true;
      lastTime = performance.now();
      idleSince = lastTime;
      rafId = requestAnimationFrame(frame);
    }

    function stop(): void {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
    }

    // ── Pengamat visibilitas stage: mount demo + aktifkan loop ────────────
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        active = visible;
        if (visible) {
          if (!seenOnce) {
            seenOnce = true;
            visibleCallback.current?.();
          }
          start();
        } else {
          stop();
        }
      },
      { threshold: 0 }
    );
    observer.observe(stage);

    const handleScroll = (): void => {
      if (active) start();
    };
    const handleResize = (): void => {
      measure();
      if (reducedMotion.matches) clearMotionStyles();
      else applyFrame(scrollX, amplitude);
      if (active) start();
    };
    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') stop();
      else if (active) start();
    };
    const handleMotionPref = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        stop();
        clearMotionStyles(); // serahkan tata letak ke aturan CSS reduced-motion
      } else {
        measure();
        applyFrame(scrollX, 0);
        if (active) start();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    reducedMotion.addEventListener('change', handleMotionPref);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      reducedMotion.removeEventListener('change', handleMotionPref);
    };
  }, [stageRef, itemRefs, counterRef, count]);
}

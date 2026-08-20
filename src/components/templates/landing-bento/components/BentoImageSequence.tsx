'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, MoveHorizontal, RotateCcw } from 'lucide-react';

interface BentoImageSequenceProps {
  title?: string;
  subtitle?: string;
  frameCount?: number;
  fps?: number;
  variant?: 'full' | 'minimal';
}

export function BentoImageSequence({
  title = 'Interactive 360° Product Showcase',
  subtitle = 'Teknologi Canvas Image Sequence: Geser kursor untuk memutar objek 360° secara real-time tanpa frame lag.',
  frameCount = 36,
  fps = 24,
  variant = 'full',
}: BentoImageSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const startXRef = useRef(0);
  const frameOnStartRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  // Procedural 3D Canvas Graphic (Renders dynamic 360 rotatable Bento Device Card)
  const drawProceduralFrame = useCallback(
    (ctx: CanvasRenderingContext2D, frameIndex: number, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);

      // Clean Light background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#ffffff');
      bgGrad.addColorStop(1, '#f4f4f5');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle grid pattern
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 24;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Calculate 360 rotation angle
      const angle = (frameIndex / frameCount) * Math.PI * 2;
      const cx = w / 2;
      const cy = h / 2;
      const cardW = w * 0.52;
      const cardH = h * 0.58;

      ctx.save();
      ctx.translate(cx, cy);

      // Simulated 3D Y-axis perspective rotation
      const scaleX = Math.cos(angle);
      const skewY = Math.sin(angle) * 0.12;
      ctx.transform(scaleX, skewY, 0, 1, 0, 0);

      // Shadow & Card border
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = scaleX > 0 ? '#10b981' : '#0d9488';
      ctx.lineWidth = 2;

      // Window Frame Rect
      const rx = -cardW / 2;
      const ry = -cardH / 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, cardW, cardH, 16);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Card Header dots
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(rx + 18, ry + 18, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rx + 32, ry + 18, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(rx + 46, ry + 18, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Card Title Text
      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Interactive 360° Sequence', 0, ry + 22);

      // Inner Card Content Preview
      ctx.fillStyle = '#f4f4f5';
      ctx.beginPath();
      ctx.roundRect(rx + 16, ry + 40, cardW - 32, 40, 8);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Portfolio OS 3D Tile', rx + 26, ry + 64);

      // Decorative UI mock lines
      ctx.fillStyle = '#e4e4e7';
      ctx.fillRect(rx + 16, ry + 92, cardW * 0.65, 6);
      ctx.fillRect(rx + 16, ry + 104, cardW * 0.45, 6);
      ctx.fillRect(rx + 16, ry + 116, cardW * 0.8, 6);

      // Accent Badge
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(rx + 16, ry + cardH - 38, 100, 22, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`FRAME ${frameIndex + 1}/${frameCount}`, rx + 26, ry + cardH - 23);

      ctx.restore();
    },
    [frameCount]
  );

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawProceduralFrame(ctx, currentFrame, 600, 360);
  }, [currentFrame, drawProceduralFrame]);

  // AutoPlay Loop
  useEffect(() => {
    if (!autoPlay || isDragging) return;

    const interval = 1000 / fps;
    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= interval) {
        setCurrentFrame((prev) => (prev + 1) % frameCount);
        lastTimeRef.current = timestamp;
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [autoPlay, isDragging, fps, frameCount]);

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setAutoPlay(false);
    startXRef.current = e.clientX;
    frameOnStartRef.current = currentFrame;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startXRef.current;
    const frameShift = Math.floor(deltaX / 8);
    let newFrame = (frameOnStartRef.current + frameShift) % frameCount;
    if (newFrame < 0) newFrame += frameCount;
    setCurrentFrame(newFrame);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <section
      className={`rounded-3xl border border-zinc-200/90 bg-white shadow-xs hover:border-zinc-300 transition-all ${
        variant === 'minimal' ? 'p-5 sm:p-6' : 'p-6 sm:p-8'
      }`}
    >
      <div
        className={`flex items-center gap-6 ${
          variant === 'minimal' ? 'flex-col' : 'flex-col lg:flex-row'
        }`}
      >
        <div className="space-y-3 max-w-md">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--bento-accent)_30%,white)] bg-[color-mix(in_srgb,var(--bento-accent)_10%,white)] px-3 py-1 text-xs font-mono font-semibold text-[var(--bento-accent)]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive 360° Sequence</span>
          </div>

          <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight sm:text-3xl">
            {title}
          </h2>

          {variant === 'full' && subtitle && (
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
              {subtitle}
            </p>
          )}

          {variant === 'full' && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAutoPlay(!autoPlay)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-800 transition"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[var(--bento-accent)]" />
                <span>{autoPlay ? 'Pause Auto-Play' : 'Putar Otomatis'}</span>
              </button>

              <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                <MoveHorizontal className="h-3.5 w-3.5 text-[var(--bento-accent)]" />
                <span>Drag Kursor ↔</span>
              </div>
            </div>
          )}
        </div>

        {/* Canvas Player Box */}
        <div className={`relative flex-1 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-xs ${variant === 'minimal' ? 'p-1.5' : 'p-2'}`}>
          <canvas
            ref={canvasRef}
            width={600}
            height={360}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-auto max-w-full rounded-xl touch-none cursor-grab active:cursor-grabbing"
          />
        </div>
      </div>
    </section>
  );
}

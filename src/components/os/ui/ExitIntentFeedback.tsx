'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, Send } from 'lucide-react';
import type { LottieRefCurrentProps } from 'lottie-react';
import { useExitIntent } from '@/hooks/useExitIntent';
import { useToast } from '@/contexts/ToastContext';
import { POPULAR_EMOJIS } from '@/components/chat/data/EmojiData';
import { Z_LAYERS } from '../utils/zIndexLayers';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

/**
 * Exit-Intent Feedback Modal
 *
 * Muncul sekali per session saat kursor visitor bergerak keluar viewport ke atas
 * (sinyal "mau nutup tab"). Ngajakin visitor ninggalin rating + pesan singkat.
 *
 * Throttling (mode sopan):
 * - Session flag `portfolio_os_exit_feedback_shown` → modal tidak muncul 2x di session
 *   yang sama (satu tab, sampai ditutup).
 * - Session flag `portfolio_os_exit_feedback_sent`  → setelah sukses submit, modal
 *   langsung disable sampai user buka tab baru.
 * - Engagement minimum 15 detik → modal nggak nongol pas visitor baru nyampe.
 *
 * Layer pertahanan lapis kedua tetap di server: rate-limit per IP + dedup per
 * clientId (1 jam window).
 */

const SESSION_SHOWN_KEY = 'portfolio_os_exit_feedback_shown';
const SESSION_SENT_KEY = 'portfolio_os_exit_feedback_sent';
// localStorage — stable client identifier supaya server bisa dedup lintas
// session (berbeda dari sessionStorage flag yang reset tiap tab baru).
const CLIENT_ID_KEY = 'portfolio_os_client_id';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

function getEmojiByName(name: string, fallback: string) {
  return POPULAR_EMOJIS.find((emoji) => emoji.name === name)?.char ?? fallback;
}

const FEEDBACK_EMOJIS = {
  heart: getEmojiByName('heart', '\u2764\uFE0F'),
  success: getEmojiByName('smiling heart', '\u{1F970}'),
} as const;

function FeedbackEyeIcon() {
  const [animationData, setAnimationData] = useState<unknown>(null);
  const prefersReducedMotion = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

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
      <div className="flex items-center justify-center" style={{ width: 280, height: 120 }}>
        <span className="text-[88px] leading-none" aria-hidden="true">
          {FEEDBACK_EMOJIS.heart}
        </span>
      </div>
    );
  }

  return (
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
  );
}

/**
 * Baca session flags sekali di client. Server selalu return true (enabled)
 * supaya hydration konsisten; hook `useExitIntent` no-op di server jadi
 * perbedaan nilai awal aman.
 */
function readEnabledFromSession(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const shown = sessionStorage.getItem(SESSION_SHOWN_KEY) === '1';
    const sent = sessionStorage.getItem(SESSION_SENT_KEY) === '1';
    return !shown && !sent;
  } catch {
    return true;
  }
}

/**
 * Generate or load stable clientId dari localStorage. Dipakai server untuk
 * dedup per-client tanpa perlu auth. Bukan fingerprint — cukup random UUID.
 */
function getOrCreateClientId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    // crypto.randomUUID tersedia di semua browser target (Chrome 92+, FF 95+, Safari 15.4+)
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

function detectDevice(): 'desktop' | 'tablet' | 'mobile' | null {
  if (typeof window === 'undefined') return null;
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export default function ExitIntentFeedback() {
  const prefersReducedMotion = useReducedMotion();
  const toast = useToast();

  // Lazy init dari sessionStorage — ini client-only component (mounted via
  // next/dynamic with ssr:false) jadi aman akses sessionStorage langsung.
  const [enabled] = useState<boolean>(readEnabledFromSession);

  const triggered = useExitIntent({ enabled, minEngagementMs: 15_000 });

  const [isOpen, setIsOpen] = useState(false);
  const hasOpenedForTriggerRef = useRef(false);

  useEffect(() => {
    if (!triggered || hasOpenedForTriggerRef.current) return;
    hasOpenedForTriggerRef.current = true;
    setIsOpen(true);
    try {
      sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
    } catch {
      /* ignore */
    }
  }, [triggered]);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Harus kosong
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Timestamp modal dibuka — dipakai server untuk minimum-fill-time check.
  // Pakai ref (bukan state) supaya nggak trigger cascading render, dan di-set
  // di dalam useEffect supaya impure call Date.now() nggak run di render phase.
  const formOpenedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (isOpen) {
      formOpenedAtRef.current = Date.now();
    } else {
      formOpenedAtRef.current = null;
    }
  }, [isOpen]);

  // ESC untuk tutup
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    // Reset state kalau sukses (biar kalau dibuka lagi form kosong),
    // kalau idle biarin saja supaya draft-nya kejaga kalau user buka lagi.
    if (submitState === 'success') {
      setRating(0);
      setMessage('');
      setName('');
      setSubmitState('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitState === 'submitting') return;
    if (rating === 0) {
      toast.showWarning('Kasih love dulu ya', 2500);
      return;
    }

    setSubmitState('submitting');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          message: message.trim() || undefined,
          name: name.trim() || undefined,
          fromPath: typeof window !== 'undefined' ? window.location.pathname : undefined,
          clientId: getOrCreateClientId() ?? undefined,
          device: detectDevice() ?? undefined,
          formOpenedAt: formOpenedAtRef.current ?? undefined,
          source: 'exit-intent' as const,
          website_url: honeypot || undefined,
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          toast.showError('Kamu baru aja kirim feedback. Coba lagi nanti ya.', 4000);
        } else {
          toast.showError('Gagal kirim feedback. Coba lagi sebentar.', 4000);
        }
        setSubmitState('error');
        return;
      }

      try {
        sessionStorage.setItem(SESSION_SENT_KEY, '1');
      } catch {
        /* ignore */
      }

      setSubmitState('success');
      toast.showSuccess('Terima kasih atas feedbacknya! 🙏', 3500);
    } catch (err) {
      console.error('[ExitIntentFeedback] submit error', err);
      toast.showError('Gagal terhubung. Coba lagi nanti.', 4000);
      setSubmitState('error');
    }
  };

  // SSR-safe portal target — client-only via useSyncExternalStore mount guard.
  // Menghindari direct setState di useEffect (react-hooks/set-state-in-effect).
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const portalTarget = isClient ? document.body : null;

  if (!portalTarget) return null;

  const scaleIn = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.92, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, y: 10 },
      };

  const springTransition = prefersReducedMotion
    ? { duration: 0.18 }
    : { type: 'spring' as const, stiffness: 320, damping: 26 };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: Z_LAYERS.CRITICAL_MODAL }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-feedback-title"
            className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl"
            {...scaleIn}
            transition={springTransition}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
              aria-label="Tutup"
            >
              <X size={18} />
            </button>

            {submitState === 'success' ? (
              <SuccessView onClose={handleClose} />
            ) : (
              <form onSubmit={handleSubmit} className="px-6 pb-5 pt-6">
                {/* Header */}
                <div className="mb-4 text-center">
                  <div className="mb-1 inline-flex items-center justify-center">
                    <FeedbackEyeIcon />
                  </div>
                  <h2 id="exit-feedback-title" className="text-lg font-semibold text-gray-900">
                    Eh, sebelum pergi...
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">
                    <span className="block">Boleh minta kesan kamu tentang portfolio ini?</span>
                    <span className="block">Satu menit aja.</span>
                  </p>
                </div>

                {/* Rating */}
                <div className="mb-4 flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = n <= (hoverRating || rating);
                    return (
                      <motion.button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHoverRating(n)}
                        onMouseLeave={() => setHoverRating(0)}
                        aria-label={`${n} love`}
                        className="origin-center p-1"
                        initial={false}
                        animate={{
                          scale: active ? 1.15 : 0.95,
                          opacity: active ? 1 : 0.3,
                          filter: active
                            ? 'grayscale(0%) drop-shadow(0 4px 8px rgba(244,63,94,0.32))'
                            : 'grayscale(100%) drop-shadow(0 0px 0px rgba(0,0,0,0))',
                        }}
                        whileHover={{
                          scale: active ? 1.25 : 1.05,
                          opacity: active ? 1 : 0.7,
                        }}
                        whileTap={{ scale: 0.85 }}
                        transition={springTransition}
                      >
                        <span className="block text-[30px] leading-none" aria-hidden="true">
                          {FEEDBACK_EMOJIS.heart}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Nama (opsional) */}
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Nama <span className="text-gray-400">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  placeholder="Anonim juga nggak papa"
                  className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-gray-900 focus:ring-0"
                  disabled={submitState === 'submitting'}
                />

                {/* Pesan (opsional) */}
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Saran / kritik <span className="text-gray-400">(opsional)</span>
                </label>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Apa yang kamu suka atau belum pas..."
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-gray-900 focus:ring-0"
                  disabled={submitState === 'submitting'}
                />
                <div className="mt-0.5 text-right text-[10px] text-gray-400">
                  {message.length}/500
                </div>

                {/* Honeypot (hidden) */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  aria-hidden="true"
                  className="absolute m-[-1px] h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
                  style={{ clip: 'rect(0, 0, 0, 0)' }}
                />

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    disabled={submitState === 'submitting'}
                  >
                    Nggak dulu
                  </button>
                  <button
                    type="submit"
                    disabled={submitState === 'submitting' || rating === 0}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {submitState === 'submitting' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Kirim...
                      </span>
                    ) : (
                      <>
                        <Send size={14} />
                        Kirim feedback
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalTarget
  );
}

function SuccessView({ onClose }: { onClose: () => void }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="px-6 pb-6 pt-8 text-center">
      <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-green-100">
        <motion.span
          className="inline-block origin-center text-[26px] leading-none"
          aria-hidden="true"
          animate={
            prefersReducedMotion
              ? {}
              : {
                  rotate: [0, -15, 15, -15, 15, 0],
                  scale: [0.8, 1.2, 1.2, 1.2, 1.2, 1],
                }
          }
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {FEEDBACK_EMOJIS.success}
        </motion.span>
      </div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Makasih banyak!</h2>
      <p className="mb-5 text-sm leading-relaxed text-gray-500">
        Feedback kamu udah sampai. Sampai jumpa lagi.
      </p>
      <button
        onClick={onClose}
        className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        Tutup
      </button>
    </div>
  );
}

/**
 * SoundManager Utility
 * Handles lazy loading and playback of retro sound effects for the OS simulation.
 * Standardized on WAV for maximum compatibility with generated assets.
 */

import { getAssetPath } from '@/lib/constants';

type SoundType =
  | 'startup'
  | 'click'
  | 'window-open'
  | 'window-close'
  | 'error'
  | 'notification'
  | 'drag'
  | 'typing'
  | 'sent'
  | 'unlock';

class SoundManager {
  private static instance: SoundManager;
  private static readonly SILENT_AUDIO_DATA_URI =
    'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

  private sounds: Map<SoundType, HTMLAudioElement> = new Map();
  private isMuted: boolean = false;
  private volume: number = 0.5;
  private debugMode = process.env.NODE_ENV === 'development';

  private soundPaths: Record<SoundType, string> = {
    startup: getAssetPath('/sounds/startup.mp3'),
    click: getAssetPath('/sounds/click.mp3'),
    'window-open': getAssetPath('/sounds/window-open.mp3'),
    'window-close': getAssetPath('/sounds/window-close.mp3'),
    error: getAssetPath('/sounds/error.mp3'),
    notification: getAssetPath('/sounds/notification.mp3'),
    drag: getAssetPath('/sounds/drag.mp3'),
    typing: getAssetPath('/sounds/typing.wav'),
    sent: getAssetPath('/sounds/notification.mp3'),
    unlock: getAssetPath('/sounds/click.mp3'), // Using click sound for unlock "ceklek" effect
  };

  private soundVolumes: Partial<Record<SoundType, number>> = {};
  private isUnlocked: boolean = false;
  private pendingSounds: Set<SoundType> = new Set();
  private hasPlayedStartup: boolean = false;
  private suppressedSounds: Set<SoundType> = new Set();
  private suppressionTimers: Map<SoundType, ReturnType<typeof setTimeout>> = new Map();
  private inFlight: Set<SoundType> = new Set();

  // FIXED (BUG-002): Track active audio elements for cleanup
  private activeAudioElements: Set<HTMLAudioElement> = new Set();
  private readonly maxActiveAudioElements: number = 20;
  // Track event listener references per audio element for proper cleanup
  private audioListeners: WeakMap<HTMLAudioElement, () => void> = new WeakMap();

  /** Conditional debug logging — silent in production. */
  private log(message: string, ...args: unknown[]): void {
    if (this.debugMode) console.log(`[SoundManager] ${message}`, ...args);
  }

  /**
   * Temporarily suppress a sound type for the given duration (ms).
   */
  public suppressSound(type: SoundType, durationMs: number) {
    const existing = this.suppressionTimers.get(type);
    if (existing) clearTimeout(existing);
    this.suppressedSounds.add(type);
    this.suppressionTimers.set(
      type,
      setTimeout(() => {
        this.suppressedSounds.delete(type);
        this.suppressionTimers.delete(type);
        this.log(`Suppression lifted for "${type}".`);
      }, durationMs)
    );
  }

  private constructor() {
    this.log('v1.5 (Autoplay-Ready) initialized');
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as unknown as { __soundManager: SoundManager }).__soundManager = this;
    }
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Unlock the audio context on user interaction WITHOUT playing any sounds.
   * Use this for the "Power On" button click.
   */
  public unlock() {
    if (this.isUnlocked) return;
    this.log('Unlocking audio context silently...');
    this.isUnlocked = true;
    // Play a zero-volume buffer to secure the interaction context
    try {
      const silentAudio = new Audio(SoundManager.SILENT_AUDIO_DATA_URI);
      silentAudio.volume = 0;
      this.trackAudioElement(silentAudio);
      silentAudio.play().catch(() => {});
    } catch {
      // Ignore
    }
  }

  /**
   * Initialize/Unlock the sound system on first user interaction AND flush pending sounds.
   * This is called by interaction listeners when sounds are already queued.
   */
  public init() {
    if (this.isUnlocked && this.pendingSounds.size === 0) return;

    this.log(`Interaction detected. Unlocking (pending: ${this.pendingSounds.size})...`);

    // 1. Unlock audio context (idempotent — skips if already unlocked)
    this.unlock();

    // 2. Flush pending sounds from within the interaction handler's call stack
    // Doing it here is much more reliable than inside a .then()
    try {
      if (this.pendingSounds.size > 0) {
        this.log(`Triggering ${this.pendingSounds.size} pending sounds from interaction stack.`);
        const toPlay = Array.from(this.pendingSounds);
        this.pendingSounds.clear(); // Clear BEFORE playing to avoid re-triggering issues
        toPlay.forEach((type) => this.play(type));
      }
    } catch (e) {
      console.error('[SoundManager] Unlock attempt failed:', e);
    }
  }

  /**
   * Load dynamic configuration (overriding defaults)
   */
  public loadConfig(config: Record<string, { path: string; volume: number }>) {
    if (!config) return;

    console.log('[SoundManager] loadConfig called with config:', JSON.stringify(config, null, 2));
    Object.entries(config).forEach(([key, setting]) => {
      const typeKey = key as SoundType;
      if (this.soundPaths[typeKey] !== undefined) {
        const oldPath = this.soundPaths[typeKey];

        // UX Fix: Localization Remote URL -> Local bundled static path
        let path = setting.path;
        if (
          path.includes('/public/sounds/') ||
          path.includes('/r2/assets/sounds/') ||
          (path.startsWith('http') && path.includes('/sounds/'))
        ) {
          const rawFilename = path.split('/').pop()?.split('?')[0];
          const version = path.split('?v=')[1] || '1.3';
          if (rawFilename) {
            const filename = rawFilename === 'sent.mp3' ? 'notification.mp3' : rawFilename;
            path = `/sounds/${filename}?v=${version}`;
            console.log(`[SoundManager] Localized path for ${typeKey}: ${path}`);
          }
        }

        this.soundPaths[typeKey] = path;

        if (oldPath !== path) {
          console.log(`[SoundManager] Updating path for ${typeKey}: ${oldPath} -> ${path}`);
          const cachedAudio = this.sounds.get(typeKey);
          if (cachedAudio) {
            cachedAudio.pause();
            cachedAudio.src = '';
            try {
              cachedAudio.load();
            } catch {
              // Ignore cache cleanup errors.
            }
          }
          this.sounds.delete(typeKey);
        }

        this.soundVolumes[typeKey] = setting.volume;
      }
    });
  }

  /**
   * Preload a sound without unlocking or playing it. This keeps large startup
   * assets ready so the click-triggered boot sound starts with the visual zoom.
   */
  public preload(type: SoundType) {
    if (typeof window === 'undefined' || this.sounds.has(type)) return;

    const path = this.soundPaths[type];
    if (!path) return;

    try {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.sounds.set(type, audio);
      audio.load();
      this.log(`Preloaded "${type}" from ${path}`);
    } catch (e) {
      console.warn(`[SoundManager] Failed to preload "${type}":`, e);
    }
  }

  /**
   * Play a sound by type
   *
   * FIXED (BUG-002): Track dan cleanup audio elements untuk mencegah memory leak.
   * Audio elements di-track dan di-remove setelah selesai diputar.
   */
  public play(type: SoundType, customVolume?: number) {
    console.log(
      `[SoundManager] play called for "${type}", path is: "${this.soundPaths[type]}", isUnlocked: ${this.isUnlocked}`
    );
    if (this.isMuted) return;

    // Check if this sound is temporarily suppressed
    if (this.suppressedSounds.has(type)) {
      this.log(`"${type}" is suppressed. Skipping.`);
      return;
    }

    // Network optimization: kalau audio context belum di-unlock (user belum
    // interaksi sama sekali), JANGAN buat `new Audio(path)` karena itu
    // langsung memicu HTTP fetch untuk file audio walaupun .play() akan
    // di-block oleh browser autoplay policy. Cukup queue type-nya — saat
    // user interaksi, init() akan flush dan instansiasi Audio yang benar.
    //
    // Penting untuk komponen yang play sound saat boot (mis. error sound
    // di state error startup) sebelum interaksi pertama → tanpa gate ini,
    // browser fetch ~35KB audio sia-sia di first paint walaupun audio
    // belum bisa diputar.
    if (!this.isUnlocked) {
      this.pendingSounds.add(type);
      this.log(`Audio context locked. Queued "${type}" without fetching.`);
      return;
    }

    // Protection for startup sound: only play once per session
    if (type === 'startup') {
      if (this.hasPlayedStartup) {
        this.log('Startup sound already played. Skipping.');
        return;
      }
      // We set it true in the success handler below to allow retries if blocked
    }

    try {
      let audio = this.sounds.get(type);

      if (!audio) {
        const path = this.soundPaths[type];
        if (!path) {
          console.warn(`[SoundManager] No path defined for sound type: ${type}`);
          return;
        }
        this.log(`Creating new Audio for ${type}: ${path}`);
        audio = new Audio(path);
        this.sounds.set(type, audio);
      }

      // Priority: customVolume > Config Volume > Global Default Volume
      const configVolume = this.soundVolumes[type];
      const targetVolume = customVolume ?? configVolume ?? this.volume;

      this.log(`Playing "${type}" at volume ${targetVolume}`);

      // For very large sounds (like startup), avoid cloning on the first play
      // to ensure metadata is handled correctly.
      let playTarget: HTMLAudioElement;
      const isIdle = audio.paused && audio.currentTime === 0 && !this.inFlight.has(type);
      if (isIdle) {
        this.inFlight.add(type);
        playTarget = audio;
      } else {
        playTarget = audio.cloneNode() as HTMLAudioElement;
      }

      // FIXED: Track audio element
      this.trackAudioElement(playTarget);

      playTarget.volume = targetVolume;
      const playPromise = playTarget.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.inFlight.delete(type);
            this.log(`Successfully started playing "${type}"`);
            if (type === 'startup') {
              this.hasPlayedStartup = true;
            }
          })
          .catch((err) => {
            this.inFlight.delete(type);
            if (err.name === 'NotAllowedError') {
              this.pendingSounds.add(type);
              this.log(`Autoplay blocked for "${type}". Queued for interaction.`);
              // FIXED: Remove from tracking if playback failed
              this.untrackAudioElement(playTarget);
              return;
            }
            console.warn(`[SoundManager] Playback failed for "${type}":`, err.message);
            // FIXED: Remove from tracking if playback failed
            this.untrackAudioElement(playTarget);
          });
      }
    } catch (e) {
      console.error(`[SoundManager] Critical error playing "${type}":`, e);
    }
  }

  /**
   * FIXED (BUG-002): Track audio element and setup cleanup handler.
   */
  private trackAudioElement(audio: HTMLAudioElement): void {
    // Evict oldest element when at capacity
    if (this.activeAudioElements.size >= this.maxActiveAudioElements) {
      const oldest = this.activeAudioElements.values().next().value;
      if (oldest && oldest.paused) {
        this.untrackAudioElement(oldest);
      }
    }

    this.activeAudioElements.add(audio);

    const onDone = () => this.untrackAudioElement(audio);
    this.audioListeners.set(audio, onDone);
    audio.addEventListener('ended', onDone, { once: true });
    audio.addEventListener('error', onDone, { once: true });
  }

  /**
   * FIXED (BUG-002): Remove audio element from tracking and cleanup.
   * FIXED (BUG-003): Only destroy src for CLONED elements (not cached originals
   * in this.sounds) — destroying cached src causes "no supported sources" errors.
   */
  private untrackAudioElement(audio: HTMLAudioElement): void {
    if (!this.activeAudioElements.has(audio)) return;

    // Remove event listeners to prevent memory leak
    const onDone = this.audioListeners.get(audio);
    if (onDone) {
      audio.removeEventListener('ended', onDone);
      audio.removeEventListener('error', onDone);
      this.audioListeners.delete(audio);
    }

    audio.pause();

    const isCachedOriginal = this.isCachedAudio(audio);

    if (!isCachedOriginal) {
      audio.src = '';
      audio.load();
    } else {
      audio.currentTime = 0;
    }

    this.activeAudioElements.delete(audio);
  }

  /** Check if an audio element is one of the cached originals in this.sounds. */
  private isCachedAudio(audio: HTMLAudioElement): boolean {
    for (const cached of this.sounds.values()) {
      if (cached === audio) return true;
    }
    return false;
  }

  /**
   * FIXED (BUG-002): Cleanup semua active audio elements
   */
  public cleanupAllAudio(): void {
    this.log(`Cleaning up ${this.activeAudioElements.size} active audio elements`);
    this.activeAudioElements.forEach((audio) => {
      const onDone = this.audioListeners.get(audio);
      if (onDone) {
        audio.removeEventListener('ended', onDone);
        audio.removeEventListener('error', onDone);
      }
      audio.pause();
      audio.src = '';
      try {
        audio.load();
      } catch {
        // Ignore cleanup errors
      }
    });
    this.activeAudioElements.clear();
    this.audioListeners = new WeakMap();
    this.sounds.clear();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((sound) => {
      sound.volume = this.volume;
    });
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Clear the cached Audio element for a specific sound type.
   * Call this after uploading a new file to force the next play() to load fresh from disk.
   */
  public clearCache(type: SoundType) {
    if (this.sounds.has(type)) {
      const audio = this.sounds.get(type);
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      this.sounds.delete(type);
      this.log(`Cache cleared for "${type}".`);
    }
    // Reset startup protection so it can play again on next Power On
    if (type === 'startup') {
      this.hasPlayedStartup = false;
    }
  }
}

export const soundManager = SoundManager.getInstance();

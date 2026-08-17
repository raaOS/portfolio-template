'use client';
import { useEffect } from 'react';

const SW_CLEANUP_FLAG = 'portfolio_os_sw_cleaned';

/**
 * Service Worker Cleanup
 *
 * Memastikan tidak ada service worker lama yang aktif (legacy build pernah
 * register one). Sekali jalan dengan sukses, set flag di localStorage supaya
 * mounting berikutnya tidak kicked off kerjaan duplikat di main thread.
 *
 * Why localStorage instead of just the unregister no-op behavior:
 *   - `getRegistrations()` selalu kicks off async work + microtask scheduling.
 *   - `caches.keys()` panggilan ke storage layer browser, walaupun hasilnya
 *     kosong itu bukan free.
 *   - Mayoritas visitor tidak pernah punya SW lama (build sekarang sudah
 *     return 410 Gone untuk /sw.js). Cek flag sekali, skip permanent.
 *
 * Flag aman di-clear by user via DevTools kalau memang perlu force-cleanup.
 */
export default function UnregisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (window.localStorage.getItem(SW_CLEANUP_FLAG) === 'true') {
        // Sudah pernah dibersihkan di tab/origin ini — skip seluruh path
        // async di bawah supaya tidak kicked off pekerjaan sia-sia.
        return;
      }
    } catch {
      // localStorage bisa throw di private mode atau quota issue.
      // Fallthrough — kerjakan cleanup tanpa flag persistensi.
    }

    let cleanupCount = 2; // serviceWorker + caches
    let completed = 0;
    const markComplete = () => {
      completed += 1;
      if (completed < cleanupCount) return;
      try {
        window.localStorage.setItem(SW_CLEANUP_FLAG, 'true');
      } catch {
        // Ignore — di run berikutnya cleanup akan jalan lagi, no-op kalau
        // sudah bersih. Aman.
      }
    };

    // Unregister any existing service workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations?.()
        .then((regs) => {
          regs.forEach((r) => {
            r.unregister().catch(() => {});
          });
        })
        .catch(() => {})
        .finally(markComplete);
    } else {
      cleanupCount -= 1;
    }

    // Clear caches potentially left by a previous SW
    if (typeof caches !== 'undefined' && caches?.keys) {
      caches
        .keys()
        .then((keys) => {
          keys.forEach((k) => {
            caches.delete(k).catch(() => {});
          });
        })
        .catch(() => {})
        .finally(markComplete);
    } else {
      cleanupCount -= 1;
    }

    // Edge case: kalau dua-duanya tidak available (super old browser),
    // tetap set flag supaya tidak coba lagi.
    if (cleanupCount === 0) {
      try {
        window.localStorage.setItem(SW_CLEANUP_FLAG, 'true');
      } catch {
        // Ignore
      }
    }
  }, []);

  return null;
}

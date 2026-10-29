import { useState, useEffect, useRef, startTransition } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useSWR from 'swr';
import { buildWhatsAppLink } from '@/utils/whatsappLink';

/**
 * Chat Sync Hook — Real-time messaging untuk visitor ↔ admin.
 *
 * Mengelola state chat (messages, typing indicator, sync error) dengan
 * polling SWR yang dioptimasi untuk quota Cloudflare/D1:
 * - 8 detik saat tab aktif, 60 detik saat background (~62% penghematan).
 * - Deduplikasi pesan server-side dengan temp message client-side.
 * - Notifikasi suara saat pesan admin baru diterima (hanya di tab visible).
 *
 * Mode WhatsApp (v1.3.68): bila `whatsappNumber` terisi & valid, tombol kirim
 * meneruskan pesan ke `wa.me` milik admin dan polling `/api/chat/sync`
 * dimatikan sama sekali — nol request jaringan, nol tulis D1.
 *
 * Mode Demo (v1.3.70): di situs milik owner (demo penjualan template) yang
 * sengaja tidak diisi nomor WA pribadi, kirim memicu balasan SIMULASI lokal
 * (indikator mengetik → notice "ini demo" + penjelasan) — tanpa wa.me,
 * tanpa jaringan, tanpa tulis D1. Di build klien param ini selalu null.
 *
 * @module useChatSync
 */

interface ChatMessage {
  id: string;
  text: string;
  sender: 'visitor' | 'admin';
  timestamp: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.text()) || 'Network error');
  return res.json();
};

/**
 * Hook untuk sinkronisasi chat visitor ↔ admin secara real-time.
 *
 * @param initialGreeting - Pesan sapaan awal dari admin (opsional)
 * @param whatsappNumber - Nomor WhatsApp admin dari data contact. Bila valid,
 *   hook masuk mode WhatsApp: tombol kirim membuka `wa.me` dengan pesan
 *   prefilled dan polling D1 dimatikan (tanpa jaringan). Bila kosong/invalid,
 *   perilaku lama dipakai (simpan D1 + polling).
 * @param demoReply - Hanya di situs demo milik owner (NEXT_PUBLIC_OWNER_MODE)
 *   TANPA nomor WA: kalimat notice + simulasi balasan admin dari kamus.
 *   Keberadaan param ini = mode demo aktif (kirim → balasan simulasi lokal).
 * @returns Object berisi messages, sendMessage, typing indicator, dan sync error
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, isSending, isAdminTyping } = useChatSync('Halo!', '081234567890');
 * ```
 */
export function useChatSync(
  initialGreeting?: string,
  whatsappNumber?: string | null,
  demoReply?: { notice: string; reply: string } | null
) {
  const [visitorId, setVisitorId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // Initial Visitor ID
  useEffect(() => {
    try {
      const storedId = localStorage.getItem('portfolio_os_visitor_id');
      startTransition(() => {
        if (storedId) {
          setVisitorId(storedId);
        } else {
          const newId = uuidv4();
          localStorage.setItem('portfolio_os_visitor_id', newId);
          setVisitorId(newId);
        }
      });
    } catch {
      startTransition(() => {
        setVisitorId(uuidv4());
      });
    }
  }, []);

  // Track page visibility to optimize polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Greeting
  useEffect(() => {
    if (visitorId && messages.length === 0 && initialGreeting) {
      startTransition(() => {
        setMessages([
          {
            id: 'greeting',
            text: initialGreeting,
            sender: 'admin',
            timestamp: Date.now(),
          },
        ]);
      });
    }
  }, [visitorId, initialGreeting, messages.length]);

  const [syncError, setSyncError] = useState(false);

  /** Mode jembatan WhatsApp: nomor valid → percakapan diteruskan ke app WA admin. */
  const isWhatsAppBridge = !!buildWhatsAppLink(whatsappNumber);

  /**
   * Mode Demo (v1.3.70): situs milik owner TANPA nomor WA — pengunjung berhak
   * merasakan fitur tanpa menembak WA pribadi owner, dan DEMO TIDAK MENULIS
   * D1 (jalur legacy "nyimpan diam-diam" mati di demo).
   */
  const isDemoChat = !!demoReply && !isWhatsAppBridge;

  // Timer simulasi demo — dibersihkan saat unmount agar tidak bocor state.
  const demoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      demoTimersRef.current.forEach(clearTimeout);
    },
    []
  );

  // Polling with Smart Interval — Cloudflare/D1 quota guard.
  //
  // Sebelumnya: 3s active / 30s background. Untuk 1 visitor yang buka chat
  // window 5 menit = 100 invocations dari satu visitor. Worst case (tab
  // dibiarkan open semalam) = 14,400 invocations dari satu user. Itu
  // gerogoti budget invocation 1M/bulan tanpa value real karena visitor
  // portfolio tidak ekspektasi sub-second message arrival.
  //
  // Sekarang: 8s active / 60s background. Latency reply dari admin
  // sekarang max 8 detik (acceptable untuk chat asynchronous portfolio),
  // tapi invocations turun ~62%. Untuk skala 250 visitor/bulan ini
  // bedanya signifikan dari "boros" jadi "hemat ratusan invocations".
  const { data: _syncData, error: swrError } = useSWR(
    visitorId && !isWhatsAppBridge && !isDemoChat ? `/api/chat/sync?visitorId=${visitorId}` : null,
    fetcher,
    {
      refreshInterval: isPageVisible ? 8000 : 60000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      onSuccess: (data) => {
        setSyncError(false);
        if (data?.success) {
          // Update typing status from server
          if (data.isAdminTyping !== undefined) {
            setIsAdminTyping(data.isAdminTyping);
          }

          if (data.messages?.length > 0) {
            setMessages((prev) => {
              const newMessages = [...prev];
              let hasNewAdminMessage = false;

              data.messages.forEach((serverMsg: ChatMessage) => {
                const existingTempIndex = newMessages.findIndex(
                  (m) =>
                    m.id.startsWith('temp-') &&
                    m.text === serverMsg.text &&
                    m.sender === serverMsg.sender
                );
                const hasConfirmed = newMessages.find((m) => m.id === serverMsg.id);

                if (!hasConfirmed) {
                  if (existingTempIndex >= 0) {
                    newMessages[existingTempIndex] = serverMsg;
                  } else {
                    newMessages.push(serverMsg);
                    if (serverMsg.sender === 'admin') hasNewAdminMessage = true;
                  }
                }
              });

              if (hasNewAdminMessage) {
                setIsAdminTyping(false);
              }

              // Deduplicate and Sort
              const uniqueMsgs: ChatMessage[] = [];
              const seenIds = new Set();
              newMessages
                .sort((a, b) => a.timestamp - b.timestamp)
                .forEach((m) => {
                  if (!seenIds.has(m.id)) {
                    seenIds.add(m.id);
                    uniqueMsgs.push(m);
                  }
                });
              return uniqueMsgs;
            });
          }
        }
      },
      onError: () => setSyncError(true),
    }
  );

  const sendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;
    if (!visitorId && !isDemoChat) return;

    const trimmed = text.trim();
    setIsSending(true);
    const tempId = `temp-${Date.now()}`;
    const newMessage: ChatMessage = {
      id: tempId,
      text: trimmed,
      sender: 'visitor',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMessage]);

    // Mode jembatan WhatsApp (v1.3.68): pesan TIDAK dikirim ke endpoint —
    // langsung dibuka di wa.me milik admin dengan isi pesan prefilled.
    // Balon pesan tetap tampil lokal (centang biru) karena memang sudah
    // "terkirim" ke aplikasi WhatsApp admin; nol request, nol tulis D1.
    if (isWhatsAppBridge) {
      const waLink = buildWhatsAppLink(whatsappNumber, trimmed);
      if (waLink) {
        window.open(waLink, '_blank', 'noopener,noreferrer');
        setIsSending(false);
        return;
      }
      // Nomor tidak valid walau flag banner aktif (jarang: race) → jatuh
      // ke jalur lama di bawah supaya pesan tetap disimpan, tidak hilang.
    }

    // Mode Demo (v1.3.70): indikator mengetik → notice "ini demo" +
    // penjelasan simulasi. Nol jaringan, nol tulis D1, tanpa nomor apa pun.
    if (isDemoChat && demoReply) {
      const t1 = setTimeout(() => {
        setIsAdminTyping(true);
        const t2 = setTimeout(() => {
          setIsAdminTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: 'demo-notice',
              text: demoReply.notice,
              sender: 'admin',
              timestamp: Date.now(),
            },
            {
              id: 'demo-reply',
              text: demoReply.reply,
              sender: 'admin',
              timestamp: Date.now() + 1,
            },
          ]);
        }, 1400);
        demoTimersRef.current.push(t2);
      }, 600);
      demoTimersRef.current.push(t1);
      setIsSending(false);
      return;
    }

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          message: trimmed,
          pageUrl: window.location.href,
        }),
      });
      const data = await res.json();

      if (data.success && data.message) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
      } else {
        // Server menolak (validasi/rate-limit) — tandai gagal, jangan biarkan
        // pesan temp nyangkut selamanya tanpa indikator.
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
      }
    } catch (error) {
      console.error('Send failed', error);
      // Network error — tandai pesan temp sebagai gagal agar user sadar.
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
    } finally {
      setIsSending(false);
    }
  };

  return {
    visitorId,
    messages,
    setMessages,
    sendMessage,
    isSending,
    isAdminTyping,
    setIsAdminTyping,
    isWhatsAppBridge,
    syncError: syncError || !!swrError,
  };
}

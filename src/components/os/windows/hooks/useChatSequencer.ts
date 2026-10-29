import { useState, useEffect, useRef, startTransition } from 'react';
import type { ContactProfile, ChatMessage } from '../../data/mockChats';

export function useChatSequencer(activeContact: ContactProfile | null, showList: boolean) {
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const sequencerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (showList || !activeContact) {
      startTransition(() => {
        setVisibleMessages([]);
        setIsRemoteTyping(false);
      });
      if (sequencerRef.current) clearTimeout(sequencerRef.current);
      return;
    }

    // Reset cancellation flag for new sequence
    isCancelledRef.current = false;

    // Reset visibility
    startTransition(() => {
      setVisibleMessages([]);
      setIsRemoteTyping(false);
    });
    if (sequencerRef.current) clearTimeout(sequencerRef.current);

    let currentIndex = 0;
    const fullConversation =
      (activeContact?.messages?.length ? activeContact.messages : null) ||
      (activeContact?.conversation?.length ? activeContact.conversation : null) ||
      [];

    // Handle empty conversation - show placeholder after brief delay
    if (fullConversation.length === 0) {
      sequencerRef.current = setTimeout(() => {
        if (isCancelledRef.current) return;
        setVisibleMessages([
          {
            id: Date.now(),
            text: 'Belum ada pesan. Mulai percakapan dengan mengirim pesan!',
            isMe: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'sent' as const,
            type: 'text',
          },
        ]);
      }, 500);
      return;
    }

    const nextStep = () => {
      if (isCancelledRef.current || currentIndex >= fullConversation.length) return;

      const msg = fullConversation[currentIndex];

      if (!msg.isMe) {
        setIsRemoteTyping(true);
        sequencerRef.current = setTimeout(() => {
          if (isCancelledRef.current) return;
          setIsRemoteTyping(false);
          setVisibleMessages((prev) => {
            // Avoid duplicates if component re-renders
            if (prev?.find?.((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          currentIndex++;
          sequencerRef.current = setTimeout(nextStep, 1500);
        }, 2000);
      } else {
        setVisibleMessages((prev) => {
          if (prev?.find?.((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        currentIndex++;
        const delay = msg.type === 'image' || msg.type === 'project' ? 2500 : 1000;
        sequencerRef.current = setTimeout(nextStep, delay);
      }
    };

    sequencerRef.current = setTimeout(nextStep, 800);

    return () => {
      isCancelledRef.current = true;
      if (sequencerRef.current) clearTimeout(sequencerRef.current);
    };
  }, [activeContact, showList]);

  const addMessage = (msg: ChatMessage) => {
    setVisibleMessages((prev) => [...prev, msg]);
  };

  return { visibleMessages, isRemoteTyping, addMessage, setVisibleMessages };
}

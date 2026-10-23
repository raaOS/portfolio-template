import React, { useState, useRef, useEffect } from 'react';
import { Plus, Send, Mic, Square, Loader2 } from 'lucide-react';
import EmojiPicker from '@/components/chat/EmojiPicker';
import { soundManager } from '@/components/os/utils/SoundManager';
import { useToast } from '@/contexts/ToastContext';
import { useDictionary } from '@/contexts/LanguageContext';

interface FullPageChatFooterProps {
  onSend: (text: string) => void;
  isSending: boolean;
  /** Mode jembatan WhatsApp: tombol mikrofon & attachment disembunyikan (tidak berfungsi). */
  whatsappMode?: boolean;
}

export default function FullPageChatFooter({
  onSend,
  isSending,
  whatsappMode = false,
}: FullPageChatFooterProps) {
  const t = useDictionary();
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { showError } = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        await handleTranscribeAndSend(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      showError('Gagal mengakses mikrofon. Pastikan ada izin mikrofon.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleTranscribeAndSend = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob);

      const res = await fetch('/api/chat/voice', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim()) {
          onSend(data.text.trim());
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Transcription failed:', errData.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error sending voice note:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSend = () => {
    if (inputValue.trim() && !isSending && !isTranscribing) {
      onSend(inputValue.trim());
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="pb-safe z-10 flex shrink-0 items-center gap-3 border-t border-[#d1d7db] bg-[#f0f2f5] px-3 py-2.5 dark:border-white/5 dark:bg-[#202c33]">
      {!isRecording && (
        <div className="flex items-center gap-3 text-[#54656f] dark:text-[#8696a0]">
          <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          {!whatsappMode && (
            <Plus className="h-6 w-6 cursor-pointer transition-colors hover:text-[#111b21] dark:hover:text-white" />
          )}
        </div>
      )}

      <div className="flex min-h-[40px] flex-1 items-center rounded-[10px] bg-white px-4 py-2 shadow-sm dark:bg-[#2a3942]">
        {isRecording ? (
          <div className="flex w-full animate-pulse items-center gap-2 text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500"></span>
            <span className="text-sm font-medium">
              {t.chat.recording} ({formatTime(recordingTime)})
            </span>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            placeholder={isTranscribing ? t.chat.transcribing : t.chat.inputPlaceholder}
            className="w-full border-none bg-transparent text-[14.5px] text-[#111b21] outline-none placeholder:text-[#8696a0] focus:outline-none dark:text-[#e9edef]"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              soundManager.play('typing');
            }}
            onKeyDown={handleKeyDown}
            disabled={isSending || isTranscribing}
          />
        )}
      </div>

      {inputValue.trim() ? (
        <button
          onClick={handleSend}
          disabled={isSending || isTranscribing}
          className="rounded-full p-2 text-[#00a884] transition-all"
        >
          <Send className="h-6 w-6" />
        </button>
      ) : whatsappMode ? (
        // Mode WhatsApp: tanpa isi pesan → tombol kirim tetap tampil
        // (disabled sampai ada isi) menggantikan tombol mikrofon.
        <button
          disabled
          aria-label="Ketik pesan terlebih dahulu"
          className="rounded-full p-2 text-[#54656f] opacity-50 dark:text-[#8696a0]"
        >
          <Send className="h-6 w-6" />
        </button>
      ) : (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isSending || isTranscribing}
          className={`rounded-full p-2 transition-all ${isRecording ? 'text-red-500' : 'text-[#54656f] dark:text-[#8696a0]'}`}
        >
          {isTranscribing ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" />
          ) : isRecording ? (
            <Square className="h-6 w-6 fill-current" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>
      )}
    </div>
  );
}

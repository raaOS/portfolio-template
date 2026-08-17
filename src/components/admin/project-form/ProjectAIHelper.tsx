/**
 * Project AI Helper — Asisten AI untuk mengisi data proyek.
 *
 * Menggunakan AI API untuk menghasilkan deskripsi, caption, dan
 * komentar AI secara otomatis berdasarkan metadata proyek.
 *
 * @module components/admin/project-form/ProjectAIHelper
 */
import { useState } from 'react';
import { Comment, generateGenZComments } from '@/lib/magic';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { AIContentSection } from './components/AIContentSection';
import { AIViralSection } from './components/AIViralSection';

const getCsrfToken = () => {
  if (typeof document === 'undefined') return '';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; csrf_token=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
  return '';
};

export interface AIResponse {
  title: string;
  description: string;
  client: string;
  tags: string[];
  type: 'commercial' | 'visual_art';
  role: string;
  team: string;
  timeline: string;
  software?: string[];
  narrative: Record<string, unknown>;
  likes?: number;
  shares?: number;
  isViralPackageRequested?: boolean;
  comments?: Comment[];
}

interface ProjectAIHelperProps {
  cover: string;
  pendingFile: File | null;
  slug: string;
  projectId?: string;
  onGenerate: (data: AIResponse) => void;
  onGenerateViral: (
    likes: number,
    shares: number,
    commentsCount: number,
    comments?: Comment[]
  ) => void;
  existingContentFieldCount?: number;
  existingCommentCount?: number;
  mode?: 'content' | 'viral';
  projectTitle?: string;
  projectDescription?: string;
  onCoverMissing?: () => void;
}

interface GenerateRequestBody {
  style: string;
  maxTitleWords: number;
  sentenceCount: number;
  imageBase64?: string;
  imageUrl?: string;
}

export default function ProjectAIHelper({
  cover,
  pendingFile,
  slug,
  projectId: _projectId,
  onGenerate,
  onGenerateViral,
  existingContentFieldCount = 0,
  existingCommentCount = 0,
  mode,
  projectTitle = '',
  projectDescription = '',
  onCoverMissing,
}: ProjectAIHelperProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingViral, setIsGeneratingViral] = useState(false);
  const [aiOptions, setAiOptions] = useState({
    style: 'estetik & profesional',
    maxTitleWords: 5,
    sentenceCount: 2,
  });

  // Viral AI Custom Configurations state
  const [viralOptions, setViralOptions] = useState({
    tone: 'casual',
    likes: 240,
    comments: 5,
    shares: 35,
    reply: true,
  });

  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError: showToastError } = useToast();
  const { confirm } = useConfirm();

  const showContent = !mode || mode === 'content';
  const showViral = !mode || mode === 'viral';

  const handleGenerate = async () => {
    if (isGenerating) return;
    if (!cover && !pendingFile) {
      setError('Silakan unggah Cover Media di sebelah kiri terlebih dahulu agar AI bisa membaca konteks proyek Anda.');
      showToastError('Cover Media belum diunggah!');
      if (onCoverMissing) onCoverMissing();
      return;
    }

    if (existingContentFieldCount > 0) {
      const shouldRegenerate = await confirm({
        title: 'Generate ulang konten?',
        message: `Form ini sudah punya ${existingContentFieldCount} field konten. Generate ulang akan mengganti judul, deskripsi, metadata, tags, dan narasi yang ada.`,
        confirmText: 'Generate Ulang',
        cancelText: 'Batal',
        tone: 'warning',
      });

      if (!shouldRegenerate) return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const body: GenerateRequestBody = {
        style: aiOptions.style,
        maxTitleWords: aiOptions.maxTitleWords,
        sentenceCount: aiOptions.sentenceCount,
      };

      if (pendingFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(pendingFile);
        });
        body.imageBase64 = base64;
      } else {
        body.imageUrl = cover;
      }

      const res = await fetch('/api/ai/generate-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken(),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        console.warn('AI text generation warning:', err);
        throw new Error(err.error || 'AI Generation Failed');
      }

      const data = await res.json();

      let tags = data.tags;
      if (typeof tags === 'string') {
        tags = tags.split(',').map((t: string) => t.trim());
      }

      onGenerate({
        title: data.title,
        description: data.description,
        client: data.client,
        tags: Array.isArray(tags) ? tags : [],
        type: data.type || 'visual_art',
        role: data.role || '',
        team: data.team || '',
        timeline: data.timeline || '',
        software: data.software || [],
        narrative: data.narrative || {},
      });
      showSuccess('Berhasil men-generate konten proyek! ✨');
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate details';
      setError(errorMessage);
      showToastError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateViral = async () => {
    if (isGeneratingViral) return;

    if (!cover && !pendingFile) {
      setError('Silakan unggah Cover Media di sebelah kiri terlebih dahulu agar AI bisa menganalisis potensi viral.');
      showToastError('Cover Media belum diunggah!');
      if (onCoverMissing) onCoverMissing();
      return;
    }

    if (existingCommentCount > 0) {
      const shouldRegenerate = await confirm({
        title: 'Generate ulang komentar?',
        message: `Project ini sudah punya ${existingCommentCount} komentar/balasan. Generate ulang akan mengganti komentar yang ada, bukan menambah komentar baru.`,
        confirmText: 'Generate Ulang',
        cancelText: 'Batal',
        tone: 'warning',
      });

      if (!shouldRegenerate) return;
    }

    setIsGeneratingViral(true);
    setError(null);
    try {
      let generatedComments: Comment[] = [];
      const derivedSlug = slug || 'temp-slug';

      // 1. Process cover file if pending
      let imageBase64: string | undefined;
      if (pendingFile) {
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(pendingFile);
        });
      }

      // 2. Call backend magic complete API (for both saved and unsaved projects)
      try {
        const res = await fetch('/api/admin/projects/magic-complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
          },
          body: JSON.stringify({
            projectId: _projectId || '',
            slug: derivedSlug,
            likes: viralOptions.likes,
            shares: viralOptions.shares,
            commentCount: viralOptions.comments,
            tone: viralOptions.tone,
            reply: viralOptions.reply,
            projectTitle,
            projectDescription,
            cover,
            imageBase64,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || 'Magic complete API failed');
        }

        if (data?.comments && Array.isArray(data.comments)) {
          generatedComments = data.comments;
        } else {
          throw new Error('Comments payload format is incorrect');
        }
      } catch (apiErr) {
        console.warn(
          '[ProjectAIHelper] API comments generation failed, falling back to client-side mock:',
          apiErr
        );
        generatedComments = generateGenZComments(
          derivedSlug,
          viralOptions.comments,
          viralOptions.tone,
          viralOptions.reply
        );
      }

      onGenerateViral(
        viralOptions.likes,
        viralOptions.shares,
        viralOptions.comments,
        generatedComments
      );
      showSuccess('Berhasil men-generate statistik & ulasan viral! 🚀');
    } catch (err: unknown) {
      console.error(err);
      setError('Gagal membuat viral stats');
      showToastError('Gagal membuat viral stats');
    } finally {
      setIsGeneratingViral(false);
    }
  };

  const handleRandomizeViralStats = () => {
    const randomComments = Math.floor(Math.random() * 9) + 2; // 2 - 10 comments
    const randomShares = Math.floor(Math.random() * 80) + 10 + randomComments * 2; // 10 - 150 shares
    const randomLikes = Math.floor(Math.random() * 800) + 50 + randomShares * 3; // 50 - 1500 likes
    setViralOptions((prev) => ({
      ...prev,
      likes: randomLikes,
      comments: randomComments,
      shares: randomShares,
    }));
  };

  return (
    <div className="space-y-4">
      {/* 1. PROJECT CONTENT AI ASSISTANT */}
      {showContent && (
        <AIContentSection
          cover={cover}
          pendingFile={pendingFile}
          isGenerating={isGenerating}
          existingContentFieldCount={existingContentFieldCount}
          aiOptions={aiOptions}
          setAiOptions={setAiOptions}
          handleGenerate={handleGenerate}
        />
      )}

      {/* 2. VIRAL AI ASSISTANT */}
      {showViral && (
        <AIViralSection
          cover={cover}
          pendingFile={pendingFile}
          isGeneratingViral={isGeneratingViral}
          existingCommentCount={existingCommentCount}
          viralOptions={viralOptions}
          setViralOptions={setViralOptions}
          handleRandomizeViralStats={handleRandomizeViralStats}
          handleGenerateViral={handleGenerateViral}
        />
      )}

      {error && (
        <div className="rounded border border-red-100 bg-red-50/50 px-2.5 py-1.5 text-[10px] font-medium text-red-600">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

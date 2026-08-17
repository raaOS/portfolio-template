import { NextRequest, NextResponse } from 'next/server';
import { generateGenZComments, generateViralMetrics } from '@/lib/magic';
import type { Comment } from '@/lib/magic';
import { validateAdminRequest } from '@/lib/auth';
import { getGoogleAiApiKey, getOpenRouterApiKey } from '../../../ai/_shared';
import {
  fetchLocalMediaAsBase64,
  fetchRemoteMediaAsBase64,
  parseInlineBase64,
} from '../../../ai/media-helper';

async function generateAiCommentsWithFallback(params: {
  slug: string;
  count: number;
  tone: string;
  reply: boolean;
  projectTitle?: string;
  projectDescription?: string;
  cover?: string;
  imageBase64?: string;
  reqUrl: string;
}): Promise<Comment[]> {
  const googleAiApiKey = getGoogleAiApiKey();
  const openRouterApiKey = getOpenRouterApiKey();

  if (!googleAiApiKey && !openRouterApiKey) {
    console.log('[AI Comments] No API keys configured. Using local mock generator.');
    return generateGenZComments(params.slug, params.count, params.tone, params.reply);
  }

  try {
    // 1. Process cover image/video if available
    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (params.imageBase64) {
      const parsedInline = parseInlineBase64(params.imageBase64);
      base64Data = parsedInline.base64Data;
      mimeType = parsedInline.mimeType;
    } else if (params.cover) {
      try {
        if (
          params.cover.startsWith('/r2/') ||
          params.cover.startsWith('r2/') ||
          params.cover.startsWith('/assets/') ||
          params.cover.startsWith('assets/')
        ) {
          const localMedia = await fetchLocalMediaAsBase64(params.cover, params.reqUrl);
          base64Data = localMedia.base64Data;
          mimeType = localMedia.mimeType;
        } else if (params.cover.startsWith('http')) {
          const remoteMedia = await fetchRemoteMediaAsBase64(params.cover);
          base64Data = remoteMedia.base64Data;
          mimeType = remoteMedia.mimeType;
        }
      } catch (err) {
        console.warn('[AI Comments] Failed to download cover media:', err);
        // Do not crash, proceed with text-only prompt
      }
    }

    // 2. Prepare Prompt
    const toneDescription =
      params.tone === 'tech'
        ? 'Teknis & Mendalam (pertanyaan tentang stack, software, performa, code, atau detail pengerjaan).'
        : params.tone === 'aesthetic'
          ? 'Estetik & Visual (pujian tentang warna, layout, fluiditas transisi, dan keindahan).'
          : 'Casual & Gen-Z Slang (menggunakan kata-kata santai seperti "Gak ada obat!", "Tutor sepuh 🙏", "Info loker", "Kelas abangku 🔥", "PC NASA", dll.).';

    const prompt = `Bertindaklah sebagai sekelompok pengunjung (netizen/developer/desainer) yang melihat sebuah karya portofolio.
        
        KARYA/PROYEK:
        - Judul: "${params.projectTitle || 'Eksplorasi Kreatif'}"
        - Deskripsi: "${params.projectDescription || 'Tidak ada deskripsi'}"
        
        TUGAS:
        Hasilkan tepat ${params.count} komentar yang natural, sangat bervariasi, dan tidak repetitif dalam Bahasa Indonesia (gaul/santai/teknis sesuai tone).
        
        TONE UTAMA:
        - "${params.tone}" -> ${toneDescription}
        
        ATURAN BALASAN (REPLY):
        - Jika reply = true: buatlah 1 balasan dari pemilik portofolio ("Owner") atau pengunjung lain yang membalas konteks komentar tersebut secara relevan, gaul, dan ramah.
        - Jika reply = false: jangan berikan balasan (replies harus berupa array kosong).
        
        ATURAN PENTING:
        - HINDARI duplikasi konten atau pola kalimat yang sama persis antara komentar.
        - HINDARI nama komentator yang sama (gunakan nama-nama casual Indonesia seperti Rizky, Bagas, Dinda, Adit, Tiara, Siti, dll.).
        - Setiap komentar harus benar-benar mengomentari konteks proyek "${params.projectTitle || 'ini'}" dan gambarnya.
        
        OUTPUT JSON:
        Kembalikan respon dalam format JSON murni berupa array object dengan skema berikut:
        [
          {
            "text": "Isi komentar pengunjung",
            "name": "Nama Pengunjung",
            "likes": 42, // Angka random 0-100
            "replies": [
              {
                "text": "Balasan dari Owner (pemilik) atau pengunjung lain",
                "name": "Owner", // atau nama lain
                "likes": 12 // Angka random 0-20
              }
            ]
          }
        ]
        
        Hanya kembalikan array JSON tersebut tanpa markdown codeblock.`;

    // 3. Request AI Models
    let text = '';

    // Attempt Google AI first
    if (googleAiApiKey) {
      const modelCandidates = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
      type GoogleAiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
      const requestBody: {
        contents: Array<{ parts: GoogleAiPart[] }>;
        generationConfig: { response_mime_type: string };
      } = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
        },
      };

      if (base64Data) {
        requestBody.contents[0].parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          },
        });
      }

      for (const model of modelCandidates) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': googleAiApiKey },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          if (response.ok) {
            const data = (await response.json()) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
            };
            const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            text = typeof candidateText === 'string' ? candidateText : '';
            if (text) {
              console.log(`[AI Comments] Comments generated via Google AI ${model}`);
              break;
            }
          } else {
            console.warn(`[AI Comments] Google AI ${model} failed:`, await response.text());
          }
        } catch (err) {
          console.warn(`[AI Comments] Google AI ${model} request error:`, err);
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    // Fallback to OpenRouter
    if (!text && openRouterApiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      type OpenRouterContentPart =
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } };
      const messages: Array<{ role: 'user'; content: OpenRouterContentPart[] }> = [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ];

      if (base64Data) {
        messages[0].content.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`,
          },
        });
      }

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'Portfolio Shared Admin',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages,
            temperature: 0.5,
            max_tokens: 1200,
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: unknown } }>;
          };
          const content = data.choices?.[0]?.message?.content;
          text = typeof content === 'string' ? content : '';
          if (text) {
            console.log('[AI Comments] Comments generated via OpenRouter');
          }
        }
      } catch (err) {
        console.warn('[AI Comments] OpenRouter request failed:', err);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!text) {
      throw new Error('AI providers returned empty or failed to respond');
    }

    // 4. Safe JSON Parsing & Mapping to Comment Schema
    const jsonText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsedArray = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsedArray)) {
      throw new Error('AI output is not a JSON array');
    }

    const NAMES = [
      'Bagas',
      'Dinda',
      'Rizky',
      'Siti',
      'Adit',
      'Fajri',
      'Tiara',
      'Gilang',
      'Putri',
      'Zaki',
    ];

    interface AiReplyDraft {
      text?: unknown;
      name?: unknown;
      likes?: unknown;
    }

    interface AiCommentDraft extends AiReplyDraft {
      replies?: unknown;
    }

    const toOptionalString = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value : undefined;

    const mappedComments: Comment[] = parsedArray.map((item, i: number) => {
      const c = item as AiCommentDraft;
      const name = toOptionalString(c.name) || NAMES[Math.floor(Math.random() * NAMES.length)];
      const replyDrafts = Array.isArray(c.replies) ? c.replies : [];
      const replies = replyDrafts.map((replyItem, ri: number) => {
        const r = replyItem as AiReplyDraft;
        const replyName = toOptionalString(r.name) || 'Owner';
        return {
          id: `r-${params.slug}-${i}-${ri}-ai`,
          text: toOptionalString(r.text) || 'Keren!',
          name: replyName,
          time: 'Baru saja',
          createdAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          likes: typeof r.likes === 'number' ? r.likes : Math.floor(Math.random() * 10),
          avatar:
            replyName === 'Owner'
              ? `https://ui-avatars.com/api/?name=Owner&background=000&color=fff`
              : `https://ui-avatars.com/api/?name=${replyName}&background=random`,
        };
      });

      return {
        id: `c-${params.slug}-${i}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        text: toOptionalString(c.text) || 'Luar biasa!',
        name: name,
        time: 'Beberapa menit yang lalu',
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        likes: typeof c.likes === 'number' ? c.likes : Math.floor(Math.random() * 50),
        replies: replies,
        avatar: `https://ui-avatars.com/api/?name=${name}&background=random`,
      };
    });

    return mappedComments;
  } catch (err) {
    console.error('[AI Comments] AI Generation error, falling back to mock:', err);
    return generateGenZComments(params.slug, params.count, params.tone, params.reply);
  }
}

export async function POST(req: NextRequest) {
  if (!(await validateAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      slug,
      likes,
      shares,
      commentCount,
      tone,
      reply,
      projectTitle,
      projectDescription,
      cover,
      imageBase64,
    } = await req.json();

    const commentSlug = typeof slug === 'string' && slug.trim() ? slug.trim() : 'temp-slug';

    // 1. Calculate Metrics (in-memory only, no DB writes)
    const generatedMetrics = generateViralMetrics();
    const metrics = {
      likes: typeof likes === 'number' ? likes : generatedMetrics.likes,
      shares: typeof shares === 'number' ? shares : generatedMetrics.shares,
    };

    // 2. Generate Comments (in-memory only, no DB writes)
    const finalCommentCount = typeof commentCount === 'number' ? commentCount : 5;
    const finalReply = typeof reply === 'boolean' ? reply : true;

    // Generate context-aware AI comments (or fall back to mock comments)
    const newComments = await generateAiCommentsWithFallback({
      slug: commentSlug,
      count: finalCommentCount,
      tone: tone || 'casual',
      reply: finalReply,
      projectTitle,
      projectDescription,
      cover,
      imageBase64,
      reqUrl: req.url,
    });

    return NextResponse.json({
      success: true,
      metrics,
      commentCount: newComments.length,
      comments: newComments,
    });
  } catch (error) {
    console.error('Magic Complete Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        error: 'Failed to complete magic operation',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAiApiKey, guardAdminAiRequest } from '../_shared';

/**
 * AI Integration for Testimonials
 * Generates realistic WhatsApp style testimonials.
 */
interface GenerateTestimonialRequest {
  topic?: string;
  messageCount?: number;
}

export async function POST(req: NextRequest) {
  const guardResponse = await guardAdminAiRequest(req, 'ai_testimonial');
  if (guardResponse) return guardResponse;

  const API_KEY = getGoogleAiApiKey();
  if (!API_KEY) {
    return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
  }

  try {
    const { topic = 'Desain Ads', messageCount = 3 } =
      (await req.json()) as GenerateTestimonialRequest;

    // Call Google AI API
    const model = 'gemini-flash-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = `BERTINDAK SEBAGAI: Seorang klien yang sangat puas dengan hasil kerja seorang Creative Designer.
        
        TOPIK PROJECT: ${topic}
        JUMLAH PESAN: ${messageCount} (Satu rangkaian percakapan)
        
        GAYA BAHASA (WAJIB):
        - Gunakan Bahasa Indonesia yang NATURAL, santai, friendly, dan sopan.
        - HINDARI kata-kata robot/kaku.
        - HINDARI kata "gue" dan "lu". Gunakan "Mas", "Bro", "Saya", atau nama.
        - HINDARI bahasa yang hiperbola atau terlalu "halu". Pastikan testimoninya realistis.
        - Fokus pada kepuasan hasil desain (kecepatan, estetika, atau kecocokan brief).
        
        OUTPUT YANG DIBUTUHKAN (JSON):
        1. name: Nama klien yang variatif (Contoh: "Agus Setiawan", "Siska Marketing", "Deni - Brand X").
        2. notificationText: Satu kalimat singkat yang merangkum inti kepuasan (akan muncul di pop-up notifikasi).
        3. messages: Array objek chat dengan urutan waktu yang logis (selisih 1-5 menit).
           - text: Isi pesan chat.
           - isMe: boolean (true jika dari Designer/Owner, false jika dari Klien).
           - time: String format "HH:mm".
           
        CONTOH STRUKTUR PERCAKAPAN:
        Klien: "Halo mas, barusan kumasukin tim produksi. Hasil bannernya emang beda sih."
        Me: "Syukurlah mas kalau cocok. Ada yang perlu revisi lagi?"
        Klien: "Gak ada mas, udah aman semua. Makasih banyak ya!"

        Output JSON murni validation key:
        {
          "name": "...",
          "notificationText": "...",
          "messages": [
            { "text": "...", "isMe": false, "time": "09:00" },
            { "text": "...", "isMe": true, "time": "09:05" },
            { "text": "...", "isMe": false, "time": "09:10" }
          ]
        }`;

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Google AI API Error: ${txt}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from AI');
    }

    // Clean markdown and parse
    const jsonText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(jsonText);

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error('AI Generate Testimonial Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

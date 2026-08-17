import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAiApiKey, guardAdminAiRequest } from '../_shared';

// API Timeout: 30 seconds
const API_TIMEOUT = 30000;

export async function POST(req: NextRequest) {
  const guardResponse = await guardAdminAiRequest(req, 'ai_conversation');
  if (guardResponse) return guardResponse;

  const API_KEY = getGoogleAiApiKey();
  if (!API_KEY) {
    return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
  }

  try {
    const { senderName, notifMessage } = await req.json();

    if (!senderName || !notifMessage) {
      return NextResponse.json(
        { error: 'Sender name and notification message are required' },
        { status: 400 }
      );
    }

    const model = 'gemini-flash-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = `BERTINDAK SEBAGAI: Senior Creative Designer sebagai pemilik portfolio.
        
        TUGAS: Buatlah simulasi percakapan WhatsApp yang natural dan koheren antara pemilik portfolio (SAYA) dan "${senderName}" (DIA).
        
        KONTEKS AWAL:
        - "${senderName}" baru saja mengirimkan notifikasi WhatsApp kepada pemilik portfolio dengan pesan: "${notifMessage}".
        
        GAYA BAHASA:
        - Bahasa Indonesia Gaul/Natural WhatsApp (pakai singkatan wajar seperti 'yg', 'sdh', 'ok', 'sy', 'bisa', 'siap').
        - Pemilik portfolio (SAYA) harus merespons secara profesional tapi santai, menunjukkan keahlian di bidangnya (Desain Visual/Graphic Design).
        - Percakapan harus nyambung dengan isi pesan awal.
        - Jika pesan awal tentang tawaran kerja/proyek, bahas ke arah teknis atau rasa terima kasih.
        - Maksimal 4-6 balon chat tambahan (total alur yang pas).
        
        FORMAT OUTPUT: JSON array murni berisi objek ChatMessage.
        Setiap objek harus memiliki:
        - id: number (dimulai dari current + 1, buat saja urutan unik sederhana)
        - text: string (isi pesan)
        - isMe: boolean (true jika dari pemilik portfolio/SAYA, false jika dari ${senderName}/DIA)
        - time: string (HH:mm format, lanjutkan dari waktu sekarang/wajar)
        - status: "read"
        
        BUAT ALUR YANG MASUK AKAL:
        1. Respon dari pemilik portfolio (isMe: true)
        2. Balasan dari ${senderName} (isMe: false)
        3. Dst...
        
        Output JSON murni:
        [
          { "id": 1, "text": "...", "isMe": true, "time": "...", "status": "read" },
          ...
        ]`;

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

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Google AI API Error: ${txt}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from AI');
    }

    const jsonText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[AI Generate Conversation] JSON parse error:', parseError);
      return NextResponse.json({ error: 'Invalid JSON response from AI' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'AI request timed out. Please try again.' },
        { status: 504 }
      );
    }
    console.error('AI Generate Conversation Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

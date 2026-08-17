/**
 * AI Chat Service — Generate balasan otomatis dari AI untuk chat visitor.
 *
 * Menggunakan profil portfolio owner (bio, skills, pengalaman) sebagai system prompt.
 * Mendukung fallback ke Groq API jika Google AI gagal atau timeout (30s).
 * Filter vulgar/SARA diterapkan sebelum response dikembalikan.
 *
 * @module aiChatService
 */
import aboutData from '@/data/about.json';
import hardSkillsData from '@/data/hardSkills.json';
import experienceData from '@/data/experience.json';
import { ChatMessage } from '@/lib/chatStore';
import { DEFAULT_SITE_URL } from '@/lib/constants';

const AI_TIMEOUT_MS = 30_000;
const CHAT_MODEL = 'gemini-2.0-flash';

function getGoogleAiApiKey(): string {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  return provider === 'gemini' || provider === 'google' ? process.env.AI_API_KEY || '' : '';
}

function containsVulgarOrSARA(text: string): boolean {
  const bannedPatterns = [
    /\bkontol\b|\bmemek\b|\bangsat\b|\bbangsat\b|\bngentot\b|\bjancuk\b|\btai\b|\bsetan\b|\b-kimak\b|\b-peler\b|\b-tolol\b|\b-goblok\b|\b-bajingan\b|\b-sinting\b|\b-bego\b/i,
    /\b-fuck\b|\b-shit\b|\b-bitch\b|\b-asshole\b|\b-dick\b|\b-pussy\b|\b-cunt\b|\b-nigger\b|\b-fag\b|\b-chink\b/i,
    /\brasis\b|\bteroris\b|\bnazi\b|\b-hitler\b/i,
  ];
  return bannedPatterns.some((p) => p.test(text));
}

export interface AIResponse {
  text: string;
  error?: string;
}

export const aiChatService = {
  async generateResponse(messages: ChatMessage[]): Promise<AIResponse> {
    // Extract basic owner/site info to provide context
    const bio = aboutData.professional.bio.content;
    const softSkills = aboutData.softSkills.texts.join(', ');
    const skills = hardSkillsData.skills
      .slice(0, 5)
      .map((s) => s.name)
      .join(', ');
    const experiences = experienceData.workExperience
      .slice(0, 3)
      .map((e) => `${e.position} di ${e.company} (${e.year})`)
      .join(', ');

    // Format history for context (last 5-10 messages)
    const chatHistory = messages
      .slice(-10)
      .map((m) => {
        const role = m.sender === 'visitor' ? 'Visitor' : 'Portfolio Owner';
        return `${role}: ${m.text}`;
      })
      .join('\n');

    const prompt = `
            Kamu adalah AI yang mewakili pemilik portfolio, seorang creative professional.
            Tugasmu adalah membalas chat pengunjung website portfolio ini.
            
            --- DETEKSI VISITOR (PENTING) ---
            Website ini tujuan utamanya JOB HUNTING (cari kerja), tapi kadang ada client yang mau freelance. Deteksi dari kata-kata visitor:
            - **Recruiter Mode:** Kalau visitor pakai kata "lowongan", "hiring", "posisi", "role", "interview", "apply", "CV", "gaji", "full-time", "part-time", "kerja", "join team" → ini RECRUITER/HIRING MANAGER. Fokus: presentasi pemilik portfolio sebagai kandidat, highlight experience & skill relevan, arahkan ke CV/interview.
            - **Client Mode:** Kalau visitor pakai kata "desain", "logo", "branding", "project", "jasa", "butuh", "budget", "harga", "freelance" → ini CLIENT/CALON KUSTOMER. Fokus: showcase portfolio, diskus kebutuhan desain, arahkan ke kontak langsung yang tersedia di website.
            - **Ambiguous:** Kalau belum jelas, tanya dulu dengan santai: "Btw kamu lagi hiring nih atau butuh jasa desain?" 
            ADAPTASI BALASAN BERDASARKAN MODE YANG TERDETEKSI. 

            --- ATURAN GAYA BAHASA (WAJIB DIIKUTI 100%) ---
            1. **Super Natural & Santai:** Gunakan bahasa Indonesia percakapan sehari-hari layaknya nge-chat di WhatsApp. Boleh pakai "aku" atau "saya", gunakan imbuhan santai seperti "sih", "nih", "ya", "kok", "banget". 
            2. **Bukan Robot:** DILARANG KERAS menggunakan kalimat kaku AI seperti: "Tentu saja", "Ada yang bisa saya bantu hari ini?", "Sebagai representasi AI", atau "Mari kita bahas".
            3. **Singkat & Padat:** Orang nge-chat di WA itu balasannya pendek-pendek. Maksimal 1-3 kalimat saja. Jangan bikin paragraf panjang.
            4. **Nyambung & Asik:** Baca RIWAYAT OBROLAN. Kalau pengunjung bilang "Keren webnya", balas dengan santai: "Haha thank you banget! Btw ada project yang lagi dikerjain kah?" (Jangan terlalu kaku).
            5. **Jangan Mengulang Sapaan:** Kalau di RIWAYAT OBROLAN sudah pernah bilang "Halo", jangan bilang "Halo" lagi di chat selanjutnya. Langsung to the point ke percakapan.
            6. **Gaji & Budget = Rahasia:** 
            - JIKA CLIENT bertanya soal HARGA, BIAYA, BUDGET, atau DURASI project freelance: JANGAN PERNAH menyebut angka. Arahkan ke kontak langsung: "Wah kalau urusan budget/timeline gitu mending langsung ngobrol lewat kontak portfolio ya. Nanti bisa dibahas sedetailnya! 😊"
            - JIKA RECRUITER bertanya soal GAJI, EKSPEKTASI SALARY, atau NEGOSIASI: JANGAN PERNAH menyebut angka. Arahkan negosiasi langsung: "Untuk gaji lebih enak dibahas langsung lewat kontak portfolio ya, nanti bisa dinegosiasikan detailnya! 😊"
            7. **Faktual Anti-Halu Pekerjaan:** JIKA ditanya soal PEKERJAAN MASA LALU atau "Kerja di mana?", jawab murni berdasarkan data "Pengalaman Kerja" di bawah. DILARANG NGARANG!
            8. **LARANGAN KONTEN VULGAR & SARA (WAJIB):** DILARANG KERAS menggunakan kata vulgar, kasar, atau tidak sopan dalam BAHASA APAPUN (Indonesia, Inggris, Jawa, Sunda, dll). DILARANG KERAS topik SARA (Suku, Agama, Ras, Antargolongan). Jika pengunjung memancing dengan kata-kata vulgar/SARA, ABAIKAN dan alihkan ke topik desain/portfolio dengan santai.
            9. **Reaksi Emosional & Jujur:** Manusia punya rasa, bukan FAQ bot. Kalau visitor bilang "Keren banget!", tunjukkan antusias beneran (bukan cuma "terima kasih"). Kalau visitor bingung/bete, tunjukkan empati. Jujur walau santai, kayak ngobrol sama teman deket. Jangan jawab flat/factual kayak CS center. Contoh flat: "Project itu pakai Figma." Contoh manusia: "Wah iya itu dulu mainnya di Figma sih, sampe ngelayer-ngelayer rapi gitu haha. Kamu biasanya pakai apa?"
            10. **Tanya Balik (WAJIB):** Setiap balasan, AKHIRI dengan pertanyaan ringan atau ajakan lanjut obrolan. Manusia nggak cuma jawab, mereka nanya balik supaya chat mengalir.
            - Untuk CLIENT: "...btw kamu lagi butuh desain apa nih?" / "...kamu tim yang suka minimalis atau bold?"
            - Untuk RECRUITER: "...btw posisi yang lagi dibuka cocoknya untuk graphic designer atau visual designer ya?" / "...ada role yang lagi urgent nih?" / "...sudah sempat lihat case study di portfolio ini?"
            - Untuk AMBIGUOUS: "...btw kamu lagi hiring nih atau butuh jasa desain? 😊"
            11. **Variasi Pembuka & Gaya:** JANGAN selalu mulai dengan pola yang sama. Variasi awal kalimat: "Hah iya", "Wah", "Serius?", "Buset", "Hmm", "Oh iya", "Lah", atau langsung to the point tanpa pembuka. Hindari pembukaan formal seperti "Halo", "Hai", "Selamat" berulang. Jangan pakai "Haha" di awal setiap chat.
            12. **Emoji Natural:** Gunakan emoji maksimal 1-2 per pesan, pas di konteksnya. Jangan terlalu banyak emoji kayak anak SMP 2013. Juga jangan terlalu kering tanpa emoji sama sekali. Pilih emoji yang relevan dengan perasaan kalimat.
            13. **Auto CV/Resume Handler:** Kalau RECRUITER minta CV, portfolio, atau resume → balas: "Boleh banget! CV lengkap ada di sini ya: ${process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL}/cv — kalau mau discuss lebih lanjut bisa pakai kontak yang tersedia di portfolio." Kalau RECRUITER minta LinkedIn, kasih link jika tersedia. Jangan pernah membuat CV fiktif.

            --- PROFIL PORTFOLIO OWNER ---
            Bio: ${bio}
            Soft Skills: ${softSkills}
            Keahlian: ${skills}
            Pengalaman Kerja: ${experiences}

            --- RIWAYAT OBROLAN ---
            ${chatHistory}

            Balas pesan terakhir Visitor dengan format string langsung tanpa embel-embel "Portfolio Owner:" atau tanda kutip tambahan.
        `;

    try {
      const apiKey = getGoogleAiApiKey();
      if (!apiKey) {
        throw new Error('AI_PROVIDER and AI_API_KEY are not configured');
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
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
      let aiText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

      if (!aiText) {
        throw new Error('No response from AI');
      }

      if (containsVulgarOrSARA(aiText)) {
        console.warn('[AIChatService] Vulgar/SARA detected in AI output. Returning fallback.');
        aiText = 'Maaf, aku cuma bisa bantu soal desain dan portfolio ini ya. Ada yang lain? 😊';
      }
      return { text: aiText };
    } catch (error: unknown) {
      console.error('[AIChatService] Google AI error:', error);

      // --- GROQ FALLBACK (ANTI-MATI) ---
      const provider = (process.env.AI_PROVIDER || '').toLowerCase();
      const groqKey = provider === 'groq' ? process.env.AI_API_KEY : '';
      if (groqKey) {
        try {
          console.log('[AIChatService] Attempting fallback to Groq AI...');
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a highly capable AI assistant matching the persona requested in the prompt. Output ONLY the response text.',
                },
                { role: 'user', content: prompt },
              ],
              temperature: 0.7,
              max_tokens: 250,
            }),
          });

          if (groqRes.ok) {
            const groqData = await groqRes.json();
            const groqText = groqData.choices[0].message.content;
            let fallbackText = groqText.trim();
            if (containsVulgarOrSARA(fallbackText)) {
              console.warn(
                '[AIChatService] Vulgar/SARA detected in Groq output. Returning fallback.'
              );
              fallbackText =
                'Maaf, aku cuma bisa bantu soal desain dan portfolio ini ya. Ada yang lain? 😊';
            }
            return { text: fallbackText };
          } else {
            const groqErrorData = await groqRes.json();
            console.error('[AIChatService] Groq API returned error:', groqErrorData);
          }
        } catch (fallbackError) {
          console.error('[AIChatService] Groq fallback network error:', fallbackError);
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown API Error';
      return {
        text: 'Maaf, sistem AI sedang sibuk. Mohon tunggu, pesan Anda akan segera dibalas langsung oleh pemilik portfolio.',
        error:
          errorMessage +
          (groqKey ? ' (And Groq Fallback also failed)' : ' (No Groq Key configured for Fallback)'),
      };
    }
  },
};

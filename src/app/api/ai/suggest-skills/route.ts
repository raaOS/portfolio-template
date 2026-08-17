import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAiApiKey, guardAdminAiRequest } from '../_shared';

interface SuggestSkillsRequest {
  skillName: string;
}

interface SuggestSkillsResponse {
  details: string[];
}

export async function POST(req: NextRequest) {
  const guardResponse = await guardAdminAiRequest(req, 'ai_skills');
  if (guardResponse) return guardResponse;

  const API_KEY = getGoogleAiApiKey();
  if (!API_KEY) {
    return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
  }

  try {
    const { skillName } = (await req.json()) as SuggestSkillsRequest;

    if (!skillName) {
      return NextResponse.json({ error: 'Skill name is required' }, { status: 400 });
    }

    const model = 'gemini-flash-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = `Act as a Senior Graphic Designer & Tech Expert.
        Target Skill: "${skillName}"
        
        Generate exactly 4 KEY CAPABILITIES or FEATURES of this software/skill that are most relevant for a professional CV.
        - Keep them short (2-3 words max per point).
        - Focus on "Hard Skills" / Technical aspects (e.g. for Photoshop: "Masking & Compositing", "Color Grading", not "Creativity").
        - Use Title Case.
        
        Output strictly as a JSON object:
        { "details": ["Point 1", "Point 2", "Point 3", "Point 4"] }`;

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

    if (!text) throw new Error('No response from AI');

    const jsonText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    const parsed: SuggestSkillsResponse = JSON.parse(jsonText);

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error('AI Suggest Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

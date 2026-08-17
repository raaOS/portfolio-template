/**
 * Test Google AI — Quick-test konektivitas Google Generative AI API via REST.
 *
 * Script sederhana untuk memverifikasi bahwa API key Google AI valid
 * dan model dapat menghasilkan respons dengan benar.
 *
 * @module scripts/test-gemini
 */
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const AI_PROVIDER = (process.env.AI_PROVIDER || '').toLowerCase();
const API_KEY =
  AI_PROVIDER === 'gemini' || AI_PROVIDER === 'google' ? process.env.AI_API_KEY : '';
console.log('Key length:', API_KEY?.length);

async function test() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY || '' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'hello' }] }],
      }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    console.log('Success:', data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (e: any) {
    console.error('Error:', e.message || e);
  }
}
test();

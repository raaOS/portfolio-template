/**
 * Magic Caption Generator — Generator caption otomatis menggunakan AI.
 *
 * Menghasilkan caption kreatif untuk proyek menggunakan Google AI API
 * berdasarkan metadata dan deskripsi proyek yang tersimpan.
 *
 * @module scripts/generators/magic-caption
 */
// Load env vars
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const fs = require('fs');
const https = require('https');

// --- 1. Configuration ---
const AI_PROVIDER = (process.env.AI_PROVIDER || '').toLowerCase();
const API_KEY =
  AI_PROVIDER === 'gemini' || AI_PROVIDER === 'google' ? process.env.AI_API_KEY : '';

if (!API_KEY) {
  console.error('AI provider key is missing. Set AI_PROVIDER=gemini and AI_API_KEY.');
  process.exit(1);
}

const PROJECTS_FILE = path.join(__dirname, '../src/data/projects.json');

// --- 2. Helper Functions ---

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    // Force jpg for video thumbnails if needed
    let targetUrl = url;
    if (url.endsWith('.mp4') || url.endsWith('.webm')) {
      targetUrl = url.replace(/\.(mp4|webm)$/i, '.jpg');
    }

    https
      .get(targetUrl, (res) => {
        if (res.statusCode !== 200) {
          // If jpg fails (maybe not generated yet), try original if it's an image
          if (!url.endsWith('.mp4') && !url.endsWith('.webm')) {
            // fallback logic could go here but let's just fail for now
          }
          reject(new Error(`Failed to load image: code ${res.statusCode}`));
          return;
        }
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => resolve(Buffer.concat(data)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function startGoogleAi(buffer, mimeType = 'image/jpeg') {
  const model = 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const base64Image = buffer.toString('base64');

  const prompt = `
    Analyze this image specifically for a portfolio display.
    Return a JSON object with:
    - title: A short, punchy, professional title (max 3-5 words). Avoid generic "Abstract Art". Be specific if possible.
    - description: A single compelling sentence describing the visual style or subject matter (max 20 words).
    
    Return ONLY raw JSON.
  `;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google AI API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error('No text content in response');

    const cleanText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Google AI Error:', error.message);
    return null;
  }
}

// --- 3. Main Loop ---

async function main() {
  console.log('🚀 Starting Magic Captioning...');
  const fileContent = fs.readFileSync(PROJECTS_FILE, 'utf8');
  const data = JSON.parse(fileContent);
  let projects = data.projects;

  // Filter projects processed by our previous script (marker: "Portfolio Asset")
  const targetProjects = projects.filter((p) => p.client === 'Portfolio Asset');

  console.log(`🎯 Found ${targetProjects.length} projects to magic caption.`);

  let updatedCount = 0;

  for (const [i, project] of targetProjects.entries()) {
    console.log(
      `\n[${i + 1}/${targetProjects.length}] Processing: ${project.title.substring(0, 20)}...`
    );

    if (!project.cover) {
      console.log('   ⚠️ No cover found, skipping.');
      continue;
    }

    async function generateWithRetry(buffer, retries = 3) {
      try {
        return await startGoogleAi(buffer);
      } catch (e) {
        if (e.message.includes('429') && retries > 0) {
          console.log('   ⏳ Rate limit hit. Waiting 30s...');
          await new Promise((r) => setTimeout(r, 30000));
          return generateWithRetry(buffer, retries - 1);
        }
        throw e;
      }
    }

    try {
      const imageBuffer = await downloadImage(project.cover);
      // console.log("   ✅ Image downloaded.");

      const aiResult = await generateWithRetry(imageBuffer);

      if (aiResult && aiResult.title) {
        console.log(`   ✨ New Title: "${aiResult.title}"`);
        console.log(`   📝 Desc: "${aiResult.description}"`);

        project.title = aiResult.title;
        project.description = aiResult.description;
        // Update slug to match title for cleanliness
        project.slug = aiResult.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        project.client = 'Personal Work'; // Update client to indicate it's ready

        updatedCount++;
      } else {
        console.log('   ❌ AI returned invalid data.');
      }

      // Delay to avoid rate limits (RPM) - Safe 25s
      await new Promise((r) => setTimeout(r, 25000));
    } catch (e) {
      console.error(`   ❌ Failed: ${e.message}`);
    }
  }

  if (updatedCount > 0) {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
    console.log(`\n🎉 Successfully updated ${updatedCount} projects with magic captions!`);
  } else {
    console.log('\n⚠️ No projects updated.');
  }
}

main();

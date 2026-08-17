/**
 * Magic Caption ID Generator — Generator caption berbahasa Indonesia.
 *
 * Menghasilkan caption kreatif dalam Bahasa Indonesia untuk proyek
 * menggunakan Google AI API berdasarkan metadata yang tersimpan.
 *
 * @module scripts/generators/magic-caption-id
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const fs = require('fs');
const https = require('https');

const AI_PROVIDER = (process.env.AI_PROVIDER || '').toLowerCase();
const API_KEY =
  AI_PROVIDER === 'gemini' || AI_PROVIDER === 'google' ? process.env.AI_API_KEY : '';

if (!API_KEY) {
  console.error('AI provider key is missing. Set AI_PROVIDER=gemini and AI_API_KEY.');
  process.exit(1);
}
const projectsFile = path.join(__dirname, '../src/data/projects.json');

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    // Handle Cloudinary video by fetching a thumbnail (jpg)
    // If url ends in .mp4, simple cloudinary transform to .jpg?
    // Actually, Cloudinary videos usually have a derived image URL if we change extension.
    // Or we can just use the 'cover' URL if it's already an image?
    // The current projects have 'cover' which is mp4 for videos.
    // Cloudinary trick: replace file extension with .jpg or append .jpg to resource.
    // But the cover IS the resource URL.
    // Example: .../upload/v123/id.mp4
    // Thumbnail: .../upload/v123/id.jpg

    let targetUrl = url;
    if (url.includes('cloudinary') && url.endsWith('.mp4')) {
      targetUrl = url.replace('.mp4', '.jpg');
    }

    https
      .get(targetUrl, (res) => {
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => resolve(Buffer.concat(data)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function startGoogleAi(buffer) {
  const model = 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const base64Image = buffer.toString('base64');

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: 'Analisis gambar ini. Berikan JUDUL (max 5 kata) dan DESKRIPSI (max 2 kalimat) yang estetik dan profesional untuk portofolio desain/kreatif. WAJIB DALAM BAHASA INDONESIA. Output JSON murni: {"title": "...", "description": "..."}',
          },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Image,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.status.toString().startsWith('2')) {
    const txt = await response.text();
    throw new Error(`Google AI API Error ${response.status}: ${txt}`);
  }

  const data = await response.json();
  try {
    const text = data.candidates[0].content.parts[0].text;
    // Clean markdown code blocks if present
    const jsonText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('Failed to parse AI response', data);
    return null;
  }
}

async function run() {
  console.log('🚀 Starting Magic Captioning (Indonesian)...');

  if (!fs.existsSync(projectsFile)) {
    console.error('projects.json not found');
    return;
  }

  const data = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
  let updatedCount = 0;

  // Filter projects that look like they need captioning OR just re-do the Cloudinary ones.
  // The previous run set them to "Personal Work".
  // We can filter by createdAt or just specific IDs if we knew them.
  // But safe to iterate all "Personal Work" projects that have Cloudinary URLs?
  // Actually, user wants "magic captioning" fixed.
  // The generated projects have IDs starting with "gen-".
  const projectsToUpdate = data.projects.filter((p) => p.id.startsWith('gen-'));

  console.log(`🎯 Found ${projectsToUpdate.length} projects to auto-caption.`);

  for (let i = 0; i < projectsToUpdate.length; i++) {
    const project = projectsToUpdate[i];
    console.log(`\n[${i + 1}/${projectsToUpdate.length}] Processing: ${project.title}`);

    // Retry Logic
    async function generateWithRetry(retries = 3) {
      try {
        const buffer = await downloadImage(project.cover);
        return await startGoogleAi(buffer);
      } catch (e) {
        if (e.message.includes('429') && retries > 0) {
          console.log('   ⏳ Rate limit hit. Waiting 30s...');
          await new Promise((r) => setTimeout(r, 30000));
          return generateWithRetry(retries - 1);
        }
        throw e;
      }
    }

    try {
      const aiResult = await generateWithRetry();

      if (aiResult && aiResult.title) {
        console.log(`   🇮🇩 Title: "${aiResult.title}"`);
        console.log(`   📝 Desc: "${aiResult.description}"`);

        project.title = aiResult.title;
        project.description = aiResult.description;
        project.slug = aiResult.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        updatedCount++;
      } else {
        console.log('   ❌ AI returned invalid data.');
      }

      // Save after EACH success to be safe
      fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2));

      // Delay 25s for Safety
      await new Promise((r) => setTimeout(r, 25000));
    } catch (e) {
      console.error(`   ❌ Failed: ${e.message}`);
    }
  }

  console.log(`\n🎉 Successfully updated ${updatedCount} projects to Indonesian!`);
}

run();

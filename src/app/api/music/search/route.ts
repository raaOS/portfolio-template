import { NextResponse } from 'next/server';

interface YouTubeRun {
  text?: string;
}

interface YouTubeVideoRenderer {
  videoId?: string;
  title?: {
    runs?: YouTubeRun[];
    accessibility?: {
      accessibilityData?: {
        label?: string;
      };
    };
  };
  ownerText?: { runs?: YouTubeRun[] };
  shortBylineText?: { runs?: YouTubeRun[] };
  lengthText?: { simpleText?: string };
  thumbnail?: { thumbnails?: Array<{ url?: string }> };
}

interface YouTubeSearchData {
  contents?: {
    twoColumnSearchResultsRenderer?: {
      primaryContents?: {
        sectionListRenderer?: {
          contents?: Array<{
            itemSectionRenderer?: {
              contents?: Array<{ videoRenderer?: YouTubeVideoRenderer }>;
            };
          }>;
        };
      };
    };
  };
}

interface MusicSearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  src: 'youtube';
  source: 'youtube';
  thumbnail: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter q' }, { status: 400 });
  }

  try {
    // Fetch search results from YouTube.
    // sp=EgIQAQ%253D%253D filters results to videos only.
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from YouTube: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extract ytInitialData json object
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (!match) {
      return NextResponse.json({ results: [] });
    }

    const data = JSON.parse(match[1]) as YouTubeSearchData;
    const contents =
      data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents;
    if (!contents || contents.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const videoRendererList = contents[0]?.itemSectionRenderer?.contents || [];
    const results: MusicSearchResult[] = [];

    for (const item of videoRendererList) {
      if (item.videoRenderer) {
        const video = item.videoRenderer;
        
        // Extract video ID
        const videoId = video.videoId;
        if (!videoId) continue;

        // Extract title
        const title = video.title?.runs?.[0]?.text || video.title?.accessibility?.accessibilityData?.label || 'Unknown';

        // Extract artist/channel name
        const artist = video.ownerText?.runs?.[0]?.text || video.shortBylineText?.runs?.[0]?.text || 'Unknown Artist';

        // Extract duration in seconds
        const durationText = video.lengthText?.simpleText || '3:00';
        const parts = durationText.split(':').map(Number);
        let durationSeconds = 0;
        if (parts.length === 2) {
          durationSeconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else {
          durationSeconds = 180; // fallback 3 minutes
        }

        // Extract thumbnail URL
        const thumbnail = video.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        results.push({
          id: videoId,
          title,
          artist,
          duration: durationSeconds,
          src: 'youtube', // indicates it plays via YT API
          source: 'youtube',
          thumbnail,
        });

        // Keep enough results for queue playback without making the widget heavy.
        if (results.length >= 10) {
          break;
        }
      }
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error('YouTube Search API error:', error);
    return NextResponse.json(
      // SECURITY FIX (audit 2026-09-29): jangan teruskan error.message
      // internal (bisa memuat detail URL/key) ke respons publik.
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

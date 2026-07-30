import { getMovieMetadata, D1Database } from '../lib/db';

const R2_CDN = "/api/media";

export interface Env {
  movies: R2Bucket;
  DB: D1Database;
}

interface MovieItem {
  id: string;
  title: string;
  year: string;
  videoUrl: string;
  h264Url?: string;
  subtitles: { lang: string; url: string }[];
  chapters?: { start: number; end: number; title: string }[];
  audioChannels?: string;
  spatialAudio?: boolean;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bucket = context.env.movies;
    if (!bucket) {
      return new Response(JSON.stringify({ error: "BIO-001: R2 bucket binding missing" }), { status: 500, headers: corsHeaders });
    }

    const objects = await bucket.list();
    const moviesMap = new Map<string, MovieItem>();
    const folderNames = new Set<string>();

    for (const obj of objects.objects) {
      if (!obj.key.endsWith(".mp4") && !obj.key.endsWith(".mkv") && !obj.key.endsWith(".srt")) continue;
      const parts = obj.key.split('/');
      if (parts.length >= 2) folderNames.add(parts[0]);
    }

    const metadataPromises = Array.from(folderNames).map(async (folderName) => {
      const match = folderName.match(/^(.*?)\s*\((\d{4})\)$/);
      let title = folderName;
      let year = "";

      if (match) {
        title = match[1].trim();
        year = match[2];
      }

      const dbMeta = await getMovieMetadata(context.env.DB, folderName);
      
      moviesMap.set(folderName, {
        id: folderName,
        title,
        year,
        videoUrl: "",
        subtitles: [],
        chapters: dbMeta?.chapters,
        audioChannels: dbMeta?.audioChannels,
        spatialAudio: dbMeta?.spatialAudio
      });
    });

    await Promise.all(metadataPromises);

    for (const obj of objects.objects) {
      const parts = obj.key.split('/');
      if (parts.length < 2) continue;

      const folderName = parts[0];
      const movie = moviesMap.get(folderName);
      if (!movie) continue;

      const fileName = parts[1];
      const url = `${R2_CDN}/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;

      if (obj.key.endsWith(".mp4") || obj.key.endsWith(".mkv")) {
        if (fileName.includes(".h264.")) {
          movie.h264Url = url;
        } else {
          movie.videoUrl = url;
        }
      } else if (obj.key.endsWith(".srt")) {
        const langMatch = fileName.match(/\.([a-z]{2,3}(?:-[a-z]{2,4})?)\.srt$/i);
        const lang = langMatch ? langMatch[1] : "en";
        movie.subtitles.push({ lang, url });
      }
    }

    return new Response(JSON.stringify(Array.from(moviesMap.values())), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `BIO-500: ${message}` }), {
      status: 500,
      headers: corsHeaders
    });
  }
};

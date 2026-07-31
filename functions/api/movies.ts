import { getMovieMetadata, D1Database, getAdminSettings } from '../lib/db';
import { authenticateSession } from '../lib/auth';

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

    const finalMovies = Array.from(moviesMap.values());
    
    // Default Hero & Algorithmic Recommendation logic
    try {
      const { user } = await authenticateSession(context.request, context.env.DB);
      const adminSettings = await getAdminSettings(context.env.DB) as any;
      const defaultHero = adminSettings.defaultHero;
      const promotedWeights = adminSettings.promotedWeights || {};

      let targetHero = defaultHero;

      if (user && defaultHero) {
        const history = await context.env.DB.prepare(
          "SELECT completed, progress_seconds FROM user_watch_history WHERE user_id = ? AND movie_id = ?"
        ).bind(user.id, defaultHero).first<{ completed: number, progress_seconds: number }>();

        if (history && (history.completed === 1 || history.progress_seconds > 0)) {
          const query = `
            SELECT movie_id, 
                   COUNT(*) as watch_count, 
                   AVG(rating) as avg_rating, 
                   SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as completion_rate
            FROM user_watch_history 
            WHERE movie_id != ? AND movie_id NOT IN (SELECT movie_id FROM user_watch_history WHERE user_id = ?)
            GROUP BY movie_id
          `;
          const stats = await context.env.DB.prepare(query).bind(defaultHero, user.id).all();
          
          let bestScore = -1;
          let algorithmicHero = null;
          for (const row of stats.results as any[]) {
            const rawScore = (row.watch_count || 0) + ((row.avg_rating || 0) * 2) + ((row.completion_rate || 0) * 10);
            const multiplier = promotedWeights[row.movie_id] || 1;
            const finalScore = rawScore * multiplier;
            if (finalScore > bestScore) {
              bestScore = finalScore;
              algorithmicHero = row.movie_id;
            }
          }
          if (algorithmicHero) targetHero = algorithmicHero;
        }
      }

      if (targetHero) {
        const heroIndex = finalMovies.findIndex(m => m.id === targetHero);
        if (heroIndex > -1) {
          const [heroMovie] = finalMovies.splice(heroIndex, 1);
          finalMovies.unshift(heroMovie);
        }
      }
    } catch (e) {
      console.error("Hero selection error:", e);
    }

    return new Response(JSON.stringify(finalMovies), {
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

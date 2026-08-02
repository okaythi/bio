import { getMovieMetadata, D1Database, getAdminSettings } from '../lib/db';
import { authenticateSession } from '../lib/auth';

const R2_CDN = "/api/media";

export interface Env {
  movies: R2Bucket;
  DB: D1Database;
}

interface EpisodeItem {
  id: string;
  episodeNumber: number;
  seasonNumber: number;
  title: string;
  videoUrl: string;
  subtitles: { lang: string; url: string }[];
  isAvailable: boolean;
}

interface SeasonItem {
  seasonNumber: number;
  episodes: EpisodeItem[];
}

interface MovieItem {
  id: string;
  title: string;
  year: string;
  type?: 'movie' | 'tv';
  videoUrl: string;
  h264Url?: string;
  subtitles: { lang: string; url: string }[];
  seasons?: SeasonItem[];
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
        type: 'movie',
        videoUrl: "",
        subtitles: [],
        seasons: [],
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

      const tvMatch = fileName.match(/^S(\d{1,2})E(\d{1,2})(?:[-_\s](.*?))?\.(mp4|mkv|srt)$/i);

      if (tvMatch) {
        movie.type = 'tv';
        const seasonNum = parseInt(tvMatch[1], 10);
        const epNum = parseInt(tvMatch[2], 10);
        let rawEpTitle = tvMatch[3] ? tvMatch[3].trim() : `Episode ${epNum}`;
        const ext = tvMatch[4].toLowerCase();

        if (rawEpTitle && ext === 'srt') {
          rawEpTitle = rawEpTitle.replace(/\.(?:[a-z]{2,3}(?:-[a-z]{2,4})?)$/i, '').trim();
        }

        let season = movie.seasons!.find(s => s.seasonNumber === seasonNum);
        if (!season) {
          season = { seasonNumber: seasonNum, episodes: [] };
          movie.seasons!.push(season);
        }

        let ep = season.episodes.find(e => e.episodeNumber === epNum);
        if (!ep) {
          ep = {
            id: `s${seasonNum}e${epNum}`,
            episodeNumber: epNum,
            seasonNumber: seasonNum,
            title: rawEpTitle,
            videoUrl: '',
            subtitles: [],
            isAvailable: false
          };
          season.episodes.push(ep);
        }

        if (ext === 'mp4' || ext === 'mkv') {
          ep.videoUrl = url;
          ep.isAvailable = true;
          if (!movie.videoUrl) movie.videoUrl = url;
        } else if (ext === 'srt') {
          const langMatch = fileName.match(/\.([a-z]{2,3}(?:-[a-z]{2,4})?)\.srt$/i);
          const lang = langMatch ? langMatch[1] : "en";
          ep.subtitles.push({ lang, url });
        }
      } else {
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
    }

    for (const movie of moviesMap.values()) {
      if (movie.seasons && movie.seasons.length > 0) {
        movie.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
        for (const s of movie.seasons) {
          s.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
        }
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
        ).bind(user.id, defaultHero).first() as { completed: number, progress_seconds: number } | null;

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

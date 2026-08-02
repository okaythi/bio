import { getMovieMetadata, getAdminSettings, type D1Database } from '../lib/db';
import { authenticateSession } from '../lib/auth';
import type { R2Bucket } from '@cloudflare/workers-types';

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
    const listResult = await context.env.movies.list();
    const keys = listResult.objects.map((obj: { key: string }) => obj.key);

    const hasSpiritedAwayFolder = keys.some((k: string) => k.startsWith('Spirited Away (2001)/') || k.startsWith('movies/Spirited Away (2001)/'));
    const spirittedFolderPrefix = keys.some((k: string) => k.startsWith('movies/Spirited Away (2001)/')) ? 'movies/Spirited Away (2001)/' : 'Spirited Away (2001)/';

    const spiritedAwaySubtitles: { lang: string; url: string }[] = [];
    if (keys.includes(`${spirittedFolderPrefix}spirited_away.vtt`)) {
      spiritedAwaySubtitles.push({ lang: "en", url: `${R2_CDN}/${spirittedFolderPrefix}spirited_away.vtt` });
    }
    if (keys.includes(`${spirittedFolderPrefix}spirited_away_ja.vtt`)) {
      spiritedAwaySubtitles.push({ lang: "ja", url: `${R2_CDN}/${spirittedFolderPrefix}spirited_away_ja.vtt` });
    }
    if (keys.includes(`${spirittedFolderPrefix}spirited_away_vi.vtt`)) {
      spiritedAwaySubtitles.push({ lang: "vi", url: `${R2_CDN}/${spirittedFolderPrefix}spirited_away_vi.vtt` });
    }

    const { user } = await authenticateSession(context.request, context.env.DB);
    let isAdminUser = false;

    if (user && context.env.DB) {
      if (user.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590") {
        isAdminUser = true;
      } else {
        const flagRow = await context.env.DB.prepare(
          "SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'"
        ).bind(user.id).first<{ data_json: string }>();

        if (flagRow?.data_json) {
          try {
            const parsed = JSON.parse(flagRow.data_json);
            if (Array.isArray(parsed?.flags) && (parsed.flags.includes("is_staff") || parsed.flags.includes("edit_flags"))) {
              isAdminUser = true;
            }
          } catch {}
        }
      }
    }

    const dynamicMovies = await getMovieMetadata(context.env.DB, isAdminUser);
    const resultMovies: MovieItem[] = [];

    if (hasSpiritedAwayFolder) {
      const spiritedAwayMeta = dynamicMovies.find((m: { id: string }) => m.id === "spirited-away");
      resultMovies.push({
        id: "spirited-away",
        title: spiritedAwayMeta?.title || "Spirited Away",
        year: spiritedAwayMeta?.year || "2001",
        type: (spiritedAwayMeta?.type as 'movie' | 'tv') || "movie",
        videoUrl: `${R2_CDN}/${spirittedFolderPrefix}spirited_away.mp4`,
        h264Url: `${R2_CDN}/${spirittedFolderPrefix}spirited_away_h264.mp4`,
        subtitles: spiritedAwaySubtitles.length > 0 ? spiritedAwaySubtitles : [
          { lang: "en", url: `${R2_CDN}/${spirittedFolderPrefix}spirited_away.vtt` }
        ],
        chapters: spiritedAwayMeta?.chapters,
        audioChannels: spiritedAwayMeta?.audioChannels || "5.1 Surround",
        spatialAudio: spiritedAwayMeta?.spatialAudio ?? true
      });
    }

    const tvShowsMap = new Map<string, { meta: Record<string, unknown>; seasonsMap: Map<number, EpisodeItem[]> }>();

    for (const meta of dynamicMovies) {
      if (meta.id === "spirited-away" && hasSpiritedAwayFolder) continue;

      if (meta.type === 'tv' && meta.tvShowId) {
        let show = tvShowsMap.get(meta.tvShowId);
        if (!show) {
          show = {
            meta: {
              id: meta.tvShowId,
              title: meta.tvShowTitle || meta.title || meta.name,
              year: meta.year,
              type: 'tv',
              subtitles: [],
              audioChannels: meta.audioChannels,
              spatialAudio: meta.spatialAudio
            },
            seasonsMap: new Map()
          };
          tvShowsMap.set(meta.tvShowId, show);
        }

        const seasonNum = meta.seasonNumber || 1;
        let seasonEpisodes = show.seasonsMap.get(seasonNum);
        if (!seasonEpisodes) {
          seasonEpisodes = [];
          show.seasonsMap.set(seasonNum, seasonEpisodes);
        }

        const videoKey = meta.videoR2Key || meta.videoUrl;
        const videoUrl = videoKey ? (videoKey.startsWith('http') ? videoKey : `${R2_CDN}/${videoKey}`) : "";
        const isAvailable = Boolean(videoKey && (videoKey.startsWith('http') || keys.includes(videoKey)));

        const episodeSubtitles = (meta.subtitles || []).map((sub: { lang: string; url?: string }) => ({
          lang: sub.lang,
          url: sub.url ? (sub.url.startsWith('http') ? sub.url : `${R2_CDN}/${sub.url}`) : ""
        }));

        seasonEpisodes.push({
          id: meta.id,
          episodeNumber: meta.episodeNumber || seasonEpisodes.length + 1,
          seasonNumber: seasonNum,
          title: meta.title || meta.name || `Episode ${meta.episodeNumber || seasonEpisodes.length + 1}`,
          videoUrl,
          subtitles: episodeSubtitles,
          isAvailable
        });

      } else {
        const videoKey = meta.videoR2Key || meta.videoUrl;
        const videoUrl = videoKey ? (videoKey.startsWith('http') ? videoKey : `${R2_CDN}/${videoKey}`) : "";
        const h264Key = meta.h264R2Key || meta.h264Url;
        const h264Url = h264Key ? (h264Key.startsWith('http') ? h264Key : `${R2_CDN}/${h264Key}`) : undefined;

        const subtitles = (meta.subtitles || []).map((sub: { lang: string; url?: string }) => ({
          lang: sub.lang,
          url: sub.url ? (sub.url.startsWith('http') ? sub.url : `${R2_CDN}/${sub.url}`) : ""
        }));

        resultMovies.push({
          id: meta.id,
          title: meta.title || meta.name || 'Unknown Title',
          year: meta.year,
          type: (meta.type as 'movie' | 'tv') || 'movie',
          videoUrl,
          h264Url,
          subtitles,
          chapters: meta.chapters,
          audioChannels: meta.audioChannels,
          spatialAudio: meta.spatialAudio
        });
      }
    }

    for (const [_, show] of tvShowsMap) {
      const seasons: SeasonItem[] = [];
      const sortedSeasonsNums = Array.from(show.seasonsMap.keys()).sort((a, b) => a - b);
      
      for (const seasonNum of sortedSeasonsNums) {
        const episodes = show.seasonsMap.get(seasonNum) || [];
        episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
        seasons.push({
          seasonNumber: seasonNum,
          episodes
        });
      }

      const firstEpisode = seasons[0]?.episodes[0];
      const videoUrl = firstEpisode?.videoUrl || "";

      resultMovies.push({
        id: show.meta.id as string,
        title: show.meta.title as string,
        year: show.meta.year as string,
        type: show.meta.type as 'tv',
        subtitles: [],
        audioChannels: show.meta.audioChannels as string,
        spatialAudio: show.meta.spatialAudio as boolean,
        videoUrl,
        seasons
      });
    }

    const promotedWeights: Record<string, number> = {};
    if (context.env.DB) {
      try {
        const adminSettings = await getAdminSettings(context.env.DB);
        if (adminSettings.promotedWeights) {
          Object.assign(promotedWeights, adminSettings.promotedWeights);
        }
      } catch {}
    }

    return new Response(JSON.stringify({ movies: resultMovies, promotedWeights }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error: unknown) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};

const R2_CDN = "https://cdn.bio.sudothy.me";

export interface EpisodeMetadata {
  id: string;
  episodeNumber?: number;
  seasonNumber?: number;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl: string;
  h264Url?: string;
  subtitles?: { lang: string; url: string }[];
  chapters?: { start: number; end: number; title: string }[];
  hasIntro?: boolean;
  introStart?: number;
  introEnd?: number;
  isAvailable?: boolean;
}

export interface SeasonMetadata {
  seasonNumber: number;
  episodes: EpisodeMetadata[];
}

export interface MovieMetadata {
  id: string;
  type?: 'movie' | 'tv';
  videoUrl?: string;
  h264Url?: string;
  subtitles?: { lang: string; url: string }[];
  chapters?: { start: number; end: number; title: string }[];
  title: string;
  description?: string;
  thumbnailUrl?: string;
  year?: string;
  tmdbId?: number;
  hasIntro?: boolean;
  introStart?: number;
  introEnd?: number;
  audioChannels?: string;
  spatialAudio?: boolean;
  seasons?: SeasonMetadata[];
  isComingSoon?: boolean;
}

export const fetchLibrary = async (): Promise<MovieMetadata[]> => {
  const res = await fetch('/api/movies');
  if (!res.ok) throw new Error("BIO-005: Failed to fetch library from backend");
  
  const data = await res.json();
  const moviesList: MovieMetadata[] = Array.isArray(data) ? data : (data.movies || []);
  
  if (moviesList.length === 0) {
    return [{
      id: "Leviticus (2026)",
      videoUrl: `${R2_CDN}/${encodeURIComponent("Leviticus (2026)")}/${encodeURIComponent("Leviticus (1080p - 5.1).mp4")}`,
      subtitles: [{ lang: 'en', url: `${R2_CDN}/${encodeURIComponent("Leviticus (2026)")}/${encodeURIComponent("Leviticus (1080p - 5.1).srt")}` }],
      title: "Leviticus",
      year: "2026",
      hasIntro: false,
      audioChannels: "5.1"
    }];
  }
  
  return moviesList;
};

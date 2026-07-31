const TMDB_BASE_URL = "/api/tmdb";

const fetchConfig = {
  headers: {
    "Content-Type": "application/json",
  },
};

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  vote_average: number;
  runtime?: number;
  genres?: { id: number; name: string }[];
}

export interface TMDBVideo {
  key: string;
  site: string;
  type: string;
}

export const getMovieDetails = async (tmdbId: number): Promise<TMDBMovie> => {
  const res = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}`, fetchConfig);
  if (!res.ok) throw new Error("BIO-002: Failed to fetch movie details");
  return res.json();
};

export const getMovieVideos = async (tmdbId: number): Promise<TMDBVideo[]> => {
  const res = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}/videos`, fetchConfig);
  if (!res.ok) throw new Error("BIO-003: Failed to fetch movie videos");
  const data = await res.json();
  return data.results;
};

export const searchMovie = async (title: string, year: string): Promise<TMDBMovie | null> => {
  const query = encodeURIComponent(title);
  const yearParam = year ? `&year=${year}` : '';
  const res = await fetch(`${TMDB_BASE_URL}/search/movie?query=${query}${yearParam}`, fetchConfig);
  if (!res.ok) throw new Error("BIO-004: Failed to search movie");
  const data = await res.json();
  return data.results?.[0] || null;
};

export interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv' | 'person';
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  number_of_seasons?: number;
}

export const searchMulti = async (query: string): Promise<TMDBSearchResult[]> => {
  if (!query.trim()) return [];
  const q = encodeURIComponent(query);
  const res = await fetch(`${TMDB_BASE_URL}/search/multi?query=${q}`, fetchConfig);
  if (!res.ok) throw new Error("Failed to search TMDB");
  const data = await res.json();
  const results: TMDBSearchResult[] = data.results || [];
  
  return results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
};

export const getTVDetails = async (tmdbId: number) => {
  const res = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}`, fetchConfig);
  if (!res.ok) throw new Error("Failed to fetch TV details");
  return res.json();
};

export const getTVSeasonDetails = async (tmdbId: number, seasonNumber: number) => {
  const res = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}`, fetchConfig);
  if (!res.ok) throw new Error("Failed to fetch TV season details");
  return res.json();
};

export const getImageUrl = (path: string, size: "original" | "w500" = "original") => {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

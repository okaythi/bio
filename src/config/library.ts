const R2_CDN = "https://cdn.bio.sudothy.me";

export interface MovieMetadata {
  id: string;
  videoUrl: string;
  subtitleUrl?: string;
  title: string;
  year?: string;
  tmdbId?: number;
  hasIntro?: boolean;
  introStart?: number;
  introEnd?: number;
}

export const fetchLibrary = async (): Promise<MovieMetadata[]> => {
  const res = await fetch('/api/movies');
  if (!res.ok) throw new Error("BIO-005: Failed to fetch library from backend");
  
  const data = await res.json();
  
  if (data.length === 0) {
    return [{
      id: "Leviticus (2026)",
      videoUrl: `${R2_CDN}/${encodeURIComponent("Leviticus (2026)")}/${encodeURIComponent("Leviticus (1080p - 5.1).mp4")}`,
      subtitleUrl: `${R2_CDN}/${encodeURIComponent("Leviticus (2026)")}/${encodeURIComponent("Leviticus (1080p - 5.1).srt")}`,
      title: "Leviticus",
      year: "2026",
      hasIntro: false
    }];
  }
  
  return data;
};

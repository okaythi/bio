const R2_CDN = "/api/media";

export interface Env {
  movies: R2Bucket;
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

const SPIRITED_AWAY_CHAPTERS = [
  { start: 0, end: 419.294, title: "Opening Credits / The Middle of Nowhere" },
  { start: 419.294, end: 798.965, title: "It's Just A Dream" },
  { start: 798.965, end: 1227.56, title: "Finding Work At The Bathhouse" },
  { start: 1227.56, end: 1716.048, title: "Meeting Kamaji" },
  { start: 1716.048, end: 2088.086, title: "Sen's New Life" },
  { start: 2088.086, end: 2474.097, title: "Meeting Yubaba" },
  { start: 2474.097, end: 3095.509, title: "A Strange Visit To The Nursery" },
  { start: 3095.509, end: 3482.896, title: "We Have An Intruder" },
  { start: 3482.896, end: 3999.621, title: "Guardian of the Great River" },
  { start: 3999.621, end: 4600.137, title: "A Monster Called 'No Face'" },
  { start: 4600.137, end: 5094.84, title: "The Golden Seal" },
  { start: 5094.84, end: 5478.89, title: "The Train To Swamp Bottom" },
  { start: 5478.89, end: 5886.005, title: "Leaving the Bath House" },
  { start: 5886.005, end: 6318.729, title: "What Did You Do With My Baby!" },
  { start: 6318.729, end: 6913.907, title: "Finding The Way Home" },
  { start: 6913.907, end: 7253.000, title: "One Final Test" },
  { start: 7253.000, end: 7484.765, title: "End Credits" }
];

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

    // Pass 1: Scan video files and create movie entries with empty subtitles arrays
    for (const obj of objects.objects) {
      if (!obj.key.endsWith(".mp4") && !obj.key.endsWith(".mkv")) continue;

      const parts = obj.key.split('/');
      if (parts.length < 2) continue;

      const folderName = parts[0];
      const match = folderName.match(/^(.*?)\s*\((\d{4})\)$/);
      let title = folderName;
      let year = "";

      if (match) {
        title = match[1].trim();
        year = match[2];
      }

      const isSpirited = folderName.includes("Spirited Away") || title.includes("Spirited Away");
      const isLeviticus = folderName.includes("Leviticus") || title.includes("Leviticus");

      if (!moviesMap.has(folderName)) {
        moviesMap.set(folderName, {
          id: folderName,
          title,
          year,
          videoUrl: "",
          subtitles: [],
          chapters: isSpirited ? SPIRITED_AWAY_CHAPTERS : undefined,
          audioChannels: isSpirited ? "7.1" : (isLeviticus ? "5.1" : undefined),
          spatialAudio: isSpirited ? true : undefined
        });
      }

      const movie = moviesMap.get(folderName)!;
      const fileName = parts[1];
      const url = `${R2_CDN}/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;

      if (fileName.includes(".h264.")) {
        movie.h264Url = url;
      } else {
        movie.videoUrl = url;
      }
    }

    // Pass 2: Scan all objects for .srt files and populate subtitles arrays
    for (const obj of objects.objects) {
      if (!obj.key.endsWith(".srt")) continue;

      const parts = obj.key.split('/');
      if (parts.length < 2) continue;

      const folderName = parts[0];
      const movie = moviesMap.get(folderName);
      if (!movie) continue;

      const fileName = parts[1];
      const langMatch = fileName.match(/\.([a-z]{2,3}(?:-[a-z]{2,4})?)\.srt$/i);
      const lang = langMatch ? langMatch[1] : "en";

      movie.subtitles.push({
        lang,
        url: `${R2_CDN}/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`
      });
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

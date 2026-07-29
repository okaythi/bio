const R2_CDN = "https://cdn.bio.sudothy.me";

export interface Env {
  movies: R2Bucket;
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
    const moviesMap = new Map<string, any>();

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

      if (!moviesMap.has(folderName)) {
        const urlBase = `${R2_CDN}/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1].replace('.mp4', '').replace('.mkv', ''))}`;
        moviesMap.set(folderName, {
          id: folderName,
          title,
          year,
          videoUrl: `${R2_CDN}/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`,
          subtitleUrl: `${urlBase}.srt`
        });
      }
    }

    return new Response(JSON.stringify(Array.from(moviesMap.values())), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `BIO-500: ${error.message}` }), {
      status: 500,
      headers: corsHeaders
    });
  }
};

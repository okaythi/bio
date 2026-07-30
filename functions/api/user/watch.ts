export interface Env {
  DB: D1Database;
}

interface WatchHistoryDbRow {
  movie_id: string;
  progress_seconds: number;
  duration_seconds: number;
  completed: number;
  rating: number | null;
  last_watched_at: string;
}

interface WatchRequestBody {
  movieId?: string;
  movie_id?: string;
  progressSeconds?: number;
  progress_seconds?: number;
  durationSeconds?: number;
  duration_seconds?: number;
  completed?: boolean;
  toggleLike?: boolean;
}

async function getUserIdFromSession(context: EventContext<Env, string, Record<string, unknown>>): Promise<string | null> {
  const cookieHeader = context.request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  const sessionId = match ? match[1] : null;
  if (!sessionId) return null;

  const row = await context.env.DB.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP"
  ).bind(sessionId).first<{ user_id: string }>();

  return row ? row.user_id : null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const userId = await getUserIdFromSession(context);
  if (!userId) {
    return new Response(JSON.stringify({ history: [], likedMovies: [] }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const { results } = await context.env.DB.prepare(
    "SELECT movie_id, progress_seconds, duration_seconds, completed, rating, last_watched_at FROM user_watch_history WHERE user_id = ?"
  ).bind(userId).all<WatchHistoryDbRow>();

  const history = results || [];
  const likedMovies = history
    .filter((h) => h.rating === 5)
    .map((h) => h.movie_id);

  return new Response(JSON.stringify({ history, likedMovies }), {
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const userId = await getUserIdFromSession(context);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = (await context.request.json()) as WatchRequestBody;
    const movieId = body.movieId ?? body.movie_id;
    let progressSeconds = body.progressSeconds ?? body.progress_seconds;
    const durationSeconds = body.durationSeconds ?? body.duration_seconds;
    const completed = body.completed ? 1 : 0;
    const toggleLike = body.toggleLike;

    if (!movieId) {
      return new Response(JSON.stringify({ error: "movieId is required" }), { status: 400, headers: corsHeaders });
    }

    if (progressSeconds !== undefined && durationSeconds !== undefined && durationSeconds > 0) {
      if (progressSeconds < 0) progressSeconds = 0;
      if (progressSeconds > durationSeconds) progressSeconds = durationSeconds;
    }

    if (!movieId) {
      return new Response(JSON.stringify({ error: "movieId is required" }), { status: 400, headers: corsHeaders });
    }

    const existing = await context.env.DB.prepare(
      "SELECT id, rating, progress_seconds, last_watched_at FROM user_watch_history WHERE user_id = ? AND movie_id = ?"
    ).bind(userId, movieId).first<{ id: string; rating: number | null; progress_seconds: number; last_watched_at: string }>();

    // Mathematical Security: Temporal Bound Checking
    if (!toggleLike && existing && progressSeconds !== undefined && existing.progress_seconds !== undefined) {
      const now = new Date();
      const lastWatched = new Date(existing.last_watched_at + 'Z');
      const secondsSinceLastUpdate = (now.getTime() - lastWatched.getTime()) / 1000;
      
      // Allow max 2.5x speed playback + 15s buffer. Clamp if they exceed this.
      const maxAllowedProgress = existing.progress_seconds + (secondsSinceLastUpdate * 2.5) + 15;
      
      if (progressSeconds > existing.progress_seconds && progressSeconds > maxAllowedProgress) {
        progressSeconds = maxAllowedProgress;
        if (durationSeconds !== undefined && durationSeconds > 0 && progressSeconds > durationSeconds) {
          progressSeconds = durationSeconds;
        }
      }
    }

    let newRating = existing?.rating || null;
    if (toggleLike) {
      newRating = existing?.rating === 5 ? 0 : 5;
    }

    const watchId = existing?.id || crypto.randomUUID();

    await context.env.DB.prepare(`
      INSERT INTO user_watch_history (id, user_id, movie_id, progress_seconds, duration_seconds, completed, rating, last_watched_at)
      VALUES (?, ?, ?, COALESCE(?, 0), COALESCE(?, 0), ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        progress_seconds = CASE WHEN ? IS NOT NULL THEN ? ELSE progress_seconds END,
        duration_seconds = CASE WHEN ? IS NOT NULL THEN ? ELSE duration_seconds END,
        completed = COALESCE(excluded.completed, completed),
        rating = excluded.rating,
        watch_count = watch_count + 1,
        last_watched_at = CURRENT_TIMESTAMP
    `).bind(
      watchId, userId, movieId, progressSeconds ?? null, durationSeconds ?? null, completed, newRating,
      progressSeconds ?? null, progressSeconds ?? null,
      durationSeconds ?? null, durationSeconds ?? null
    ).run();

    return new Response(JSON.stringify({ success: true, isLiked: newRating === 5 }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Watch history update failed: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

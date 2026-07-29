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
  progressSeconds?: number;
  durationSeconds?: number;
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

  const userId = await getUserIdFromSession(context);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = (await context.request.json()) as WatchRequestBody;
    const { movieId, progressSeconds, durationSeconds, completed, toggleLike } = body || {};

    if (!movieId) {
      return new Response(JSON.stringify({ error: "movieId is required" }), { status: 400, headers: corsHeaders });
    }

    const existing = await context.env.DB.prepare(
      "SELECT id, rating FROM user_watch_history WHERE user_id = ? AND movie_id = ?"
    ).bind(userId, movieId).first<{ id: string; rating: number | null }>();

    let newRating = existing?.rating || null;
    if (toggleLike) {
      newRating = existing?.rating === 5 ? 0 : 5;
    }

    const watchId = existing?.id || crypto.randomUUID();

    await context.env.DB.prepare(`
      INSERT INTO user_watch_history (id, user_id, movie_id, progress_seconds, duration_seconds, completed, rating, last_watched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        progress_seconds = COALESCE(?, progress_seconds),
        duration_seconds = COALESCE(?, duration_seconds),
        completed = COALESCE(?, completed),
        rating = ?,
        watch_count = watch_count + 1,
        last_watched_at = CURRENT_TIMESTAMP
    `).bind(
      watchId, userId, movieId, progressSeconds || 0, durationSeconds || 0, completed ? 1 : 0, newRating,
      progressSeconds, durationSeconds, completed ? 1 : 0, newRating
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

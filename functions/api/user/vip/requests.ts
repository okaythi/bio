import { authenticateSession } from '../../../lib/auth';
import { getUserVipStatus, D1Database } from '../../../lib/db';

export interface Env {
  DB: D1Database;
}

interface RequestBody {
  imdbId?: string;
  title?: string;
  year?: string;
  posterUrl?: string;
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

  const { results: requests } = await context.env.DB.prepare(`
    SELECT r.*, u.email as requester_email, p.display_name as requester_name
    FROM vip_title_requests r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN user_profiles p ON r.user_id = p.user_id
    ORDER BY r.votes DESC, r.created_at DESC
    LIMIT 50
  `).all();

  return new Response(JSON.stringify({ requests }), {
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

  const { user, error } = await authenticateSession(context.request, context.env.DB);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized: Please log in." }), { status: 401, headers: corsHeaders });
  }

  const vipInfo = await getUserVipStatus(context.env.DB, user.id);
  if (!vipInfo.isVip) {
    return new Response(JSON.stringify({ error: "Forbidden: Title request suggestions are exclusive to VIP members." }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = (await context.request.json()) as RequestBody;
    const { imdbId, title, year, posterUrl } = body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return new Response(JSON.stringify({ error: "Title is required." }), { status: 400, headers: corsHeaders });
    }

    const cleanTitle = title.trim();

    // Check if title request already exists
    const existing = await context.env.DB.prepare(
      "SELECT id, votes FROM vip_title_requests WHERE LOWER(title) = LOWER(?)"
    ).bind(cleanTitle).first<{ id: string; votes: number }>();

    if (existing) {
      // Upvote existing request!
      await context.env.DB.prepare(
        "UPDATE vip_title_requests SET votes = votes + 1 WHERE id = ?"
      ).bind(existing.id).run();

      return new Response(JSON.stringify({
        success: true,
        message: `Upvoted existing request for "${cleanTitle}"! Current priority votes: ${existing.votes + 1}`,
        votes: existing.votes + 1
      }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const requestId = crypto.randomUUID();
    await context.env.DB.prepare(`
      INSERT INTO vip_title_requests (id, user_id, imdb_id, title, year, poster_url, votes, status)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'pending')
    `).bind(requestId, user.id, imdbId || null, cleanTitle, year || null, posterUrl || null).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Priority request for "${cleanTitle}" submitted to platform curators!`,
      requestId
    }), { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Request submission error: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

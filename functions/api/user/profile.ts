export interface Env {
  DB: D1Database;
}

interface ProfileRequestBody {
  displayName?: string;
  display_name?: string;
  avatarUrl?: string;
  avatar_url?: string;
  locale?: string;
  timezone?: string;
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

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
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
    const body = (await context.request.json()) as ProfileRequestBody;
    const displayName = body.displayName ?? body.display_name ?? null;
    const avatarUrl = body.avatarUrl ?? body.avatar_url ?? null;
    const locale = body.locale ?? null;
    const timezone = body.timezone ?? null;

    await context.env.DB.prepare(`
      INSERT INTO user_profiles (user_id, display_name, avatar_url, locale, timezone)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = COALESCE(excluded.display_name, display_name),
        avatar_url = COALESCE(excluded.avatar_url, avatar_url),
        locale = COALESCE(excluded.locale, locale),
        timezone = COALESCE(excluded.timezone, timezone)
    `).bind(
      userId, displayName, avatarUrl, locale, timezone
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Profile update failed: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

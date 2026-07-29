export interface Env {
  DB: D1Database;
}

interface PreferencesRequestBody {
  theme?: string;
  defaultAudioLang?: string;
  defaultSubtitleLang?: string;
  autoPlayNext?: boolean;
  playerVolume?: number;
  uiSettingsJson?: Record<string, unknown>;
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
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const userId = await getUserIdFromSession(context);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const prefs = await context.env.DB.prepare(
    "SELECT * FROM user_preferences WHERE user_id = ?"
  ).bind(userId).first();

  return new Response(JSON.stringify({ preferences: prefs }), {
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const userId = await getUserIdFromSession(context);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = (await context.request.json()) as PreferencesRequestBody;
    const { theme, defaultAudioLang, defaultSubtitleLang, autoPlayNext, playerVolume, uiSettingsJson } = body || {};

    await context.env.DB.prepare(`
      INSERT INTO user_preferences (user_id, theme, default_audio_lang, default_subtitle_lang, auto_play_next, player_volume, ui_settings_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = COALESCE(?, theme),
        default_audio_lang = COALESCE(?, default_audio_lang),
        default_subtitle_lang = COALESCE(?, default_subtitle_lang),
        auto_play_next = COALESCE(?, auto_play_next),
        player_volume = COALESCE(?, player_volume),
        ui_settings_json = COALESCE(?, ui_settings_json)
    `).bind(
      userId, theme, defaultAudioLang, defaultSubtitleLang, autoPlayNext, playerVolume, uiSettingsJson ? JSON.stringify(uiSettingsJson) : '{}',
      theme, defaultAudioLang, defaultSubtitleLang, autoPlayNext, playerVolume, uiSettingsJson ? JSON.stringify(uiSettingsJson) : null
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Update failed: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

export interface Env {
  DB: D1Database;
}

interface PreferencesRequestBody {
  theme?: string;
  defaultAudioLang?: string;
  default_audio_lang?: string;
  defaultSubtitleLang?: string;
  default_subtitle_lang?: string;
  autoPlayNext?: boolean;
  auto_play_next?: boolean;
  playerVolume?: number;
  player_volume?: number;
  uiSettingsJson?: Record<string, unknown>;
  ui_settings_json?: Record<string, unknown>;
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

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const userId = await getUserIdFromSession(context);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = (await context.request.json()) as PreferencesRequestBody;
    const theme = body.theme ?? null;
    const defaultAudioLang = body.defaultAudioLang ?? body.default_audio_lang ?? null;
    const defaultSubtitleLang = body.defaultSubtitleLang ?? body.default_subtitle_lang ?? null;
    
    const rawAutoPlay = body.autoPlayNext ?? body.auto_play_next;
    const autoPlayNext = rawAutoPlay !== undefined ? (rawAutoPlay ? 1 : 0) : null;
    
    const playerVolume = body.playerVolume ?? body.player_volume ?? null;
    const rawUiSettings = body.uiSettingsJson ?? body.ui_settings_json;
    const uiSettingsJson = rawUiSettings ? JSON.stringify(rawUiSettings) : null;

    await context.env.DB.prepare(`
      INSERT INTO user_preferences (user_id, theme, default_audio_lang, default_subtitle_lang, auto_play_next, player_volume, ui_settings_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = COALESCE(excluded.theme, theme),
        default_audio_lang = COALESCE(excluded.default_audio_lang, default_audio_lang),
        default_subtitle_lang = COALESCE(excluded.default_subtitle_lang, default_subtitle_lang),
        auto_play_next = COALESCE(excluded.auto_play_next, auto_play_next),
        player_volume = COALESCE(excluded.player_volume, player_volume),
        ui_settings_json = COALESCE(excluded.ui_settings_json, ui_settings_json)
    `).bind(
      userId,
      theme,
      defaultAudioLang,
      defaultSubtitleLang,
      autoPlayNext,
      playerVolume,
      uiSettingsJson
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

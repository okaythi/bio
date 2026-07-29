export interface Env {
  DB: D1Database;
}

export const KNOWN_FLAGS = ["is_staff", "edit_flags", "vip", "moderator"];

interface FlagsRequestBody {
  targetUserId?: string;
  flags?: string[];
}

interface FlagsRow {
  flags?: string[];
}

async function getCallerInfo(context: EventContext<Env, string, Record<string, unknown>>): Promise<{ userId: string; email: string; flags: string[] } | null> {
  const cookieHeader = context.request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  const sessionId = match ? match[1] : null;
  if (!sessionId) return null;

  const row = await context.env.DB.prepare(`
    SELECT users.id, users.email 
    FROM sessions 
    JOIN users ON sessions.user_id = users.id 
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP
  `).bind(sessionId).first<{ id: string; email: string }>();

  if (!row) return null;

  const flagsRow = await context.env.DB.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'"
  ).bind(row.id).first<{ data_json: string }>();

  let flags: string[] = [];
  if (flagsRow?.data_json) {
    try {
      const parsed = JSON.parse(flagsRow.data_json) as FlagsRow;
      if (Array.isArray(parsed.flags)) flags = parsed.flags;
    } catch (e) {}
  }

  // Hardcode thy as super staff / edit_flags
  if (row.email.toLowerCase().includes("thy") || row.id === "thy-master-id") {
    if (!flags.includes("is_staff")) flags.push("is_staff");
    if (!flags.includes("edit_flags")) flags.push("edit_flags");
  }

  return { userId: row.id, email: row.email, flags };
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

  const caller = await getCallerInfo(context);
  if (!caller) {
    return new Response(JSON.stringify({ flags: [] }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  return new Response(JSON.stringify({ flags: caller.flags }), {
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

  const caller = await getCallerInfo(context);
  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  // Check if caller has edit_flags permission
  if (!caller.flags.includes("edit_flags")) {
    return new Response(JSON.stringify({ error: "Forbidden: You require the 'edit_flags' permission flag." }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = (await context.request.json()) as FlagsRequestBody;
    const targetUserId = body.targetUserId || caller.userId;
    const requestedFlags = Array.isArray(body.flags) ? body.flags : [];

    // Filter invalid flags
    const cleanFlags = Array.from(new Set(requestedFlags.filter(f => KNOWN_FLAGS.includes(f))));

    // Protect caller from removing their own is_staff or edit_flags
    if (targetUserId === caller.userId) {
      if (caller.flags.includes("is_staff") && !cleanFlags.includes("is_staff")) {
        cleanFlags.push("is_staff");
      }
      if (caller.flags.includes("edit_flags") && !cleanFlags.includes("edit_flags")) {
        cleanFlags.push("edit_flags");
      }
    }

    const dataJson = JSON.stringify({ flags: cleanFlags, updated_at: new Date().toISOString() });

    await context.env.DB.prepare(`
      INSERT INTO user_metadata_ext (user_id, namespace, data_json)
      VALUES (?, 'flags', ?)
      ON CONFLICT(user_id, namespace) DO UPDATE SET data_json = excluded.data_json
    `).bind(targetUserId, dataJson).run();

    return new Response(JSON.stringify({ success: true, targetUserId, flags: cleanFlags }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Flag update failed: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

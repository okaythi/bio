export interface Env {
  DB: D1Database;
}

interface UserListItem {
  id: string;
  email: string;
  display_name: string | null;
  flags: string[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cookieHeader = context.request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  const sessionId = match ? match[1] : null;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const caller = await context.env.DB.prepare(`
    SELECT users.id, users.email 
    FROM sessions 
    JOIN users ON sessions.user_id = users.id 
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP
  `).bind(sessionId).first<{ id: string; email: string }>();

  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const flagsRow = await context.env.DB.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'"
  ).bind(caller.id).first<{ data_json: string }>();

  let callerFlags: string[] = [];
  if (flagsRow?.data_json) {
    try {
      const parsed = JSON.parse(flagsRow.data_json);
      if (Array.isArray(parsed.flags)) callerFlags = parsed.flags;
    } catch (e) {}
  }
  const lowerCallerEmail = caller.email.toLowerCase();
  if (lowerCallerEmail.includes("thy") || lowerCallerEmail.includes("mathyschepers")) {
    if (!callerFlags.includes("is_staff")) callerFlags.push("is_staff");
    if (!callerFlags.includes("edit_flags")) callerFlags.push("edit_flags");
  }

  if (!callerFlags.includes("is_staff") && !callerFlags.includes("edit_flags")) {
    return new Response(JSON.stringify({ error: "Forbidden: Staff access required" }), { status: 403, headers: corsHeaders });
  }

  const { results: users } = await context.env.DB.prepare(`
    SELECT users.id, users.email, user_profiles.display_name
    FROM users
    LEFT JOIN user_profiles ON users.id = user_profiles.user_id
    LIMIT 100
  `).all<{ id: string; email: string; display_name: string | null }>();

  const userList: UserListItem[] = [];
  for (const u of (users || [])) {
    const userFlagsRow = await context.env.DB.prepare(
      "SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'"
    ).bind(u.id).first<{ data_json: string }>();

    let uFlags: string[] = [];
    if (userFlagsRow?.data_json) {
      try {
        const parsed = JSON.parse(userFlagsRow.data_json);
        if (Array.isArray(parsed.flags)) uFlags = parsed.flags;
      } catch (e) {}
    }

    const lowerUEmail = u.email.toLowerCase();
    if (lowerUEmail.includes("thy") || lowerUEmail.includes("mathyschepers")) {
      if (!uFlags.includes("is_staff")) uFlags.push("is_staff");
      if (!uFlags.includes("edit_flags")) uFlags.push("edit_flags");
    }

    userList.push({
      id: u.id,
      email: u.email,
      display_name: u.display_name || (lowerUEmail.includes("mathyschepers") ? "thy" : u.email.split('@')[0]),
      flags: uFlags
    });
  }

  return new Response(JSON.stringify({ users: userList }), {
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
};

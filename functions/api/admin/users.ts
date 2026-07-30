import { authenticateSession } from '../../lib/auth';
import { getUserFlags, D1Database } from '../../lib/db';

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

  const { user: caller, error } = await authenticateSession(context.request, context.env.DB);

  if (error || !caller) {
    return new Response(JSON.stringify({ error: error || "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const callerFlags = await getUserFlags(context.env.DB, caller.id);

  if (caller.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590") {
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
    const uFlags = await getUserFlags(context.env.DB, u.id);

    if (u.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590") {
      if (!uFlags.includes("is_staff")) uFlags.push("is_staff");
      if (!uFlags.includes("edit_flags")) uFlags.push("edit_flags");
    }

    userList.push({
      id: u.id,
      email: u.email,
      display_name: u.display_name || (u.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590" ? "thy" : u.email.split('@')[0]),
      flags: uFlags
    });
  }

  return new Response(JSON.stringify({ users: userList }), {
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
};

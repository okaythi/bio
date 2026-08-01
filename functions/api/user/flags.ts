import { authenticateSession } from '../../lib/auth';
import { getUserFlags, setUserMetadataExt, D1Database } from '../../lib/db';

export interface Env {
  DB: D1Database;
}

export const KNOWN_FLAGS = ["is_staff", "edit_flags", "vip", "moderator"];

interface FlagsRequestBody {
  targetUserId?: string;
  flags?: string[];
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

  const { user, error } = await authenticateSession(context.request, context.env.DB);
  if (error || !user) {
    return new Response(JSON.stringify({ flags: [] }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  const flags = await getUserFlags(context.env.DB, user.id);

  if (user.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590") {
    if (!flags.includes("is_staff")) flags.push("is_staff");
    if (!flags.includes("edit_flags")) flags.push("edit_flags");
  }

  return new Response(JSON.stringify({ flags }), {
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

  const { user, error } = await authenticateSession(context.request, context.env.DB);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const callerFlags = await getUserFlags(context.env.DB, user.id);
  if (user.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590") {
    if (!callerFlags.includes("is_staff")) callerFlags.push("is_staff");
    if (!callerFlags.includes("edit_flags")) callerFlags.push("edit_flags");
  }

  if (!callerFlags.includes("edit_flags")) {
    return new Response(JSON.stringify({ error: "Forbidden: You require the 'edit_flags' permission flag." }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = (await context.request.json()) as FlagsRequestBody;
    const targetUserId = body.targetUserId || user.id;
    const requestedFlags = Array.isArray(body.flags) ? body.flags : [];

    const cleanFlags = Array.from(new Set(requestedFlags.filter(f => KNOWN_FLAGS.includes(f))));

    if (targetUserId === user.id) {
      if (callerFlags.includes("is_staff") && !cleanFlags.includes("is_staff")) {
        cleanFlags.push("is_staff");
      }
      if (callerFlags.includes("edit_flags") && !cleanFlags.includes("edit_flags")) {
        cleanFlags.push("edit_flags");
      }
    }

    await setUserMetadataExt(context.env.DB, targetUserId, 'flags', { flags: cleanFlags, updated_at: new Date().toISOString() });

    if (cleanFlags.includes("vip")) {
      const currentSub = await context.env.DB.prepare(
        "SELECT expires_at FROM user_subscriptions WHERE user_id = ?"
      ).bind(targetUserId).first<{ expires_at?: string }>();

      let expDate = currentSub?.expires_at;
      if (!expDate || new Date(expDate) < new Date()) {
        expDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      await context.env.DB.prepare(`
        INSERT INTO user_subscriptions (user_id, plan_tier, status, expires_at, updated_at)
        VALUES (?, 'vip_gold', 'active', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET plan_tier = 'vip_gold', status = 'active', expires_at = excluded.expires_at, updated_at = CURRENT_TIMESTAMP
      `).bind(targetUserId, expDate).run();
    } else {
      await context.env.DB.prepare(`
        INSERT INTO user_subscriptions (user_id, plan_tier, status, expires_at, updated_at)
        VALUES (?, 'free', 'active', NULL, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET plan_tier = 'free', status = 'active', expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      `).bind(targetUserId).run();
    }

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

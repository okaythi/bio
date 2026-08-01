import { authenticateSession } from '../../../lib/auth';
import { getUserFlags, D1Database } from '../../../lib/db';

export interface Env {
  DB: D1Database;
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

  const { user, error } = await authenticateSession(context.request, context.env.DB);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const flags = await getUserFlags(context.env.DB, user.id);
  const isOwner = user.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590";
  if (!isOwner && !flags.includes("is_staff")) {
    return new Response(JSON.stringify({ error: "Forbidden: Staff access required." }), { status: 403, headers: corsHeaders });
  }

  const { results: codes } = await context.env.DB.prepare(
    "SELECT * FROM vip_promo_codes ORDER BY created_at DESC LIMIT 100"
  ).all();

  return new Response(JSON.stringify({ codes }), {
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const flags = await getUserFlags(context.env.DB, user.id);
  const isOwner = user.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590";
  if (!isOwner && !flags.includes("is_staff")) {
    return new Response(JSON.stringify({ error: "Forbidden: Staff access required." }), { status: 403, headers: corsHeaders });
  }

  try {
    const body = await context.request.json<any>();
    const prefix = body?.prefix || "VIP";
    const durationDays = parseInt(body?.durationDays || 30, 10);
    const maxUses = parseInt(body?.maxUses || 1, 10);

    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `${prefix}-${randomPart}`;

    await context.env.DB.prepare(
      "INSERT INTO vip_promo_codes (code, duration_days, max_uses) VALUES (?, ?, ?)"
    ).bind(code, durationDays, maxUses).run();

    return new Response(JSON.stringify({ success: true, code, durationDays, maxUses }), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
};

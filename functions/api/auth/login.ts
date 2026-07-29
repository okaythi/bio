import { verifyPassword } from "./_crypto";

export interface Env {
  DB: D1Database;
}

interface LoginRequestBody {
  email?: string;
  password?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await context.request.json()) as LoginRequestBody;
    const { email, password } = body || {};

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await context.env.DB.prepare(
      "SELECT id, email, password_hash, salt, role, status FROM users WHERE email = ?"
    ).bind(cleanEmail).first<{ id: string; email: string; password_hash: string; salt: string; role: string; status: string }>();

    if (!user || user.status !== "active") {
      return new Response(JSON.stringify({ error: "Invalid email or password." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const isValid = await verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid email or password." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const clientIp = context.request.headers.get("CF-Connecting-IP") || context.request.headers.get("x-forwarded-for") || "";
    const userAgent = context.request.headers.get("User-Agent") || "";

    await context.env.DB.prepare(
      "INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(sessionId, user.id, clientIp, userAgent, expiresAt).run();

    const profile = await context.env.DB.prepare(
      "SELECT display_name, avatar_url, locale, timezone FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first();

    const subscription = await context.env.DB.prepare(
      "SELECT plan_tier, status FROM user_subscriptions WHERE user_id = ?"
    ).bind(user.id).first();

    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders
    });

    responseHeaders.append(
      "Set-Cookie",
      `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
    );

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile,
          subscription
        }
      }),
      { headers: responseHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Login failed: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

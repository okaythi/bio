import { hashPassword } from "./_crypto";
import { verifyTurnstile } from "../_turnstile";

export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET: string;
}

interface RegisterRequestBody {
  email?: string;
  password?: string;
  displayName?: string;
  cfTurnstileResponse?: string;
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
    const body = (await context.request.json()) as RegisterRequestBody;
    const { email, password, displayName, cfTurnstileResponse } = body || {};

    const clientIp = context.request.headers.get("CF-Connecting-IP") || context.request.headers.get("x-forwarded-for") || "";
    const isHuman = await verifyTurnstile(cfTurnstileResponse, context.env.TURNSTILE_SECRET, clientIp);
    if (!isHuman) {
      return new Response(JSON.stringify({ error: "Invalid bot verification." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Email and password are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters long." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!/[A-Z]/.test(password)) {
      return new Response(JSON.stringify({ error: "Password must contain at least 1 uppercase letter." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!/[0-9]/.test(password)) {
      return new Response(JSON.stringify({ error: "Password must contain at least 1 number." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return new Response(JSON.stringify({ error: "Password must contain at least 1 special character." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { hash, salt } = await hashPassword(password);
    const userId = crypto.randomUUID();

    await context.env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, salt) VALUES (?, ?, ?, ?)"
    ).bind(userId, cleanEmail, hash, salt).run();

    await context.env.DB.prepare(
      "INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)"
    ).bind(userId, displayName || cleanEmail.split('@')[0]).run();

    await context.env.DB.prepare(
      "INSERT INTO user_subscriptions (user_id, plan_tier, status) VALUES (?, 'free', 'active')"
    ).bind(userId).run();

    await context.env.DB.prepare(
      "INSERT INTO user_preferences (user_id) VALUES (?)"
    ).bind(userId).run();

    await context.env.DB.prepare(
      "INSERT INTO notification_preferences (user_id) VALUES (?)"
    ).bind(userId).run();

    const defaultExpJson = JSON.stringify({ EXPERIMENTS: ["2026-07_public_beta_v1", "2026-07_auto_play_next_video"], created_at: new Date().toISOString() });
    await context.env.DB.prepare(
      "INSERT INTO user_metadata_ext (user_id, namespace, data_json) VALUES (?, 'experiments', ?)"
    ).bind(userId, defaultExpJson).run();

    return new Response(JSON.stringify({ success: true, userId, email: cleanEmail }), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE constraint failed")) {
      return new Response(JSON.stringify({ error: "An account with this email already exists." }), {
        status: 409,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    return new Response(JSON.stringify({ error: `Registration error: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

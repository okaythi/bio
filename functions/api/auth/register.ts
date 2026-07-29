import { hashPassword } from "./_crypto";

export interface Env {
  DB: D1Database;
}

interface RegisterRequestBody {
  email?: string;
  password?: string;
  displayName?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const body = (await context.request.json()) as RegisterRequestBody;
    const { email, password, displayName } = body || {};

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Email and password are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters long." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const { hash, salt } = await hashPassword(password);
    const userId = crypto.randomUUID();

    // 1. Insert into users table
    await context.env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, salt) VALUES (?, ?, ?, ?)"
    ).bind(userId, cleanEmail, hash, salt).run();

    // 2. Initialize default profile
    await context.env.DB.prepare(
      "INSERT INTO user_profiles (user_id, display_name) VALUES (?, ?)"
    ).bind(userId, displayName || cleanEmail.split('@')[0]).run();

    // 3. Initialize default subscription (free)
    await context.env.DB.prepare(
      "INSERT INTO user_subscriptions (user_id, plan_tier, status) VALUES (?, 'free', 'active')"
    ).bind(userId).run();

    // 4. Initialize default preferences
    await context.env.DB.prepare(
      "INSERT INTO user_preferences (user_id) VALUES (?)"
    ).bind(userId).run();

    // 5. Initialize default notification preferences
    await context.env.DB.prepare(
      "INSERT INTO notification_preferences (user_id) VALUES (?)"
    ).bind(userId).run();

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

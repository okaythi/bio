import { authenticateSession } from '../../../lib/auth';
import { type D1Database } from '../../../lib/db';

export interface Env {
  DB: D1Database;
}

interface RedeemRequestBody {
  code?: string;
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

  const { user, error } = await authenticateSession(context.request, context.env.DB);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized: Please log in to redeem VIP code." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = (await context.request.json()) as RedeemRequestBody;
    const rawCode = body?.code;
    if (!rawCode || typeof rawCode !== 'string') {
      return new Response(JSON.stringify({ error: "VIP code is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const cleanCode = rawCode.trim().toUpperCase();

    const promo = await context.env.DB.prepare(
      "SELECT * FROM vip_promo_codes WHERE UPPER(code) = ?"
    ).bind(cleanCode).first<{ code: string; plan_tier: string; duration_days: number; max_uses: number; current_uses: number; expires_at?: string }>();

    if (!promo) {
      return new Response(JSON.stringify({ error: "Invalid VIP pass key." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This VIP pass key has expired." }), {
        status: 410,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (promo.max_uses > 0 && promo.current_uses >= promo.max_uses) {
      return new Response(JSON.stringify({ error: "This VIP pass key has reached its maximum redemptions." }), {
        status: 410,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const previousRedemption = await context.env.DB.prepare(
      "SELECT 1 FROM vip_code_redemptions WHERE code = ? AND user_id = ?"
    ).bind(promo.code, user.id).first();

    if (previousRedemption) {
      return new Response(JSON.stringify({ error: "You have already redeemed this VIP pass key." }), {
        status: 409,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const durationDays = promo.duration_days || 30;
    const planTier = promo.plan_tier || 'vip_silver';
    const currentSub = await context.env.DB.prepare(
      "SELECT expires_at, plan_tier FROM user_subscriptions WHERE user_id = ?"
    ).bind(user.id).first<{ expires_at?: string; plan_tier?: string }>();

    let startDate = new Date();
    if (currentSub?.expires_at && new Date(currentSub.expires_at) > new Date()) {
      startDate = new Date(currentSub.expires_at);
    }

    const newExpiresAt = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    await context.env.DB.prepare(`
      INSERT INTO user_subscriptions (user_id, plan_tier, status, expires_at, updated_at)
      VALUES (?, ?, 'active', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET plan_tier = excluded.plan_tier, status = 'active', expires_at = excluded.expires_at, updated_at = CURRENT_TIMESTAMP
    `).bind(user.id, planTier, newExpiresAt).run();

    const redemptionId = crypto.randomUUID();
    await context.env.DB.batch([
      context.env.DB.prepare(
        "INSERT INTO vip_code_redemptions (id, code, user_id) VALUES (?, ?, ?)"
      ).bind(redemptionId, promo.code, user.id),
      context.env.DB.prepare(
        "UPDATE vip_promo_codes SET current_uses = current_uses + 1 WHERE code = ?"
      ).bind(promo.code)
    ]);

    return new Response(JSON.stringify({
      success: true,
      message: `VIP Activated! ${durationDays} days added to your subscription.`,
      durationDays,
      expiresAt: newExpiresAt
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Redemption error: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

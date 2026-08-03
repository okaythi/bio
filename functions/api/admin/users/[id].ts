import type { D1Database } from '../../../lib/db';

export interface Env {
  DB: D1Database;
}

interface UserUpdateBody {
  user?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  subscription?: { plan_tier?: string; [key: string]: unknown };
  metadata?: { namespace: string; data_json: string }[];
}

export const onRequestGet: PagesFunction<Env, 'id'> = async (context) => {
  try {
    const userId = context.params.id as string;
    const db = context.env.DB;

    const [
      user,
      profile,
      subscription,
      preferences,
      notifications,
      metadata,
      sessions,
      devices
    ] = await Promise.all([
      db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first(),
      db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").bind(userId).first(),
      db.prepare("SELECT * FROM user_subscriptions WHERE user_id = ?").bind(userId).first(),
      db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").bind(userId).first(),
      db.prepare("SELECT * FROM notification_preferences WHERE user_id = ?").bind(userId).first(),
      db.prepare("SELECT namespace, data_json FROM user_metadata_ext WHERE user_id = ?").bind(userId).all(),
      db.prepare("SELECT * FROM sessions WHERE user_id = ?").bind(userId).all(),
      db.prepare("SELECT * FROM user_devices WHERE user_id = ?").bind(userId).all()
    ]);

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found." }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      user,
      profile,
      subscription,
      preferences,
      notifications,
      metadata: metadata.results,
      sessions: sessions.results,
      devices: devices.results
    }), { headers: { "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

const ALLOWED_USER_FIELDS = new Set(['email', 'role', 'status']);
const ALLOWED_PROFILE_FIELDS = new Set(['display_name', 'avatar_url', 'bio', 'locale', 'timezone']);
const ALLOWED_SUB_FIELDS = new Set(['plan_tier', 'status', 'expires_at']);

const SAFE_IDENTIFIER_REGEX = /^[a-z_]+$/i;
const NAMESPACE_REGEX = /^[a-z0-9_-]{1,64}$/i;

export const onRequestPut: PagesFunction<Env, 'id'> = async (context) => {
  const userId = context.params.id as string;
  const db = context.env.DB;
  
  try {
    const body = await context.request.json<UserUpdateBody>();
    
    // Tier 1 & Tier 2 & Tier 3 for body.user
    if (body.user && typeof body.user === 'object') {
      const updates: string[] = [];
      const values: unknown[] = [];
      
      for (const [k, v] of Object.entries(body.user)) {
        // Tier 1: Allowlist check
        if (!ALLOWED_USER_FIELDS.has(k)) continue;
        // Tier 3: Strict Identifier Regex Check
        if (!SAFE_IDENTIFIER_REGEX.test(k)) continue;
        
        // Tier 2: Value Sanitization
        if (k === 'role' && typeof v === 'string') {
          if (!['user', 'admin'].includes(v)) throw new Error('Invalid user role');
        } else if (k === 'status' && typeof v === 'string') {
          if (!['active', 'suspended', 'deleted'].includes(v)) throw new Error('Invalid user status');
        } else if (k === 'email' && typeof v === 'string') {
          if (v.length > 255 || !v.includes('@')) throw new Error('Invalid email address');
        }

        updates.push(`${k} = ?`);
        values.push(v);
      }
      
      if (updates.length > 0) {
        await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values, userId).run();
      }
    }

    // Tier 1 & Tier 2 & Tier 3 for body.profile
    if (body.profile && typeof body.profile === 'object') {
      const updates: string[] = [];
      const values: unknown[] = [];
      
      for (const [k, v] of Object.entries(body.profile)) {
        // Tier 1: Allowlist check
        if (!ALLOWED_PROFILE_FIELDS.has(k)) continue;
        // Tier 3: Strict Identifier Regex Check
        if (!SAFE_IDENTIFIER_REGEX.test(k)) continue;
        
        // Tier 2: Value Sanitization
        if (typeof v === 'string' && v.length > 2000) {
          throw new Error(`Profile field ${k} exceeds maximum length`);
        }

        updates.push(`${k} = ?`);
        values.push(v);
      }
      
      if (updates.length > 0) {
        await db.prepare(`UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = ?`).bind(...values, userId).run();
      }
    }

    // Tier 1 & Tier 2 & Tier 3 for body.subscription
    if (body.subscription && typeof body.subscription === 'object') {
      const updates: string[] = [];
      const values: unknown[] = [];
      
      const filteredKeys: string[] = [];
      const filteredVals: unknown[] = [];

      for (const [k, v] of Object.entries(body.subscription)) {
        // Tier 1: Allowlist check
        if (!ALLOWED_SUB_FIELDS.has(k)) continue;
        // Tier 3: Strict Identifier Regex Check
        if (!SAFE_IDENTIFIER_REGEX.test(k)) continue;

        // Tier 2: Value Sanitization
        if (k === 'plan_tier' && typeof v === 'string') {
          const allowedTiers = ['free', 'basic', 'premium', 'vip', 'vip_silver', 'vip_gold', 'vip_platinum'];
          if (!allowedTiers.includes(v)) throw new Error('Invalid plan tier');
        }

        updates.push(`${k} = ?`);
        values.push(v);
        filteredKeys.push(k);
        filteredVals.push(v);
      }
      
      if (updates.length > 0) {
        const existing = await db.prepare("SELECT 1 FROM user_subscriptions WHERE user_id = ?").bind(userId).first();
        if (existing) {
          await db.prepare(`UPDATE user_subscriptions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(...values, userId).run();
        } else {
          const placeholders = filteredKeys.map(() => '?').join(', ');
          await db.prepare(`INSERT INTO user_subscriptions (user_id, ${filteredKeys.join(', ')}) VALUES (?, ${placeholders})`).bind(userId, ...filteredVals).run();
        }

        const flagsRow = await db.prepare("SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'").bind(userId).first<{ data_json: string }>();
        let currentFlags: string[] = [];
        if (flagsRow?.data_json) {
          try { currentFlags = JSON.parse(flagsRow.data_json).flags || []; } catch {}
        }

        const planTier = body.subscription.plan_tier;
        const isVipTier = planTier && planTier !== 'free';
        if (isVipTier) {
          if (!currentFlags.includes('vip')) {
            currentFlags.push('vip');
          }
        } else if (planTier === 'free') {
          currentFlags = currentFlags.filter(f => f !== 'vip');
        }

        await db.prepare(`
          INSERT INTO user_metadata_ext (user_id, namespace, data_json, updated_at)
          VALUES (?, 'flags', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, namespace) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
        `).bind(userId, JSON.stringify({ flags: currentFlags, updated_at: new Date().toISOString() })).run();
      }
    }

    // Tier 1 & Tier 2 & Tier 3 for body.metadata
    if (body.metadata && Array.isArray(body.metadata)) {
      for (const meta of body.metadata) {
        if (!meta.namespace || typeof meta.namespace !== 'string' || !NAMESPACE_REGEX.test(meta.namespace)) {
          throw new Error('Invalid metadata namespace');
        }
        if (!meta.data_json || typeof meta.data_json !== 'string') {
          throw new Error('Invalid metadata data_json');
        }
        // Verify JSON validity
        JSON.parse(meta.data_json);

        await db.prepare(`
          INSERT INTO user_metadata_ext (user_id, namespace, data_json, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, namespace) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
        `).bind(userId, meta.namespace, meta.data_json).run();
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const err = e as Error;
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async (context) => {
  const userId = context.params.id as string;
  const db = context.env.DB;
  
  try {
    const url = new URL(context.request.url);
    const sessionId = url.searchParams.get("sessionId");
    
    if (sessionId) {
      await db.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").bind(sessionId, userId).run();
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }
    
    return new Response(JSON.stringify({ error: "Bad Request" }), { status: 400 });
  } catch (e: unknown) {
    const err = e as Error;
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

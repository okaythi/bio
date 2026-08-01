export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const onRequestPut: PagesFunction<{ DB: D1Database }> = async (context) => {
  const userId = context.params.id as string;
  const db = context.env.DB;
  
  try {
    const body = await context.request.json<any>();
    
    if (body.user) {
      const updates = [];
      const values = [];
      for (const [k, v] of Object.entries(body.user)) {
        if (k !== 'id') {
          updates.push(`${k} = ?`);
          values.push(v);
        }
      }
      if (updates.length > 0) {
        await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values, userId).run();
      }
    }

    if (body.profile) {
      const updates = [];
      const values = [];
      for (const [k, v] of Object.entries(body.profile)) {
        if (k !== 'user_id') {
          updates.push(`${k} = ?`);
          values.push(v);
        }
      }
      if (updates.length > 0) {
        await db.prepare(`UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = ?`).bind(...values, userId).run();
      }
    }

    if (body.subscription) {
      const updates = [];
      const values = [];
      for (const [k, v] of Object.entries(body.subscription)) {
        if (k !== 'user_id') {
          updates.push(`${k} = ?`);
          values.push(v);
        }
      }
      if (updates.length > 0) {
        const existing = await db.prepare("SELECT 1 FROM user_subscriptions WHERE user_id = ?").bind(userId).first();
        if (existing) {
          await db.prepare(`UPDATE user_subscriptions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(...values, userId).run();
        } else {
          const keys = Object.keys(body.subscription).filter(k => k !== 'user_id');
          const vals = keys.map(k => (body.subscription as any)[k]);
          const placeholders = keys.map(() => '?').join(', ');
          await db.prepare(`INSERT INTO user_subscriptions (user_id, ${keys.join(', ')}) VALUES (?, ${placeholders})`).bind(userId, ...vals).run();
        }

        // Sync flags with subscription tier
        const flagsRow = await db.prepare("SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'").bind(userId).first<{ data_json: string }>();
        let currentFlags: string[] = [];
        if (flagsRow?.data_json) {
          try { currentFlags = JSON.parse(flagsRow.data_json).flags || []; } catch {}
        }

        const isVipTier = body.subscription.plan_tier && body.subscription.plan_tier !== 'free';
        if (isVipTier) {
          if (!currentFlags.includes('vip')) {
            currentFlags.push('vip');
          }
        } else if (body.subscription.plan_tier === 'free') {
          currentFlags = currentFlags.filter(f => f !== 'vip');
        }


        await db.prepare(`
          INSERT INTO user_metadata_ext (user_id, namespace, data_json, updated_at)
          VALUES (?, 'flags', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, namespace) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
        `).bind(userId, JSON.stringify({ flags: currentFlags, updated_at: new Date().toISOString() })).run();
      }
    }



    if (body.metadata && Array.isArray(body.metadata)) {
      for (const meta of body.metadata) {
        await db.prepare(`
          INSERT INTO user_metadata_ext (user_id, namespace, data_json, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, namespace) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
        `).bind(userId, meta.namespace, meta.data_json).run();
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<{ DB: D1Database }> = async (context) => {
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
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

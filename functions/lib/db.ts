export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>; 
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(stmts: D1PreparedStatement[]): Promise<unknown>;
}

export async function getSessionUser(db: D1Database, sessionId: string) {
  return await db.prepare(`
    SELECT users.id, users.email 
    FROM sessions 
    JOIN users ON sessions.user_id = users.id 
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP
  `).bind(sessionId).first<{ id: string; email: string }>();
}

export async function getUserMetadataExt(db: D1Database, userId: string, namespace: string) {
  const row = await db.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = ?"
  ).bind(userId, namespace).first<{ data_json: string }>();

  if (row?.data_json) {
    try {
      return JSON.parse(row.data_json);
    } catch {}
  }
  return null;
}

export async function setUserMetadataExt(db: D1Database, userId: string, namespace: string, data: any) {
  await db.prepare(`
    INSERT INTO user_metadata_ext (user_id, namespace, data_json, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, namespace) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
  `).bind(userId, namespace, JSON.stringify(data)).run();
}

export async function getUserFlags(db: D1Database, userId: string): Promise<string[]> {
  const parsed = await getUserMetadataExt(db, userId, 'flags');
  if (parsed && Array.isArray(parsed.flags)) {
    return parsed.flags;
  }
  return [];
}

export async function getUserVipStatus(db: D1Database, userId: string): Promise<{ isVip: boolean; planTier: string; status: string; expiresAt: string | null }> {
  const [sub, flags] = await Promise.all([
    db.prepare("SELECT plan_tier, status, expires_at FROM user_subscriptions WHERE user_id = ?").bind(userId).first<{ plan_tier: string; status: string; expires_at: string | null }>(),
    getUserFlags(db, userId)
  ]);

  const hasVipFlag = flags.includes('vip');

  let rawTier = sub?.plan_tier || 'free';
  if (rawTier === 'vip') rawTier = 'vip_gold';

  if (!sub) {
    return {
      isVip: hasVipFlag,
      planTier: hasVipFlag ? 'vip_gold' : 'free',
      status: 'active',
      expiresAt: null
    };
  }

  const now = new Date();
  const isExpired = sub.expires_at ? new Date(sub.expires_at) < now : false;
  const isTierVip = (rawTier.startsWith('vip') || rawTier === 'premium') && sub.status === 'active' && !isExpired;

  return {
    isVip: isTierVip || hasVipFlag,
    planTier: isExpired ? 'free' : (isTierVip ? rawTier : (hasVipFlag ? 'vip_gold' : rawTier)),
    status: isExpired ? 'expired' : (sub.status || 'active'),
    expiresAt: sub.expires_at
  };
}


export async function getAdminSettings(db: D1Database) {
  const parsed = await getUserMetadataExt(db, 'f9ec8d5b-5e49-4826-86b2-5147bcd58590', 'admin_settings');
  let adminSettings: { vpnCheckEnabled: boolean; allowlistIps: string[]; comingSoonList?: any[]; defaultHero?: string; promotedWeights?: Record<string, number>; [key: string]: any } = { vpnCheckEnabled: true, allowlistIps: [] };
  if (parsed) {
    adminSettings = { ...adminSettings, ...parsed };
  }
  return adminSettings;
}

export async function setAdminSettings(db: D1Database, settings: any) {
  await setUserMetadataExt(db, 'f9ec8d5b-5e49-4826-86b2-5147bcd58590', 'admin_settings', settings);
}

export async function getUserFingerprint(db: D1Database, userId: string) {
  const row = await db.prepare(
    "SELECT fingerprint_hash FROM user_devices WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT 1"
  ).bind(userId).first<{ fingerprint_hash: string }>();
  return row?.fingerprint_hash;
}

export async function insertTelemetryBatch(db: D1Database, events: any[], userId: string | null, sessionId: string | null, ipAddress: string, country: string) {
  const stmt = db.prepare(`
    INSERT INTO user_telemetry_events 
    (id, user_id, session_id, event_type, event_data_json, device_info_json, ip_address, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const batchStmts = events.map((evt) => {
    const eventId = crypto.randomUUID();
    const eventType = evt.type || "unknown";
    const eventDataJson = JSON.stringify(evt.data || {});
    const deviceInfoJson = JSON.stringify(evt.device || {});
    return stmt.bind(eventId, userId, sessionId, eventType, eventDataJson, deviceInfoJson, ipAddress, country);
  });

  await db.batch(batchStmts);
}

export async function getUserSummaryData(db: D1Database, userId: string) {
  const [history, behavior, flagsRaw, telemetryAgg, activityAgg] = await Promise.all([
    db.prepare("SELECT movie_id, progress_seconds, duration_seconds, completed, rating, watch_count, last_watched_at FROM user_watch_history WHERE user_id = ? ORDER BY last_watched_at DESC LIMIT 50").bind(userId).all(),
    db.prepare("SELECT * FROM user_behavioral_profiles WHERE user_id = ?").bind(userId).first(),
    db.prepare("SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'").bind(userId).first(),
    db.prepare(`
      SELECT 
        COUNT(CASE WHEN event_type = 'rage_click' THEN 1 END) as rage_click_count,
        COUNT(CASE WHEN event_type = 'indecision_hover' THEN 1 END) as indecision_hover_count,
        COUNT(CASE WHEN event_type = 'vip_code_redeemed' THEN 1 END) as vip_code_redeemed_count,
        COUNT(CASE WHEN event_type = 'intersection' THEN 1 END) as banner_dwell_count,
        COUNT(CASE WHEN event_type = 'video_abandoned' THEN 1 END) as video_abandoned_count
      FROM user_telemetry_events 
      WHERE user_id = ?
    `).bind(userId).first(),
    db.prepare(`
      SELECT 
        COUNT(DISTINCT DATE(created_at)) as active_days_14d,
        COUNT(id) as total_events_14d
      FROM user_telemetry_events 
      WHERE user_id = ? AND created_at >= DATETIME('now', '-14 days')
    `).bind(userId).first()
  ]);

  const flags = flagsRaw as { data_json?: string } | null;

  const processedHistory = (history.results || []).map((r: any) => {
    let pct = 0;
    if (r.duration_seconds > 0) {
      pct = Math.min(100, Math.round((r.progress_seconds / r.duration_seconds) * 100));
    } else if (r.completed || r.progress_seconds > 1800) {
      pct = 100;
    }
    return {
      movieId: r.movie_id,
      percentWatched: `${pct}%`,
      pctNumeric: pct,
      completed: Boolean(r.completed || pct >= 70),
      lastWatched: r.last_watched_at
    };
  });

  const validPcts = processedHistory.map((h: any) => h.pctNumeric);
  const avgPct = validPcts.length > 0 ? Math.round(validPcts.reduce((a: number, b: number) => a + b, 0) / validPcts.length) : 0;
  const substantiallyFinished = processedHistory.filter((h: any) => h.completed).length;

  return {
    history: processedHistory,
    totalTitlesWatched: processedHistory.length,
    averagePercentWatched: avgPct,
    substantiallyFinishedCount: substantiallyFinished,
    completedTitlesCount: substantiallyFinished,
    behavior: behavior || {},
    telemetryStats: telemetryAgg || {},
    activityStats: activityAgg || {},
    flags: flags?.data_json || '{}'
  };
}

export async function getMovieMetadata(db: D1Database, movieId: string) {
  const row = await db.prepare("SELECT data_json FROM movie_metadata WHERE id = ?").bind(movieId).first<{ data_json: string }>();
  if (row?.data_json) {
    try {
      return JSON.parse(row.data_json);
    } catch {}
  }
  return null;
}

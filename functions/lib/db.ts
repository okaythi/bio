export interface D1Database {
  prepare(query: string): any;
  batch(stmts: any[]): Promise<any>;
}

export async function getSessionUser(db: D1Database, sessionId: string) {
  return await db.prepare(`
    SELECT users.id, users.email 
    FROM sessions 
    JOIN users ON sessions.user_id = users.id 
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP
  `).bind(sessionId).first<{ id: string; email: string }>();
}

export async function getUserFlags(db: D1Database, userId: string): Promise<string[]> {
  const flagsRow = await db.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'"
  ).bind(userId).first<{ data_json: string }>();

  if (flagsRow?.data_json) {
    try {
      const parsed = JSON.parse(flagsRow.data_json);
      if (Array.isArray(parsed.flags)) return parsed.flags;
    } catch {}
  }
  return [];
}

export async function getAdminSettings(db: D1Database) {
  const ownerSettingsRow = await db.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = 'f9ec8d5b-5e49-4826-86b2-5147bcd58590' AND namespace = 'admin_settings'"
  ).first<{ data_json: string }>();

  let adminSettings = { vpnCheckEnabled: true, allowlistIps: [] as string[] };
  if (ownerSettingsRow?.data_json) {
    try {
      adminSettings = { ...adminSettings, ...JSON.parse(ownerSettingsRow.data_json) };
    } catch {}
  }
  return adminSettings;
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
  const [history, behavior, flags] = await Promise.all([
    db.prepare("SELECT * FROM user_watch_history WHERE user_id = ? LIMIT 50").bind(userId).all(),
    db.prepare("SELECT * FROM user_behavioral_profiles WHERE user_id = ?").bind(userId).first(),
    db.prepare("SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'").bind(userId).first()
  ]);
  return { history, behavior, flags };
}

import { getSessionUser, type D1Database } from './db';

export async function authenticateSession(request: Request, db: D1Database) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  let sessionId = match ? match[1] : null;

  const headerToken = request.headers.get("x-admin-token");
  if (headerToken) {
    sessionId = headerToken;
  }

  if (!sessionId) {
    return { user: null, sessionId: null, error: "Access Denied: Missing session identifier." };
  }

  const user = await getSessionUser(db, sessionId);

  if (!user) {
    return { user: null, sessionId: null, error: "Access Denied: Invalid or expired session." };
  }

  try {
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "127.0.0.1";
    const ua = request.headers.get("User-Agent") || "Browser Device";
    const fpHash = `fp_${user.id.substring(0, 8)}_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await db.prepare(`
      INSERT INTO user_devices (fingerprint_hash, user_id, device_type, session_count, last_seen_at, first_seen_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(fingerprint_hash) DO UPDATE SET session_count = session_count + 1, last_seen_at = CURRENT_TIMESTAMP
    `).bind(fpHash, user.id, ua.substring(0, 60)).run();
  } catch {}

  return { user, sessionId, error: null };
}

import { getSessionUser, D1Database } from './db';

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

  return { user, sessionId, error: null };
}

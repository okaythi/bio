export interface Env {
  DB: D1Database;
}

interface TelemetryEventPayload {
  type?: string;
  data?: Record<string, unknown>;
  device?: Record<string, unknown>;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const cookieHeader = context.request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/session_id=([^;]+)/);
    const sessionId = match ? match[1] : null;

    let userId: string | null = null;
    if (sessionId) {
      const session = await context.env.DB.prepare(
        "SELECT user_id FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP"
      ).bind(sessionId).first<{ user_id: string }>();
      if (session) userId = session.user_id;
    }

    const ipAddress = context.request.headers.get("CF-Connecting-IP") || context.request.headers.get("x-forwarded-for") || "";
    const country = context.request.headers.get("CF-IPCountry") || "UNKNOWN";

    const body = (await context.request.json()) as TelemetryEventPayload | TelemetryEventPayload[];
    const events = Array.isArray(body) ? body : [body];

    const stmt = context.env.DB.prepare(`
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

    await context.env.DB.batch(batchStmts);

    return new Response(JSON.stringify({ success: true, count: events.length }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Telemetry ingest error: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

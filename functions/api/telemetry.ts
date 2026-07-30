import { authenticateSession } from '../lib/auth';
import { insertTelemetryBatch } from '../lib/db';

export interface Env {
  DB: any;
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
    const { user, sessionId } = await authenticateSession(context.request, context.env.DB);
    const userId = user ? user.id : null;

    const ipAddress = context.request.headers.get("CF-Connecting-IP") || context.request.headers.get("x-forwarded-for") || "";
    const country = context.request.headers.get("CF-IPCountry") || "UNKNOWN";

    const body = (await context.request.json()) as TelemetryEventPayload | TelemetryEventPayload[];
    const events = Array.isArray(body) ? body : [body];

    await insertTelemetryBatch(context.env.DB, events, userId, sessionId, ipAddress, country);

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

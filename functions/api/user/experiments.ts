export interface Env {
  DB: D1Database;
}

interface ExperimentsRequestBody {
  experiments?: string[];
}

interface ExperimentMetaRow {
  EXPERIMENTS?: string[];
  updated_at?: string;
}

async function getUserIdFromSession(context: EventContext<Env, string, Record<string, unknown>>): Promise<string | null> {
  const cookieHeader = context.request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  const sessionId = match ? match[1] : null;
  if (!sessionId) return null;

  const row = await context.env.DB.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP"
  ).bind(sessionId).first<{ user_id: string }>();

  return row ? row.user_id : null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const userId = await getUserIdFromSession(context);
  if (!userId) {
    return new Response(JSON.stringify({ experiments: ["public_beta_v1"] }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const row = await context.env.DB.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'experiments'"
  ).bind(userId).first<{ data_json: string }>();

  let experiments: string[] = ["public_beta_v1", "recommendations_v2"];
  if (row?.data_json) {
    try {
      const parsed = JSON.parse(row.data_json) as ExperimentMetaRow;
      if (Array.isArray(parsed.EXPERIMENTS)) {
        experiments = parsed.EXPERIMENTS;
      }
    } catch (e) {}
  }

  return new Response(JSON.stringify({ experiments }), {
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const userId = await getUserIdFromSession(context);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = (await context.request.json()) as ExperimentsRequestBody;
    const experiments = Array.isArray(body?.experiments) ? body.experiments : [];

    const dataJson = JSON.stringify({ EXPERIMENTS: experiments, updated_at: new Date().toISOString() });

    await context.env.DB.prepare(`
      INSERT INTO user_metadata_ext (user_id, namespace, data_json)
      VALUES (?, 'experiments', ?)
      ON CONFLICT(user_id, namespace) DO UPDATE SET data_json = ?
    `).bind(userId, dataJson, dataJson).run();

    return new Response(JSON.stringify({ success: true, experiments }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Experiments update failed: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

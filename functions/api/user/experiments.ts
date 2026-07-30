import { authenticateSession } from '../../lib/auth';
import { getUserMetadataExt, setUserMetadataExt, D1Database } from '../../lib/db';

export interface Env {
  DB: D1Database;
}

export const VALID_EXPERIMENT_BUCKETS = [
  "2026-07_public_beta_v1",
  "2026-07_beta_user",
  "2026-07_auto_play_next_video",
  "2026-07_smart_recommendations_v2",
  "2026-07_hero_video_v2",
  "2026-07_4k_player_beta",
  "2026-07_ai_subtitles_v1",
  "public_beta_v1",
  "beta_user",
  "auto_play_next_video"
];

interface ExperimentsRequestBody {
  experiments?: string[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error } = await authenticateSession(context.request, context.env.DB);
  if (error || !user) {
    return new Response(JSON.stringify({ experiments: ["2026-07_public_beta_v1", "2026-07_auto_play_next_video"] }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const parsed = await getUserMetadataExt(context.env.DB, user.id, 'experiments');

  let experiments: string[] = ["2026-07_public_beta_v1", "2026-07_auto_play_next_video"];
  if (parsed && Array.isArray(parsed.EXPERIMENTS)) {
    experiments = parsed.EXPERIMENTS;
  }

  if (!experiments.includes("2026-07_public_beta_v1") && !experiments.includes("public_beta_v1") && !experiments.includes("2026-07_beta_user") && !experiments.includes("beta_user")) {
    experiments.unshift("2026-07_public_beta_v1");
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

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, error } = await authenticateSession(context.request, context.env.DB);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = (await context.request.json()) as ExperimentsRequestBody;
    const experiments = Array.isArray(body?.experiments) ? body.experiments : [];

    const invalidBucket = experiments.find((b) => !VALID_EXPERIMENT_BUCKETS.includes(b));
    if (invalidBucket) {
      return new Response(
        JSON.stringify({
          error: `Unrecognized experiment bucket "${invalidBucket}".`
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await setUserMetadataExt(context.env.DB, user.id, 'experiments', { EXPERIMENTS: experiments, updated_at: new Date().toISOString() });

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

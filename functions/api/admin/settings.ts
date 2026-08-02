import { getAdminSettings, setAdminSettings, type D1Database } from '../../lib/db';

export interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const settings = await getAdminSettings(context.env.DB);
    return new Response(JSON.stringify({
      comingSoonList: settings.comingSoonList || [],
      defaultHero: settings.defaultHero || ""
    }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch {
    return new Response(JSON.stringify({ comingSoonList: [], defaultHero: "" }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await context.request.json<{ vpnCheckEnabled?: boolean; allowlistIps?: string[]; defaultHero?: string; promotedWeights?: Record<string, number>; comingSoonList?: unknown[] }>();
    const current = (await getAdminSettings(context.env.DB)) as unknown as Record<string, unknown>;

    if (body.vpnCheckEnabled !== undefined) current.vpnCheckEnabled = body.vpnCheckEnabled;
    if (body.allowlistIps !== undefined) current.allowlistIps = body.allowlistIps;
    if (body.defaultHero !== undefined) current.defaultHero = body.defaultHero;
    if (body.promotedWeights !== undefined) current.promotedWeights = body.promotedWeights;
    if (body.comingSoonList !== undefined) current.comingSoonList = body.comingSoonList;

    await setAdminSettings(context.env.DB, current);

    return new Response(JSON.stringify({ success: true, settings: current }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error: unknown) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};

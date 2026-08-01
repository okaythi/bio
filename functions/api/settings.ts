import { getAdminSettings, D1Database } from '../lib/db';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const settings = await getAdminSettings(context.env.DB) as any;
    return new Response(JSON.stringify({
      comingSoonList: settings.comingSoonList || [],
      defaultHero: settings.defaultHero || ""
    }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ comingSoonList: [], defaultHero: "" }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};

import { getAdminSettings, setAdminSettings, D1Database } from '../../lib/db';

export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
  const settings = await getAdminSettings(context.env.DB);
  return new Response(JSON.stringify(settings), {
    headers: { "Content-Type": "application/json" }
  });
};

export const onRequestPut: PagesFunction<{ DB: D1Database }> = async (context) => {
  try {
    const body = await context.request.json<{ vpnCheckEnabled?: boolean; allowlistIps?: string[] }>();
    const current = await getAdminSettings(context.env.DB);

    if (body.vpnCheckEnabled !== undefined) current.vpnCheckEnabled = body.vpnCheckEnabled;
    if (body.allowlistIps !== undefined) current.allowlistIps = body.allowlistIps;

    await setAdminSettings(context.env.DB, current);

    return new Response(JSON.stringify(current), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

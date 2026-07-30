export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
  const row = await context.env.DB.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = 'f9ec8d5b-5e49-4826-86b2-5147bcd58590' AND namespace = 'admin_settings'"
  ).first<{ data_json: string }>();

  let settings = { vpnCheckEnabled: true, allowlistIps: [] };
  if (row?.data_json) {
    try {
      settings = { ...settings, ...JSON.parse(row.data_json) };
    } catch (e) {}
  }

  return new Response(JSON.stringify(settings), {
    headers: { "Content-Type": "application/json" }
  });
};

export const onRequestPut: PagesFunction<{ DB: D1Database }> = async (context) => {
  try {
    const body = await context.request.json<{ vpnCheckEnabled?: boolean; allowlistIps?: string[] }>();
    
    const row = await context.env.DB.prepare(
      "SELECT data_json FROM user_metadata_ext WHERE user_id = 'f9ec8d5b-5e49-4826-86b2-5147bcd58590' AND namespace = 'admin_settings'"
    ).first<{ data_json: string }>();

    let current = { vpnCheckEnabled: true, allowlistIps: [] as string[] };
    if (row?.data_json) {
      try {
        current = { ...current, ...JSON.parse(row.data_json) };
      } catch (e) {}
    }

    if (body.vpnCheckEnabled !== undefined) current.vpnCheckEnabled = body.vpnCheckEnabled;
    if (body.allowlistIps !== undefined) current.allowlistIps = body.allowlistIps;

    await context.env.DB.prepare(`
      INSERT INTO user_metadata_ext (user_id, namespace, data_json, updated_at)
      VALUES ('f9ec8d5b-5e49-4826-86b2-5147bcd58590', 'admin_settings', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, namespace) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
    `).bind(JSON.stringify(current)).run();

    return new Response(JSON.stringify(current), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const onRequest: PagesFunction<{ DB: D1Database }> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-fp, x-admin-token"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cookieHeader = context.request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  let sessionId = match ? match[1] : null;

  const headerToken = context.request.headers.get("x-admin-token");
  if (headerToken) {
    sessionId = headerToken;
  }

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Access Denied: Missing session identifier." }), { status: 401, headers: corsHeaders });
  }

  const caller = await context.env.DB.prepare(`
    SELECT users.id, users.email 
    FROM sessions 
    JOIN users ON sessions.user_id = users.id 
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP
  `).bind(sessionId).first<{ id: string; email: string }>();

  if (!caller) {
    return new Response(JSON.stringify({ error: "Access Denied: Invalid or expired session." }), { status: 401, headers: corsHeaders });
  }

  const flagsRow = await context.env.DB.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'"
  ).bind(caller.id).first<{ data_json: string }>();

  let callerFlags: string[] = [];
  if (flagsRow?.data_json) {
    try {
      const parsed = JSON.parse(flagsRow.data_json);
      if (Array.isArray(parsed.flags)) callerFlags = parsed.flags;
    } catch (e) {}
  }

  const isOwner = caller.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590";
  if (isOwner) {
    if (!callerFlags.includes("is_staff")) callerFlags.push("is_staff");
    if (!callerFlags.includes("edit_flags")) callerFlags.push("edit_flags");
  }

  if (!callerFlags.includes("is_staff") && !callerFlags.includes("edit_flags")) {
    return new Response(JSON.stringify({ error: "Access Denied: You do not possess the required staff privileges." }), { status: 403, headers: corsHeaders });
  }

  const ownerSettingsRow = await context.env.DB.prepare(
    "SELECT data_json FROM user_metadata_ext WHERE user_id = 'f9ec8d5b-5e49-4826-86b2-5147bcd58590' AND namespace = 'admin_settings'"
  ).first<{ data_json: string }>();

  let adminSettings = { vpnCheckEnabled: true, allowlistIps: [] as string[] };
  if (ownerSettingsRow?.data_json) {
    try {
      adminSettings = { ...adminSettings, ...JSON.parse(ownerSettingsRow.data_json) };
    } catch (e) {}
  }

  const clientIp = context.request.headers.get("CF-Connecting-IP") || context.request.headers.get("x-forwarded-for") || "";

  if (adminSettings.allowlistIps.length > 0) {
    if (!adminSettings.allowlistIps.includes(clientIp)) {
      return new Response(JSON.stringify({ error: `Access Denied: IP Address ${clientIp} is not in the strict allowlist.` }), { status: 403, headers: corsHeaders });
    }
  }

  if (adminSettings.vpnCheckEnabled) {
    const cf = context.request.cf || {};
    const asOrg = (cf.asOrganization as string || "").toLowerCase();
    const isVpn = asOrg.includes('vpn') || asOrg.includes('proxy') || asOrg.includes('hosting') || (cf.clientTrustScore && (cf.clientTrustScore as number) < 30);
    
    if (isVpn) {
      return new Response(JSON.stringify({ error: "Access Denied: VPN, Proxy, or low trust network detected. Disable VPN to access the OmniControl Center." }), { status: 403, headers: corsHeaders });
    }
  }

  const fpHeader = context.request.headers.get("x-admin-fp");
  if (fpHeader) {
    const sessionFpRow = await context.env.DB.prepare(
      "SELECT fingerprint_hash FROM user_devices WHERE user_id = ? ORDER BY last_seen_at DESC LIMIT 1"
    ).bind(caller.id).first<{ fingerprint_hash: string }>();
    
    if (sessionFpRow && sessionFpRow.fingerprint_hash !== fpHeader) {
      return new Response(JSON.stringify({ error: "Access Denied: Hardware fingerprint mismatch. Session hijacked or device changed." }), { status: 403, headers: corsHeaders });
    }
  }

  return context.next();
};

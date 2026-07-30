import { authenticateSession } from '../../lib/auth';
import { getUserFlags, getAdminSettings, getUserFingerprint } from '../../lib/db';

export const onRequest: PagesFunction<{ DB: any }> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-fp, x-admin-token"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { user, sessionId, error } = await authenticateSession(context.request, context.env.DB);
  if (error || !user) {
    return new Response(JSON.stringify({ error: error || "Access Denied" }), { status: 401, headers: corsHeaders });
  }

  let callerFlags = await getUserFlags(context.env.DB, user.id);

  const isOwner = user.id === "f9ec8d5b-5e49-4826-86b2-5147bcd58590";
  if (isOwner) {
    if (!callerFlags.includes("is_staff")) callerFlags.push("is_staff");
    if (!callerFlags.includes("edit_flags")) callerFlags.push("edit_flags");
  }

  if (!callerFlags.includes("is_staff") && !callerFlags.includes("edit_flags")) {
    return new Response(JSON.stringify({ error: "Access Denied: You do not possess the required staff privileges." }), { status: 403, headers: corsHeaders });
  }

  const adminSettings = await getAdminSettings(context.env.DB);

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
    const fingerprintHash = await getUserFingerprint(context.env.DB, user.id);
    if (fingerprintHash && fingerprintHash !== fpHeader) {
      return new Response(JSON.stringify({ error: "Access Denied: Hardware fingerprint mismatch. Session hijacked or device changed." }), { status: 403, headers: corsHeaders });
    }
  }

  return context.next();
};

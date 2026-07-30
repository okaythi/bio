export interface Env {
  TELEMETRY_ANALYTICS?: any;
  TELEMETRY_BLOBS?: R2Bucket;
  TELEMETRY_QUEUE?: Queue;
  AI?: any;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  
  try {
    const payload = await request.json<any>();
    
    const cf = request.cf || {};
    const asOrg = (cf.asOrganization as string) || '';
    const isVpn = asOrg.toLowerCase().includes('vpn') || 
                  asOrg.toLowerCase().includes('proxy') || 
                  asOrg.toLowerCase().includes('hosting') ||
                  (cf.clientTrustScore && (cf.clientTrustScore as number) < 30);
                  
    const locationData = {
      country: cf.country || 'Unknown',
      region: cf.region || 'Unknown',
      city: cf.city || 'Unknown',
      ip_address: request.headers.get('CF-Connecting-IP') || 'Unknown',
      is_vpn: !!isVpn,
      weight: isVpn ? 0.1 : 1.0,
    };

    if (env.TELEMETRY_ANALYTICS) {
      env.TELEMETRY_ANALYTICS.writeDataPoint({
        blobs: [
          payload.userId || 'anonymous',
          payload.sessionId || 'unknown',
          locationData.country as string,
          payload.eventType || 'ping',
        ],
        doubles: [
          locationData.weight,
        ],
        indexes: [payload.userId || 'anonymous'],
      });
    }

    if (env.TELEMETRY_BLOBS && payload.rawTraces) {
      const dateStr = new Date().toISOString().split('T')[0];
      const userId = payload.userId || 'anonymous';
      const objectKey = `traces/${userId}/${dateStr}/${payload.sessionId}_${Date.now()}.json`;
      
      await env.TELEMETRY_BLOBS.put(objectKey, JSON.stringify({
        ...payload.rawTraces,
        hardwareFingerprint: payload.hardwareFingerprint,
        locationData,
      }));
    }

    if (env.TELEMETRY_QUEUE && payload.semanticEvents) {
      for (const event of payload.semanticEvents) {
        await env.TELEMETRY_QUEUE.send({
          ...event,
          userId: payload.userId,
          sessionId: payload.sessionId,
          locationData,
        });
      }
    }

    return new Response(JSON.stringify({ status: 'ok', vpnDetected: isVpn }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
};

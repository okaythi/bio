import type { R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  TELEMETRY_ANALYTICS?: { writeDataPoint(data: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void };
  TELEMETRY_BLOBS?: R2Bucket;
  TELEMETRY_QUEUE?: { send(message: unknown): Promise<void> };
  AI?: { run(model: string, input: unknown): Promise<unknown> };
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
    const payload = await request.json<{
      userId?: string;
      sessionId?: string;
      eventType?: string;
      rawTraces?: Record<string, unknown>;
      hardwareFingerprint?: string;
      semanticEvents?: Record<string, unknown>[];
    }>();
    
    const reqWithCf = request as unknown as { cf?: { asOrganization?: string; clientTrustScore?: number; country?: string; region?: string; city?: string } };
    const cf = reqWithCf.cf || {};
    const asOrg = cf.asOrganization || '';
    const isVpn = asOrg.toLowerCase().includes('vpn') || 
                  asOrg.toLowerCase().includes('proxy') || 
                  asOrg.toLowerCase().includes('hosting') ||
                  (cf.clientTrustScore !== undefined && cf.clientTrustScore < 30);
                  
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
          locationData.country,
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

  } catch (error: unknown) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
};

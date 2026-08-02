import type { R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  TELEMETRY_BLOBS: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
    }

    const listed = await context.env.TELEMETRY_BLOBS.list({ prefix: `traces/${userId}/` });
    
    const traces: { key: string; data: unknown }[] = [];
    for (const obj of listed.objects) {
      const object = await context.env.TELEMETRY_BLOBS.get(obj.key);
      if (object !== null) {
        const text = await object.text();
        traces.push({ key: obj.key, data: JSON.parse(text) });
      }
    }

    return new Response(JSON.stringify({ traces }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: unknown) {
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

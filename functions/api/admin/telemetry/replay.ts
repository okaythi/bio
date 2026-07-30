export const onRequestGet: PagesFunction<{ TELEMETRY_BLOBS: R2Bucket }> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
    }

    const listed = await context.env.TELEMETRY_BLOBS.list({ prefix: `traces/${userId}/` });
    
    const traces = [];
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

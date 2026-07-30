export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (context) => {
  return new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
    headers: { "Content-Type": "application/json" }
  });
};

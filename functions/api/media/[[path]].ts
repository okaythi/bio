export interface Env {
  movies: R2Bucket;
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cookieHeader = context.request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/session_id=([^;]+)/);
  const sessionId = match ? match[1] : null;
  if (!sessionId) {
    return new Response("Unauthorized: Please sign in to watch.", { status: 401, headers: corsHeaders });
  }
  
  const session = await context.env.DB.prepare(`
    SELECT id FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP
  `).bind(sessionId).first();
  
  if (!session) {
    return new Response("Unauthorized: Session expired.", { status: 401, headers: corsHeaders });
  }

  const pathArray = context.params.path as string[];
  if (!pathArray || pathArray.length === 0) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
  
  const key = pathArray.map(decodeURIComponent).join('/');
  
  const rangeHeader = context.request.headers.get("Range");
  const options: R2GetOptions = {};
  if (rangeHeader) {
    options.range = context.request.headers;
  }
  options.onlyIf = context.request.headers;
  
  const object = await context.env.movies.get(key, options);
  
  if (!object) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v);
  }

  const status = object.body ? (rangeHeader !== null ? 206 : 200) : 304;
  return new Response(object.body, { headers, status });
};

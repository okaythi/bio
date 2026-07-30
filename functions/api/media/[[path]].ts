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
    const parts = rangeHeader.replace("bytes=", "").split("-");
    const start = parts[0] ? parseInt(parts[0], 10) : 0;
    const end = parts[1] ? parseInt(parts[1], 10) : undefined;
    
    if (end !== undefined) {
      options.range = { offset: start, length: (end - start) + 1 };
    } else {
      options.range = { offset: start };
    }
  }
  options.onlyIf = context.request.headers;
  
  const object = await context.env.movies.get(key, options);
  
  if (!object) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");

  if (rangeHeader !== null && (object as any).range) {
    const range = (object as any).range;
    const offset = range.offset;
    const length = range.length;
    const end = offset + length - 1;
    headers.set("Content-Range", `bytes ${offset}-${end}/${object.size}`);
    headers.set("Content-Length", length.toString());
  } else {
    headers.set("Content-Length", object.size.toString());
  }
  
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v);
  }

  const status = object.body ? (rangeHeader !== null && (object as any).range ? 206 : 200) : 304;
  return new Response(object.body, { headers, status });
};

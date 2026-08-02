export interface Env {
  VITE_TMDB_API_TOKEN: string;
}

export const onRequest: PagesFunction<Env, 'path'> = async (context) => {
  const { request, env, params } = context;
  const pathArray = params.path as string[];
  
  if (!pathArray || pathArray.length === 0) {
    return new Response("Not Found", { status: 404 });
  }

  const tmdbPath = pathArray.join("/");
  const url = new URL(request.url);
  
  const tmdbUrl = new URL(`https://api.themoviedb.org/3/${tmdbPath}${url.search}`);
  
  const token = env.VITE_TMDB_API_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: "TMDB API Token not configured on the server" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const response = await fetch(tmdbUrl.toString(), {
    method: request.method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json"
    }
  });
};

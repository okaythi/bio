export interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const cookieHeader = context.request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/session_id=([^;]+)/);
    const sessionId = match ? match[1] : null;

    if (sessionId) {
      await context.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    }

    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders
    });

    responseHeaders.append(
      "Set-Cookie",
      "session_id=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );

    return new Response(JSON.stringify({ success: true }), { headers: responseHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Logout error: ${message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

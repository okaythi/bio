export const onRequestPost: PagesFunction<{ AI: any; DB: D1Database }> = async (context) => {
  try {
    const { userId } = await context.request.json<{ userId: string }>();

    const [history, behavior, flags] = await Promise.all([
      context.env.DB.prepare("SELECT * FROM user_watch_history WHERE user_id = ? LIMIT 50").bind(userId).all(),
      context.env.DB.prepare("SELECT * FROM user_behavioral_profiles WHERE user_id = ?").bind(userId).first(),
      context.env.DB.prepare("SELECT data_json FROM user_metadata_ext WHERE user_id = ? AND namespace = 'flags'").bind(userId).first()
    ]);

    const prompt = `Analyze the following user data and provide a concise psychological profile and churn risk assessment for an admin dashboard. Do not use markdown headers, just return a short paragraph.
    
    Watch History (count: ${history.results?.length || 0}): ${JSON.stringify((history.results || []).map(r => ({ movieId: r.movie_id, progress: r.progress_seconds, rating: r.rating })))}
    Behavioral Profile: ${JSON.stringify(behavior || {})}
    Flags: ${flags?.data_json || '{}'}
    `;

    const response = await context.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: prompt }]
    });

    return new Response(JSON.stringify({ summary: response.response }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

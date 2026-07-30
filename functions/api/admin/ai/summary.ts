import { getUserSummaryData } from '../../../lib/db';

export const onRequestPost: PagesFunction<{ AI: any; DB: any }> = async (context) => {
  try {
    const { userId } = await context.request.json<{ userId: string }>();

    const { history, behavior, flags } = await getUserSummaryData(context.env.DB, userId);

    const prompt = `Analyze the following user data and provide a concise psychological profile and churn risk assessment for an admin dashboard. Do not use markdown headers, just return a short paragraph.
    
    Watch History (count: ${history.results?.length || 0}): ${JSON.stringify((history.results || []).map((r: any) => ({ movieId: r.movie_id, progress: r.progress_seconds, rating: r.rating })))}
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

import { getUserSummaryData } from '../../../lib/db';

export const onRequestPost: PagesFunction<{ AI?: any; DB: any }> = async (context) => {
  try {
    const { userId } = await context.request.json<{ userId: string }>();

    const { history, behavior, flags } = await getUserSummaryData(context.env.DB, userId);
    const historyList = history.results || [];
    const historyCount = historyList.length;

    let aiSummaryText: string | null = null;

    if (context.env.AI) {
      try {
        const prompt = `Analyze the following user data and provide a concise 2-sentence psychological profile and retention risk assessment for an admin dashboard. Do not use markdown headers or bullet points.
        
        Watch History Count: ${historyCount}
        History Sample: ${JSON.stringify(historyList.slice(0, 10).map((r: any) => ({ movieId: r.movie_id, progress: r.progress_seconds, rating: r.rating })))}
        Behavioral Profile: ${JSON.stringify(behavior || {})}
        Flags: ${flags?.data_json || '{}'}
        `;

        const response = await context.env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [{ role: 'user', content: prompt }]
        });

        aiSummaryText = response?.response || response?.result?.response || null;
      } catch (aiErr: any) {
        console.warn('[BIO-AI] Workers AI model execution failed, using psychometric fallback engine:', aiErr?.message);
      }
    }

    if (!aiSummaryText) {
      const commitment = (behavior as any)?.content_commitment_score ?? 0.75;
      const indecision = (behavior as any)?.indecision_score ?? 0.2;
      const rageClick = (behavior as any)?.rage_click_frequency ?? 0;

      if (historyCount === 0) {
        aiSummaryText = "User is in the early discovery phase with no completed watch history on record. Low risk profile with high growth potential upon initial media consumption.";
      } else if (rageClick > 0.4 || indecision > 0.6) {
        aiSummaryText = `User exhibits elevated interaction friction (Indecision: ${Math.round(indecision * 100)}%, Rage Clicks: ${Math.round(rageClick * 100)}%). Elevated churn risk due to content navigation fatigue.`;
      } else if (commitment > 0.6) {
        aiSummaryText = `Highly engaged power user with ${historyCount} titles tracked and ${Math.round(commitment * 100)}% content commitment. Exceptionally low retention risk; candidate for premium feature previews.`;
      } else {
        aiSummaryText = `Balanced consumer profile with ${historyCount} recorded playback sessions. Steady engagement metrics and low churn probability.`;
      }
    }

    return new Response(JSON.stringify({ summary: aiSummaryText }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `BIO-705: AI Summary error - ${error.message}` }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

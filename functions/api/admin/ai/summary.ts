import { getUserSummaryData } from '../../../lib/db';

export const onRequestPost: PagesFunction<{ AI?: any; DB: any }> = async (context) => {
  try {
    const { userId } = await context.request.json<{ userId: string }>();

    const summaryData = await getUserSummaryData(context.env.DB, userId);
    const historyList = summaryData.history || [];
    const historyCount = summaryData.totalTitlesWatched;

    let aiSummaryText: string | null = null;
    let source: 'ai' | 'heuristic' = 'heuristic';
    let modelUsed = 'Heuristic Engine';

    if (context.env.AI) {
      const modelsToTry = [
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        '@cf/meta/llama-3.2-3b-instruct',
        '@cf/meta/llama-3.1-8b-instruct-fp8',
        '@cf/mistral/mistral-7b-instruct-v0.2',
        '@cf/meta/llama-3-8b-instruct'
      ];

      const prompt = `You are an analytics engine for the BIO streaming platform. Analyze the user telemetry metrics below and output exactly 2 concise sentences:
Sentence 1: Summarize their viewing habits and title completion rate.
Sentence 2: State their retention risk level (Low, Medium, or High) with a direct reason based on their activity.

User Metrics:
- 14-Day Active Days: ${summaryData.activityStats.active_days_14d || 0} (${summaryData.activityStats.total_events_14d || 0} total interactions)
- Total Titles Watched: ${historyCount} (${summaryData.completedTitlesCount} fully completed)
- Watch History: ${JSON.stringify(historyList.slice(0, 5))}
- Behavioral Telemetry: Rage Clicks: ${summaryData.telemetryStats.rage_click_count || 0}, Indecision Hovers: ${summaryData.telemetryStats.indecision_hover_count || 0}, Banner Dwells: ${summaryData.telemetryStats.banner_dwell_count || 0}, Video Abandonments: ${summaryData.telemetryStats.video_abandoned_count || 0}
- VIP Code Redemptions: ${summaryData.telemetryStats.vip_code_redeemed_count || 0}

Rules: Output ONLY the 2 sentences. No preambles, greetings, or markdown headers.`;

      for (const modelName of modelsToTry) {
        try {
          const response = await context.env.AI.run(modelName, {
            messages: [{ role: 'user', content: prompt }]
          });

          const text = response?.response || response?.result?.response || (typeof response === 'string' ? response : null);
          if (text) {
            aiSummaryText = text;
            source = 'ai';
            modelUsed = modelName.split('/').pop() || modelName;
            break;
          }
        } catch (mErr: any) {
          console.warn(`[BIO-AI] Model ${modelName} failed:`, mErr?.message || mErr);
        }
      }
    }

    if (!aiSummaryText) {
      const commitment = (summaryData.behavior as any)?.content_commitment_score ?? 0.75;
      const indecision = (summaryData.behavior as any)?.indecision_score ?? 0.2;
      const rageClick = (summaryData.telemetryStats as any)?.rage_click_count ?? 0;
      const activeDays = (summaryData.activityStats as any)?.active_days_14d ?? 0;

      if (historyCount === 0) {
        aiSummaryText = `User is in early discovery with ${activeDays} active session days over the past fortnight and 0 titles completed. Low risk profile with high growth potential upon initial media consumption.`;
      } else if (rageClick > 3 || indecision > 0.6) {
        aiSummaryText = `User exhibits elevated interaction friction (${rageClick} rage clicks, ${summaryData.telemetryStats.video_abandoned_count || 0} video abandonments). Moderate churn risk due to potential content fatigue.`;
      } else if (commitment > 0.6 || summaryData.completedTitlesCount > 2) {
        aiSummaryText = `Highly engaged user active ${activeDays} days in the past 2 weeks with ${summaryData.completedTitlesCount}/${historyCount} titles fully completed. Low retention risk; strong content commitment.`;
      } else {
        aiSummaryText = `Balanced consumer profile active ${activeDays} days in the past fortnight with ${historyCount} recorded watch sessions. Steady metrics and low churn probability.`;
      }
    }

    return new Response(JSON.stringify({ summary: aiSummaryText, source, model: modelUsed }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `BIO-705: AI Summary error - ${error.message}` }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

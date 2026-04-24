import { NextRequest } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { answerBehavioralQuestion } from '@/lib/story-search';
import { monitor } from '@/lib/monitor';

/**
 * POST /api/agent/stories/match
 * Classify a behavioral question → find matching stories → draft an answer
 */
export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 20, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;

  try {
    const { question } = await req.json();

    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await answerBehavioralQuestion(uid, question.trim());

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[Stories/Match] Error:', e);
    monitor.critical('Tool: agent/stories/match', String(e));
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

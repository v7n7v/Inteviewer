import { NextRequest } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getCoverageMap } from '@/lib/story-search';
import { monitor } from '@/lib/monitor';

/**
 * GET /api/agent/stories/coverage
 * Returns which behavioral categories are covered/uncovered by user stories
 */
export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 20, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;

  try {
    const coverage = await getCoverageMap(uid);

    return new Response(JSON.stringify(coverage), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[Stories/Coverage] Error:', e);
    monitor.critical('Tool: agent/stories/coverage', String(e));
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

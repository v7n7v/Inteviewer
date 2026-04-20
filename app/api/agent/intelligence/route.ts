import { NextRequest } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { generateRecommendations, generateProfileSummary } from '@/lib/career-recommendations';
import { getOrComputeTwin, invalidateTwin, exportTwinJSON } from '@/lib/career-twin';

// In-memory cache for recommendations (twin handles profile caching in Firestore)
const recsCache = new Map<string, { recommendations: any; summary: string; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 20, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const exportMode = new URL(req.url).searchParams.get('export') === 'true';

  try {
    // Get or compute the persistent twin
    const twin = await getOrComputeTwin(uid);

    // Export mode — return clean JSON for external tools
    if (exportMode) {
      return new Response(JSON.stringify(exportTwinJSON(twin)), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="career-profile.json"',
        },
      });
    }

    // Check recs cache
    const cached = recsCache.get(uid);
    let recommendations, summary;
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      recommendations = cached.recommendations;
      summary = cached.summary;
    } else {
      recommendations = generateRecommendations(twin);
      summary = generateProfileSummary(twin);
      recsCache.set(uid, { recommendations, summary, cachedAt: Date.now() });

      // Evict old cache entries
      if (recsCache.size > 500) {
        const oldest = [...recsCache.entries()]
          .sort(([, a], [, b]) => a.cachedAt - b.cachedAt)
          .slice(0, 100);
        oldest.forEach(([key]) => recsCache.delete(key));
      }
    }

    return new Response(JSON.stringify({
      profile: twin,
      recommendations,
      summary,
      twin: {
        completeness: twin.completeness,
        behavioralBank: twin.behavioralBank,
        background: twin.background,
        exportable: twin.exportable,
      },
      cached: !twin.stale,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Intelligence API error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST to invalidate twin (called after tool usage)
export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 30, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  await invalidateTwin(uid);
  recsCache.delete(uid);

  return new Response(JSON.stringify({ success: true, message: 'Twin invalidated' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}


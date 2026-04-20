import { NextRequest, NextResponse } from 'next/server';
import { searchCompanyJobs, scanCompanyPortals } from '@/lib/portal-scanner';
import { guardApiRoute } from '@/lib/api-auth';

/**
 * GET /api/jobs/portal?company=stripe&query=engineer
 * 
 * Scans Greenhouse, Lever, and Ashby's public job board APIs
 * directly for the specified company. Returns fresher listings
 * than aggregators like Adzuna or Remotive.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await guardApiRoute(request, {
      rateLimit: 10,
      rateLimitWindow: 60_000,
      allowAnonymous: true,
      feature: 'jdGenerations',
    });
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');
    const query = searchParams.get('query') || undefined;

    if (!company) {
      return NextResponse.json(
        { error: 'company parameter is required (e.g., ?company=stripe)' },
        { status: 400 }
      );
    }

    const result = await searchCompanyJobs(company, query);

    return NextResponse.json({
      ...result,
      meta: {
        company,
        query: query || null,
        timestamp: new Date().toISOString(),
        tip: result.jobs.length === 0
          ? `No jobs found for "${company}". Try the company's career page slug (e.g., "stripe" not "Stripe Inc").`
          : undefined,
      },
    });
  } catch (e: any) {
    console.error('Portal scan API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

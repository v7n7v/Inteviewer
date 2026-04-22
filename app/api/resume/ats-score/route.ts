import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { ATSScoreSchema } from '@/lib/schemas';
import { calculateATSScore } from '@/lib/ats-score';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000, allowAnonymous: true });
    if (guard.error) return guard.error;

    const validated = await validateBody(req, ATSScoreSchema);
    if (!validated.success) return validated.error;

    const { resumeText, jobDescription } = validated.data;

    const result = calculateATSScore(resumeText, jobDescription);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[api/resume/ats-score] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate ATS score' },
      { status: 500 }
    );
  }
}

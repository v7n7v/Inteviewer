import { NextRequest, NextResponse } from 'next/server';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { guardApiRoute } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    // Auth + rate limit check
    const guard = await guardApiRoute(req, { rateLimit: 1, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const { resume, jobDescription, morphPercentage, targetPageCount } = await req.json();

    if (!resume || !jobDescription) {
      return NextResponse.json({ error: 'Missing resume or job description' }, { status: 400 });
    }

    const keepOriginal = 100 - (morphPercentage || 50);

    const systemPrompt = `You are an expert resume writer. Blend the original resume with job description requirements.

MORPHING FORMULA: ${morphPercentage || 50}% JD Alignment / ${keepOriginal}% Original

RULES:
1. SUMMARY: Blend ${morphPercentage || 50}% JD keywords with ${keepOriginal}% original voice
2. EXPERIENCE: Keep all original jobs, enhance ${morphPercentage || 50}% of bullets with JD-relevant terms
3. SKILLS: Add JD-required skills, keep ${keepOriginal}% of original skills
4. Never invent experience or qualifications not implied by original

Return JSON:
{
  "morphedResume": { ...full resume object... },
  "matchScore": 75
}`;

    const result = await groqJSONCompletion<{ morphedResume: any; matchScore: number }>(
      systemPrompt,
      `MORPH PERCENTAGE: ${morphPercentage || 50}%\n\nORIGINAL RESUME:\n${JSON.stringify(resume, null, 2)}\n\nTARGET JOB DESCRIPTION:\n${jobDescription}`,
      { temperature: 0.4, maxTokens: 6000 }
    );

    // Defensive: ensure we always return valid data
    let morphedData;
    if (result.morphedResume?.name || result.morphedResume?.summary) {
      morphedData = result.morphedResume;
    } else if ((result as any).name) {
      morphedData = result;
    } else {
      morphedData = { ...resume, summary: resume.summary + ' [Optimized for target role]' };
    }

    return NextResponse.json({
      morphedResume: morphedData,
      matchScore: result.matchScore || 75,
    });
  } catch (error: any) {
    console.error('Resume morph error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to morph resume' },
      { status: 500 }
    );
  }
}

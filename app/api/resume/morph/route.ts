import { NextRequest, NextResponse } from 'next/server';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { guardApiRoute } from '@/lib/api-auth';
import { checkUsageAllowed, incrementUsage } from '@/lib/usage-tracker';
import { validateBody } from '@/lib/validate';
import { ResumeMorphSchema } from '@/lib/schemas';
import { sanitizeForAI } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 1, rateLimitWindow: 60_000, allowAnonymous: true });
    if (guard.error) return guard.error;

    // Skip Firestore usage tracking for anonymous users
    const isAnon = guard.user.uid.startsWith('anon:');
    if (!isAnon) {
      const usageCheck = await checkUsageAllowed(guard.user.uid, 'morphs', guard.user.tier);
      if (!usageCheck.allowed) {
        return NextResponse.json(
          {
            error: `Free tier limit reached (${usageCheck.cap} morphs). Upgrade to Pro for unlimited morphs.`,
            upgrade: true,
            used: usageCheck.used,
            cap: usageCheck.cap,
          },
          { status: 403 }
        );
      }
    }

    const validated = await validateBody(req, ResumeMorphSchema);
    if (!validated.success) return validated.error;
    const { resume, jobDescription, morphPercentage, targetPageCount } = validated.data;

    const safeJD = sanitizeForAI(jobDescription);
    const keepOriginal = 100 - (morphPercentage || 50);

    const systemPrompt = `You are a veteran career coach and resume strategist who writes like a real human — never like an AI.

MORPHING FORMULA: ${morphPercentage || 50}% JD Alignment / ${keepOriginal}% Original

CORE RULES:
1. SUMMARY: Weave in ${morphPercentage || 50}% of JD keywords naturally while keeping ${keepOriginal}% of the candidate's original voice and personality
2. EXPERIENCE: Keep every original job. Enhance ${morphPercentage || 50}% of bullet points with JD-relevant terminology
3. SKILLS: Add JD-required skills. Retain ${keepOriginal}% of original skills
4. Never invent experience or degrees not implied by the original

ANTI-AI-DETECTION — WRITE LIKE A HUMAN:
5. Vary sentence length dramatically. Mix short punchy fragments (3-5 words) with longer descriptive ones. Real humans don't write uniform sentences.
6. BANNED WORDS — never use: "utilized", "leveraged", "spearheaded", "synergized", "facilitated", "orchestrated", "endeavored", "passionate about", "results-driven", "detail-oriented", "proven track record". These are AI red flags.
7. Use conversational, natural verbs instead: "built", "ran", "led", "fixed", "grew", "cut", "shipped", "owned", "drove", "handled", "set up", "turned around"
8. Bury keywords organically within achievement context — don't list-dump them. Bad: "Proficient in React, Node.js, AWS." Good: "Built the customer dashboard in React and shipped it on AWS, cutting page load from 4s to 800ms."
9. Include occasional imperfect-but-human phrasing. Real resumes say "Helped the team hit Q3 targets" not "Facilitated achievement of quarterly objectives."
10. Quantify with SPECIFIC numbers, not round ones. Say "$1.2M" not "$1M". Say "37%" not "40%". Say "14 team members" not "large team."
11. Preserve the candidate's writing quirks and industry-specific jargon from the original resume
12. Each bullet should tell a micro-story: WHAT you did → HOW you did it → WHAT changed because of it

STRUCTURE: Preserve identical section ordering and field names from the original resume object.

Return JSON:
{
  "morphedResume": { ...full resume object with same field structure as input... },
  "matchScore": 75
}`;

    const result = await groqJSONCompletion<{ morphedResume: any; matchScore: number }>(
      systemPrompt,
      `MORPH PERCENTAGE: ${morphPercentage || 50}%\n\nORIGINAL RESUME:\n${JSON.stringify(resume, null, 2)}\n\nTARGET JOB DESCRIPTION:\n${safeJD}`,
      { temperature: 0.4, maxTokens: 6000 }
    );

    let morphedData;
    if (result.morphedResume?.name || result.morphedResume?.summary) {
      morphedData = result.morphedResume;
    } else if ((result as any).name) {
      morphedData = result;
    } else {
      morphedData = { ...resume, summary: (resume as any).summary + ' [Optimized for target role]' };
    }

    if (!isAnon) {
      await incrementUsage(guard.user.uid, 'morphs');
    }

    return NextResponse.json({
      morphedResume: morphedData,
      matchScore: result.matchScore || 75,
    });
  } catch (error: unknown) {
    console.error('[api/resume/morph] Error:', error);
    return NextResponse.json(
      { error: 'Failed to morph resume' },
      { status: 500 }
    );
  }
}

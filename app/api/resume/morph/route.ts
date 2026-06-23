import { NextRequest, NextResponse } from 'next/server';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { guardApiRoute } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { ANON_CAPS, FREE_CAPS, checkUsageAllowed, incrementUsage } from '@/lib/usage-tracker';
import { validateBody } from '@/lib/validate';
import { ResumeMorphSchema } from '@/lib/schemas';
import { sanitizeForAI } from '@/lib/sanitize';
import { quickClean } from '@/lib/humanize-guard';
import { monitor } from '@/lib/monitor';
import { proveResumeDelta, flattenResume } from '@/lib/tfidf-proof';
import type { PlanTier } from '@/lib/pricing-tiers';
import {
  applyResumeMorphGuardrails,
  getResumeMorphConsentForUser,
  resolveResumeMorphAccess,
} from '@/lib/resume-morph-guardrails';

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function enforceResumeMorphUsage(req: NextRequest, uid: string, tier: PlanTier) {
  if (uid.startsWith('anon:')) {
    const cap = ANON_CAPS.morphs ?? 1;
    const capKey = `anon-cap:${getClientIp(req)}:morphs`;
    const { allowed } = await checkRateLimit(capKey, cap, 30 * 24 * 60 * 60 * 1000);

    if (!allowed) {
      return NextResponse.json(
        {
          error: `You've used your free trial. Create an account to unlock ${FREE_CAPS.morphs} free uses and keep your progress.`,
          requiresAuth: true,
          limitReached: true,
          feature: 'morphs',
          used: cap,
          cap,
          remaining: 0,
        },
        { status: 429, headers: { 'X-Usage-Cap': String(cap), 'X-RateLimit-Tier': 'anonymous' } }
      );
    }

    return null;
  }

  const usageCheck = await checkUsageAllowed(uid, 'morphs', tier);
  if (!usageCheck.allowed) {
    return NextResponse.json(
      {
        error: 'You used your free resume morph runs. Your work is saved.',
        upgrade: true,
        limitReached: true,
        feature: 'morphs',
        used: usageCheck.used,
        cap: usageCheck.cap,
        upgradeUrl: '/suite/upgrade',
      },
      { status: 403 }
    );
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 1, rateLimitWindow: 60_000, allowAnonymous: true, skipUsageCap: true });
    if (guard.error) return guard.error;
    const isAnon = guard.user.uid.startsWith('anon:');

    const validated = await validateBody(req, ResumeMorphSchema);
    if (!validated.success) return validated.error;
    const { resume, jobDescription, morphPercentage, targetPageCount } = validated.data;

    const safeJD = sanitizeForAI(jobDescription);
    const consentStatus = await getResumeMorphConsentForUser(guard.user.uid);
    const morphAccess = resolveResumeMorphAccess({
      requestedMorphPercentage: morphPercentage || 50,
      hasFullConsent: consentStatus.unlocked100,
      mode: 'manual',
    });

    if (morphAccess.requiresMorphConsent) {
      return NextResponse.json(
        {
          error: '100% Morph must be unlocked in Settings > AI Safety before use.',
          requiresMorphConsent: true,
          effectiveMorphPercentage: morphAccess.effectiveMorphPercentage,
          maxAllowedMorphPercentage: morphAccess.maxAllowedMorphPercentage,
          consentVersion: consentStatus.consentVersion,
        },
        { status: 403 }
      );
    }

    const usageError = await enforceResumeMorphUsage(req, guard.user.uid, guard.user.tier);
    if (usageError) return usageError;

    const keepOriginal = 100 - morphAccess.effectiveMorphPercentage;

    const systemPrompt = `You are a veteran career coach and resume strategist who writes like a real human — never like an AI.

MORPHING FORMULA: ${morphAccess.effectiveMorphPercentage}% JD Alignment / ${keepOriginal}% Original

CORE RULES:
1. SUMMARY: Weave in ${morphAccess.effectiveMorphPercentage}% of JD keywords naturally while keeping ${keepOriginal}% of the candidate's original voice and personality
2. EXPERIENCE: Keep every original job. Enhance ${morphAccess.effectiveMorphPercentage}% of bullet points with JD-relevant terminology
3. SKILLS: Add JD-required skills. Retain ${keepOriginal}% of original skills
4. STRICT GUARDRAIL: NEVER invent certifications, licenses, degrees, schools, employers, job titles, dates, contact details, or experience not in the original resume. Only reframe what already exists. If the JD asks for a cert the candidate doesn't have, DO NOT add it — leave it out entirely.
5. EDUCATION LOCK: Return the Education section exactly as provided. Do not add, remove, rename, reorder, or reword schools, degrees, years, or details.

ANTI-AI-DETECTION — WRITE LIKE A HUMAN:
6. Vary sentence length dramatically. Mix short punchy fragments (3-5 words) with longer descriptive ones. Real humans don't write uniform sentences.
7. BANNED WORDS — never use: "utilized", "leveraged", "spearheaded", "synergized", "facilitated", "orchestrated", "endeavored", "passionate about", "results-driven", "detail-oriented", "proven track record". These are AI red flags.
8. Use conversational, natural verbs instead: "built", "ran", "led", "fixed", "grew", "cut", "shipped", "owned", "drove", "handled", "set up", "turned around"
9. Bury keywords organically within achievement context — don't list-dump them. Bad: "Proficient in React, Node.js, AWS." Good: "Built the customer dashboard in React and shipped it on AWS, cutting page load from 4s to 800ms."
10. Include occasional imperfect-but-human phrasing. Real resumes say "Helped the team hit Q3 targets" not "Facilitated achievement of quarterly objectives."
11. Quantify with SPECIFIC numbers, not round ones. Say "$1.2M" not "$1M". Say "37%" not "40%". Say "14 team members" not "large team."
12. Preserve the candidate's writing quirks and industry-specific jargon from the original resume
13. Each bullet should tell a micro-story: WHAT you did → HOW you did it → WHAT changed because of it

STRUCTURE: Preserve identical section ordering and field names from the original resume object.

Return JSON:
{
  "morphedResume": { ...full resume object with same field structure as input... },
  "matchScore": 75
}`;

    const result = await groqJSONCompletion<{ morphedResume: any; matchScore: number }>(
      systemPrompt,
      `MORPH PERCENTAGE: ${morphAccess.effectiveMorphPercentage}%\n\nORIGINAL RESUME:\n${JSON.stringify(resume, null, 2)}\n\nTARGET JOB DESCRIPTION:\n${safeJD}`,
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

    const guarded = applyResumeMorphGuardrails(resume, morphedData, morphAccess);
    morphedData = guarded.resume;

    // Apply humanization guard to all text fields
    if (morphedData.summary) {
      morphedData.summary = quickClean(morphedData.summary);
    }
    if (morphedData.experience && Array.isArray(morphedData.experience)) {
      for (const exp of morphedData.experience) {
        if (exp.bullets && Array.isArray(exp.bullets)) {
          exp.bullets = exp.bullets.map((b: string) => quickClean(b));
        }
        if (exp.description) {
          exp.description = quickClean(exp.description);
        }
      }
    }

    if (!isAnon) {
      await incrementUsage(guard.user.uid, 'morphs');
    }

    // ── Deterministic TF-IDF Proof ──
    let proof = null;
    try {
      const originalText = flattenResume(resume);
      const morphedText = flattenResume(morphedData);
      if (originalText.length > 20 && morphedText.length > 20 && safeJD.length > 20) {
        proof = proveResumeDelta(originalText, morphedText, safeJD);
      }
    } catch (e) {
      console.warn('[api/resume/morph] Proof engine error (non-fatal):', e);
    }

    return NextResponse.json({
      morphedResume: morphedData,
      matchScore: proof?.optimizedScore ?? result.matchScore ?? 75,
      proof,
      effectiveMorphPercentage: morphAccess.effectiveMorphPercentage,
      maxAllowedMorphPercentage: morphAccess.maxAllowedMorphPercentage,
      requiresMorphConsent: false,
      guardrailReport: guarded.report,
    });
  } catch (error: unknown) {
    console.error('[api/resume/morph] Error:', error);
    monitor.critical('Tool: resume/morph', String(error));
    return NextResponse.json(
      { error: 'Failed to morph resume' },
      { status: 500 }
    );
  }
}

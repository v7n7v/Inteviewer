/**
 * Oracle Analyze API — Dual-AI Career Intelligence
 * Stage 1 (GPT): Extract resume skills, parse JD, identify matches/gaps, detect red flags
 * Stage 2 (Gemini): Cross-validate, refine fit score, add salary intel & hidden requirements
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { geminiJSONCompletion } from '@/lib/ai/gemini-client';
import { validateBody } from '@/lib/validate';
import { OracleAnalyzeSchema } from '@/lib/schemas';
import { sanitizeForAI } from '@/lib/sanitize';

interface GPTAnalysis {
  resumeSkills: string[];
  jdRequirements: string[];
  matchedSkills: string[];
  gapSkills: string[];
  fitScoreEstimate: number;
  salaryRange: { min: number; max: number; currency: string };
  redFlags: { flag: string; severity: 'low' | 'medium' | 'high'; explanation: string }[];
  hiddenRequirements: { stated: string; actual: string }[];
  keywordsToAdd: string[];
  roleLevel: string;
  bridgeSkills: { skill: string; impact: number; salaryIncrease: number }[];
  marketTrends: { skill: string; growth: number }[];
}

interface GeminiValidation {
  fitScore: number;
  fitVerdict: 'excellent' | 'strong' | 'moderate' | 'weak';
  salaryRefinement: { min: number; max: number; userPosition: number; withBridgeSkills: number };
  additionalRedFlags: { flag: string; severity: 'low' | 'medium' | 'high'; explanation: string }[];
  additionalHiddenReqs: { stated: string; actual: string }[];
  industryInsights: string[];
  competitiveEdge: string;
  overallAssessment: string;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    // Pro-only feature
    if (guard.user.tier !== 'pro') {
      return NextResponse.json(
        { error: 'Oracle Analysis is a Pro feature. Upgrade to unlock full career intelligence.', upgrade: true },
        { status: 403 }
      );
    }

    const validated = await validateBody(req, OracleAnalyzeSchema);
    if (!validated.success) return validated.error;
    const { resumeText, jdText, targetRole, location } = validated.data;

    // ═══ STAGE 1: GPT — Extract & Analyze ═══
    const gptAnalysis = await groqJSONCompletion<GPTAnalysis>(
      `You are a Senior Career Intelligence Analyst with 20 years of recruiting experience at top tech companies. 
You analyze resumes against job descriptions with surgical precision, identifying exact skill matches, gaps, and market dynamics.

You MUST return a JSON object with this exact structure:
{
  "resumeSkills": ["skill1", "skill2", ...],
  "jdRequirements": ["requirement1", "requirement2", ...],
  "matchedSkills": ["skill that appears in BOTH resume and JD"],
  "gapSkills": ["skill in JD but NOT in resume"],
  "fitScoreEstimate": 0-100,
  "salaryRange": {"min": number, "max": number, "currency": "USD"},
  "redFlags": [{"flag": "short description", "severity": "low|medium|high", "explanation": "why this matters"}],
  "hiddenRequirements": [{"stated": "what JD says", "actual": "what they really mean"}],
  "keywordsToAdd": ["keywords from JD to add to resume"],
  "roleLevel": "Junior|Mid|Senior|Staff|Principal|Lead|Director|VP",
  "bridgeSkills": [{"skill": "name", "impact": 1-10, "salaryIncrease": estimated_dollars}],
  "marketTrends": [{"skill": "name", "growth": percent_growth}]
}

Red flag detection rules:
- 15+ requirements = unicorn hunt (high severity)
- "Fast-paced environment" = potential overwork culture (medium)
- No salary listed = often below market (low)
- "Wear many hats" = understaffed team (medium)
- "Like a family" = boundary issues (medium)
- Vague growth promises = limited advancement (low)
- Too many buzzwords = unclear role (medium)
- "Competitive salary" without range = often below market (low)

Hidden requirement detection:
- "Python" in data context = actually means ML pipeline experience
- "Team player" = cross-functional leadership expected
- "Self-starter" = minimal mentorship/support
- "3+ years React" = they'll accept 2 if you're strong
- "Nice to have" items that appear first = actually required`,

      `RESUME:
${sanitizeForAI(resumeText, 4000)}

${jdText ? `JOB DESCRIPTION:
${sanitizeForAI(jdText, 3000)}` : `TARGET ROLE: ${targetRole || 'Software Engineer'}`}

LOCATION: ${location || 'United States'}

Analyze this resume ${jdText ? 'against this specific job description' : 'for the target role'} and return the full JSON analysis. Be specific and actionable.`,
      { temperature: 0.3, maxTokens: 3000 }
    );

    // ═══ STAGE 2: Gemini — Validate & Enrich ═══
    const geminiValidation = await geminiJSONCompletion<GeminiValidation>(
      `You are an elite Career Data Scientist specializing in compensation benchmarking and market analysis.
Your role is the "Editor" — you validate another AI's analysis and add deeper insights.

You MUST return JSON with this structure:
{
  "fitScore": 0-100 (your independent assessment),
  "fitVerdict": "excellent|strong|moderate|weak",
  "salaryRefinement": {
    "min": refined_min_salary,
    "max": refined_max_salary,
    "userPosition": where_user_falls_in_range_as_percentile_0_to_100,
    "withBridgeSkills": projected_salary_with_bridge_skills
  },
  "additionalRedFlags": [{"flag": "...", "severity": "...", "explanation": "..."}],
  "additionalHiddenReqs": [{"stated": "...", "actual": "..."}],
  "industryInsights": ["actionable insight 1", "insight 2", "insight 3"],
  "competitiveEdge": "What makes this candidate stand out (or not) for this role",
  "overallAssessment": "2-3 sentence executive summary of fit"
}

Be critical but fair. If GPT overestimated the fit score, correct it. If they missed red flags, add them.`,

      `GPT's analysis of this candidate:
${JSON.stringify(gptAnalysis, null, 2)}

ORIGINAL RESUME (first 2000 chars):
${sanitizeForAI(resumeText, 2000)}

${jdText ? `ORIGINAL JD (first 1500 chars):
${sanitizeForAI(jdText, 1500)}` : ''}

Cross-validate GPT's analysis. Refine the salary estimates for ${location || 'US market'}. Add any red flags or hidden requirements GPT missed. Provide your independent fit score.`,
      { temperature: 0.2, maxTokens: 2000 }
    );

    // ═══ MERGE — Combine both analyses ═══
    const finalFitScore = Math.round((gptAnalysis.fitScoreEstimate + geminiValidation.fitScore) / 2);
    const allRedFlags = [
      ...gptAnalysis.redFlags,
      ...geminiValidation.additionalRedFlags,
    ].slice(0, 8);
    const allHiddenReqs = [
      ...gptAnalysis.hiddenRequirements,
      ...geminiValidation.additionalHiddenReqs,
    ].slice(0, 6);

    return NextResponse.json({
      success: true,
      analysis: {
        fitScore: finalFitScore,
        fitVerdict: geminiValidation.fitVerdict,
        overallAssessment: geminiValidation.overallAssessment,
        competitiveEdge: geminiValidation.competitiveEdge,
        resumeSkills: gptAnalysis.resumeSkills,
        jdRequirements: gptAnalysis.jdRequirements,
        matchedSkills: gptAnalysis.matchedSkills,
        gapSkills: gptAnalysis.gapSkills,
        keywordsToAdd: gptAnalysis.keywordsToAdd,
        salaryIntel: {
          min: geminiValidation.salaryRefinement.min || gptAnalysis.salaryRange.min,
          max: geminiValidation.salaryRefinement.max || gptAnalysis.salaryRange.max,
          userPosition: geminiValidation.salaryRefinement.userPosition,
          withBridgeSkills: geminiValidation.salaryRefinement.withBridgeSkills,
          currency: gptAnalysis.salaryRange.currency || 'USD',
        },
        redFlags: allRedFlags,
        hiddenRequirements: allHiddenReqs,
        roleLevel: gptAnalysis.roleLevel,
        bridgeSkills: gptAnalysis.bridgeSkills,
        marketTrends: gptAnalysis.marketTrends,
        industryInsights: geminiValidation.industryInsights,
      },
      pipeline: { stage1: 'GPT-OSS 120B', stage2: 'Gemini 3 Flash' },
    });
  } catch (error: unknown) {
    console.error('[api/oracle/analyze] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze. Please try again.' },
      { status: 500 }
    );
  }
}

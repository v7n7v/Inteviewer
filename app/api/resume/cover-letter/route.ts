/**
 * Cover Letter Generator API
 * Dual-AI powered: GPT writes → Gemini validates → GPT refines
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { checkUsageAllowed, incrementUsage } from '@/lib/usage-tracker';
import { dualAIGenerate } from '@/lib/ai/dual-ai';
import { validateBody } from '@/lib/validate';
import { CoverLetterSchema } from '@/lib/schemas';
import { sanitizeForAI } from '@/lib/sanitize';
import { guardOutput } from '@/lib/humanize-guard';
import { monitor } from '@/lib/monitor';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 3, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    // Pro-only feature
    if (guard.user.tier === 'free') {
      return NextResponse.json(
        { error: 'Cover Letter Generator is a Pro feature. Upgrade to access dual-AI tools.', upgrade: true },
        { status: 403 }
      );
    }

    const validated = await validateBody(req, CoverLetterSchema);
    if (!validated.success) return validated.error;
    const { resumeText, jobDescription, companyName, tone } = validated.data;

    const safeResume = sanitizeForAI(resumeText);
    const safeJD = sanitizeForAI(jobDescription);

    const toneMap: Record<string, string> = {
      professional: 'formal, polished, and corporate-appropriate',
      friendly: 'warm, personable, and conversational while remaining professional',
      bold: 'confident, direct, and achievement-focused with a strong voice',
    };
    const toneGuide = toneMap[tone || 'professional'] || toneMap.professional;

    const writerPrompt = `You are a career coach who writes cover letters that sound like a real, articulate human — never like an AI.

RULES:
1. Address the hiring manager (use "Dear Hiring Manager" if no name given)
2. Opening paragraph: Hook with a specific achievement or genuine interest relevant to the role. Start with something unexpected — never "I am writing to..."
3. Body: Connect 2-3 key resume experiences to JD requirements with SPECIFIC results (use exact numbers: "$1.2M", "37%", "14-person team")
4. Closing: Express enthusiasm naturally and include a clear next step
5. Tone: ${toneGuide}
6. Length: 250-350 words (3-4 paragraphs)

ANTI-AI-DETECTION — WRITE LIKE A HUMAN:
7. BANNED PHRASES — never use: "I am writing to express my interest", "I believe I am a perfect fit", "I am excited to apply", "leveraging my experience", "results-driven professional", "proven track record", "I am confident that", "I am eager to contribute"
8. Start sentences differently every time. Real humans don't begin every sentence with "I"
9. Vary sentence length dramatically — mix 5-word punches with 25-word storytelling
10. Include one moment of genuine personality or humor that feels distinctly human
11. Use contractions naturally (I'm, I've, didn't, couldn't) — formal ≠ robotic
12. Reference something SPECIFIC about the company that shows you actually looked them up
13. Include specific metrics from the resume, not vague claims
14. End with confidence, not desperation. "I'd love to talk about how [specific thing] could work for your team" beats "I look forward to hearing from you"

Return ONLY the cover letter text. No headers, no "Subject:" line, no metadata.`;

    const userPrompt = `Write a cover letter for this candidate:

COMPANY: ${companyName || 'the company'}
JOB DESCRIPTION:
${safeJD}

CANDIDATE RESUME:
${safeResume}

Write a ${tone || 'professional'} cover letter that connects the candidate's experience to this specific role.`;

    const result = await dualAIGenerate(
      writerPrompt,
      userPrompt,
      'Cover letter quality assessment',
      [
        'Personalization — does it reference the specific company and role?',
        'Achievement focus — does it include specific metrics/results from the resume?',
        'No clichés — avoids generic phrases like "I am writing to express my interest"',
        'Tone consistency — matches the requested tone throughout',
        'Length — between 250-350 words',
        'Call to action — clear next step in the closing',
        'JD alignment — addresses key requirements from the job description',
      ],
      { writerTemp: 0.7, refineThreshold: 70, maxTokens: 1500 }
    );

    await incrementUsage(guard.user.uid, 'coverLetters');

    // Apply humanization guard to strip AI artifacts
    const guarded = guardOutput(result.content);

    return NextResponse.json({
      coverLetter: guarded.text,
      score: result.score,
      humanScore: guarded.aiScore,
      suggestions: result.validationNotes,
      refined: result.refined,
      modelAgreement: result.modelAgreement,
      dualAI: true,
    });
  } catch (error: unknown) {
    console.error('[api/resume/cover-letter] Error:', error);
    monitor.critical('Tool: resume/cover-letter', String(error));
    return NextResponse.json(
      { error: 'Failed to generate cover letter' },
      { status: 500 }
    );
  }
}

/**
 * Cover Letter Generator API
 * Dual-AI powered: GPT writes → Gemini validates → GPT refines
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { checkUsageAllowed, incrementUsage } from '@/lib/usage-tracker';
import { dualAIGenerate } from '@/lib/ai/dual-ai';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 3, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    // Pro-only feature
    if (guard.user.tier !== 'pro') {
      return NextResponse.json(
        { error: 'Cover Letter Generator is a Pro feature. Upgrade to access dual-AI tools.', upgrade: true },
        { status: 403 }
      );
    }

    const { resumeText, jobDescription, companyName, tone } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json({ error: 'Resume text and job description are required' }, { status: 400 });
    }

    const toneMap: Record<string, string> = {
      professional: 'formal, polished, and corporate-appropriate',
      friendly: 'warm, personable, and conversational while remaining professional',
      bold: 'confident, direct, and achievement-focused with a strong voice',
    };
    const toneGuide = toneMap[tone || 'professional'] || toneMap.professional;

    const writerPrompt = `You are an expert cover letter writer. Write compelling, personalized cover letters that get interviews.

RULES:
1. Address the hiring manager (use "Dear Hiring Manager" if no name given)
2. Opening paragraph: Hook with a specific achievement or passion relevant to the role
3. Body: Connect 2-3 key resume experiences to the JD requirements with specific results
4. Closing: Express enthusiasm and include a clear call-to-action
5. Tone: ${toneGuide}
6. Length: 250-350 words (3-4 paragraphs)
7. Never use clichés like "I am writing to express my interest" or "I believe I am a perfect fit"
8. Include specific metrics and achievements from the resume
9. Reference the company name and role naturally

Return ONLY the cover letter text. No headers, no "Subject:" line, no metadata.`;

    const userPrompt = `Write a cover letter for this candidate:

COMPANY: ${companyName || 'the company'}
JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

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

    return NextResponse.json({
      coverLetter: result.content,
      score: result.score,
      suggestions: result.validationNotes,
      refined: result.refined,
      modelAgreement: result.modelAgreement,
      dualAI: true,
    });
  } catch (error: any) {
    console.error('Cover letter generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate cover letter' },
      { status: 500 }
    );
  }
}

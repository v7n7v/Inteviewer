/**
 * Resume Auto-Fix API
 * Takes resume text + suggestions from resume check → GPT rewrites → Gemini rechecks
 * Pro-only feature — the core of the dual-AI "check and balance" system
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { dualAIGenerate } from '@/lib/ai/dual-ai';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 3, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    // Pro-only feature
    if (guard.user.tier !== 'pro') {
      return NextResponse.json(
        { error: 'Auto-Fix is a Pro feature. Upgrade to access dual-AI resume enhancement.', upgrade: true },
        { status: 403 }
      );
    }

    const { resumeText, suggestions, targetJD } = await req.json();

    if (!resumeText || !suggestions?.length) {
      return NextResponse.json({ error: 'Resume text and suggestions are required' }, { status: 400 });
    }

    const writerPrompt = `You are a world-class resume writer and career strategist.
You are given a resume and a list of expert improvement suggestions. Your job is to:
1. Apply ALL suggested improvements to the resume content
2. Maintain the person's authentic voice and real experience
3. Strengthen weak bullet points with quantified achievements where possible
4. Improve keyword density for ATS systems
5. Keep the same structure (sections, ordering) — only improve the content

CRITICAL: Return the improved resume in valid JSON format as a resume data object with these fields:
{
  "name": "string",
  "title": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "summary": "string (improved)",
  "experience": [{"company": "string", "title": "string", "duration": "string", "achievements": ["string"]}],
  "education": [{"school": "string", "degree": "string", "year": "string", "details": "string"}],
  "skills": ["string"],
  "certifications": ["string"]
}`;

    const userPrompt = `Here is the resume to improve:

${resumeText}

${targetJD ? `TARGET JOB DESCRIPTION:\n${targetJD}\n` : ''}
EXPERT SUGGESTIONS TO APPLY:
${suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

Apply all suggestions and return the improved resume as a JSON object.`;

    const result = await dualAIGenerate(
      writerPrompt,
      userPrompt,
      'Resume quality after applying improvement suggestions',
      [
        'All suggestions have been addressed',
        'Achievements are quantified with metrics',
        'Keywords match the target role',
        'Professional tone maintained',
        'ATS-friendly formatting preserved',
      ],
      { writerTemp: 0.5, refineThreshold: 70, maxTokens: 4096 }
    );

    // Parse the improved resume from the content
    let improvedResume;
    try {
      improvedResume = JSON.parse(result.content);
    } catch {
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        improvedResume = JSON.parse(jsonMatch[1]);
      } else {
        const objMatch = result.content.match(/\{[\s\S]*\}/);
        if (objMatch) improvedResume = JSON.parse(objMatch[0]);
        else throw new Error('Could not parse improved resume from AI response');
      }
    }

    return NextResponse.json({
      improvedResume,
      score: result.score,
      refined: result.refined,
      modelAgreement: result.modelAgreement,
      validationNotes: result.validationNotes,
      poweredBy: 'dual-ai',
    });
  } catch (error: any) {
    console.error('Auto-fix error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-fix resume' },
      { status: 500 }
    );
  }
}

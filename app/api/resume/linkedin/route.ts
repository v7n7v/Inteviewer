/**
 * LinkedIn Profile Builder API
 * Dual-AI powered: GPT generates → Gemini validates → GPT refines
 * Generates headline, summary, and experience bullets optimized for LinkedIn
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
        { error: 'LinkedIn Builder is a Pro feature. Upgrade to access dual-AI tools.', upgrade: true },
        { status: 403 }
      );
    }

    const { resumeText, targetRole } = await req.json();

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    const writerPrompt = `You are a LinkedIn profile optimization expert. Generate LinkedIn-optimized content from resume data.

LINKEDIN BEST PRACTICES:
1. HEADLINE (max 220 chars): Use format "Title | Expertise | Value Prop" — include keywords recruiters search for
2. SUMMARY (About section, 200-300 words): First person, story-driven, end with CTA. Include 3-5 industry keywords naturally.
3. EXPERIENCE BULLETS: Start with action verbs, include metrics, shorter than resume bullets (1-2 lines each)
4. SKILLS: Top 5 endorsement-worthy skills relevant to target role

FORMAT: Return a JSON object with:
{
  "headline": "string (max 220 chars)",
  "summary": "string (200-300 words, first person)",
  "experiences": [{ "company": "string", "title": "string", "bullets": ["string"] }],
  "skills": ["string"],
  "hashtags": ["string"] (3-5 relevant LinkedIn hashtags)
}`;

    const userPrompt = `Generate LinkedIn profile content from this resume:

${resumeText}
${targetRole ? `\nOPTIMIZE FOR TARGET ROLE: ${targetRole}` : ''}

Return as a JSON object.`;

    const result = await dualAIGenerate(
      writerPrompt,
      userPrompt,
      'LinkedIn profile quality assessment',
      [
        'Headline is under 220 characters and includes searchable keywords',
        'Summary is first-person, engaging, and 200-300 words',
        'Experience bullets have quantified achievements',
        'Skills are relevant and endorsement-worthy',
        'Content is optimized for LinkedIn search/SEO',
      ],
      { writerTemp: 0.6, refineThreshold: 72, maxTokens: 3000 }
    );

    // Parse the content as JSON
    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      // Try extracting JSON from the content
      const match = result.content.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = {
          headline: '',
          summary: result.content,
          experiences: [],
          skills: [],
          hashtags: [],
        };
      }
    }

    await incrementUsage(guard.user.uid, 'linkedinProfiles');

    return NextResponse.json({
      ...parsed,
      score: result.score,
      suggestions: result.validationNotes,
      refined: result.refined,
      modelAgreement: result.modelAgreement,
      dualAI: true,
    });
  } catch (error: any) {
    console.error('LinkedIn builder error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate LinkedIn profile' },
      { status: 500 }
    );
  }
}

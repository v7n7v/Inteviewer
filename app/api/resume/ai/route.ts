import { NextRequest, NextResponse } from 'next/server';
import { groqJSONCompletion, groqCompletion } from '@/lib/ai/groq-client';
import { guardApiRoute } from '@/lib/api-auth';
import { validateBody } from '@/lib/validate';
import { ResumeAISchema } from '@/lib/schemas';
import { sanitizeForAI } from '@/lib/sanitize';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000, allowAnonymous: true });
    if (guard.error) return guard.error;

    const validated = await validateBody(req, ResumeAISchema);
    if (!validated.success) return validated.error;
    const { action, text, jobDescription } = validated.data;

    if (action === 'extract_company') {
      const res = await groqJSONCompletion<{ company: string }>(
        'Extract the Company Name from this Job Description. Return { "company": "Name" }',
        sanitizeForAI(jobDescription || text || '', 2000),
        { temperature: 0, maxTokens: 50 }
      );
      return NextResponse.json({ company: res.company || '' });
    }

    if (action === 'generate_summary') {
      const summary = await groqCompletion(
        'You are a professional resume writer. Generate a compelling 2-3 sentence professional summary based on the provided details. Return ONLY the summary text, no quotes or labels.',
        text || '',
        { temperature: 0.6, maxTokens: 300 }
      );
      return NextResponse.json({ summary });
    }

    if (action === 'generate_achievements') {
      const achievements = await groqJSONCompletion<{ achievements: string[] }>(
        'Generate 3-4 professional achievement bullet points for the role described. Each should start with a strong action verb and include quantifiable results where possible. Return JSON: { "achievements": ["bullet 1", "bullet 2", "bullet 3"] }',
        text || '',
        { temperature: 0.6, maxTokens: 500 }
      );
      return NextResponse.json({ achievements: achievements.achievements || [] });
    }

    if (action === 'suggest_skills') {
      const skills = await groqJSONCompletion<{ skills: { category: string; items: string[] }[] }>(
        'Suggest relevant skills organized by category for a resume. Return JSON: { "skills": [{ "category": "Category", "items": ["Skill1", "Skill2"] }] }',
        text || '',
        { temperature: 0.7, maxTokens: 400 }
      );
      return NextResponse.json({ skills: skills.skills || [] });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[api/resume/ai] Error:', error);
    return NextResponse.json(
      { error: 'AI request failed' },
      { status: 500 }
    );
  }
}
